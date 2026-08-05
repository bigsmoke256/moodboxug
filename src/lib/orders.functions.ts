import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RESTAURANT_ID = "61548a61-12cb-4a04-ad26-d57264e9e436";
const FALLBACK_DELIVERY_FEE = 5000;

const OptionSchema = z.object({
  group: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
});

const LineSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive().max(50),
  options: z.array(OptionSchema).max(20).default([]),
});

const InputSchema = z.object({
  lines: z.array(LineSchema).min(1).max(50),
  promoCode: z.string().trim().min(1).max(50).nullable().optional(),
  paymentMethod: z.enum(["card", "mtn_momo", "airtel_money"]),
  fulfillment: z.enum(["delivery", "pickup"]).default("delivery"),
  delivery: z.object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(6).max(30),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
    address: z.string().trim().max(500).default(""),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  }),
});


export type PlaceOrderResult =
  | { ok: true; orderId: string; total: number }
  | { ok: false; error: "unavailable"; unavailableIds: string[]; unavailableNames: string[] }
  | { ok: false; error: "invalid_option"; detail: string };

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<PlaceOrderResult> => {
    const { supabase, userId } = context;

    const itemIds = [...new Set(data.lines.map((l) => l.menuItemId))];

    // 1. Server-side price + availability check.
    const { data: items, error: itemsErr } = await supabase
      .from("menu_items")
      .select("id, name, price, is_available")
      .in("id", itemIds);
    if (itemsErr) throw new Error(itemsErr.message);
    const byId = new Map((items ?? []).map((i) => [i.id, i]));

    const unavailableIds: string[] = [];
    const unavailableNames: string[] = [];
    for (const id of itemIds) {
      const item = byId.get(id);
      if (!item || !item.is_available) {
        unavailableIds.push(id);
        unavailableNames.push(item?.name ?? "Item removed");
      }
    }
    if (unavailableIds.length > 0) {
      return { ok: false, error: "unavailable", unavailableIds, unavailableNames };
    }

    // 2. Server-side option price deltas.
    const { data: opts, error: optsErr } = await supabase
      .from("item_options")
      .select("menu_item_id, option_group, name, price_delta")
      .in("menu_item_id", itemIds);
    if (optsErr) throw new Error(optsErr.message);
    const optKey = (mid: string, g: string, n: string) => `${mid}::${g}::${n}`;
    const optMap = new Map(
      (opts ?? []).map((o) => [optKey(o.menu_item_id, o.option_group, o.name), Number(o.price_delta)]),
    );

    // 3. Recompute subtotal from server data.
    let subtotal = 0;
    const orderItems: Array<{
      menu_item_id: string;
      quantity: number;
      selected_options: Array<{ group: string; name: string; priceDelta: number }>;
      line_total: number;
    }> = [];
    for (const line of data.lines) {
      const item = byId.get(line.menuItemId)!;
      let extra = 0;
      const chosen: Array<{ group: string; name: string; priceDelta: number }> = [];
      for (const o of line.options) {
        const delta = optMap.get(optKey(line.menuItemId, o.group, o.name));
        if (delta === undefined) {
          return { ok: false, error: "invalid_option", detail: `${o.group}: ${o.name}` };
        }
        extra += delta;
        chosen.push({ group: o.group, name: o.name, priceDelta: delta });
      }
      const unit = Number(item.price) + extra;
      const lineTotal = unit * line.quantity;
      subtotal += lineTotal;
      orderItems.push({
        menu_item_id: line.menuItemId,
        quantity: line.quantity,
        selected_options: chosen,
        line_total: lineTotal,
      });
    }

    // 4. Read restaurant-level pricing (delivery fee + tax rate).
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("settings")
      .eq("id", RESTAURANT_ID)
      .maybeSingle();
    const rSettings = (restaurant?.settings ?? {}) as {
      delivery_fee?: number;
      tax_rate?: number;
    };
    let deliveryFee = Number(rSettings.delivery_fee ?? FALLBACK_DELIVERY_FEE);
    const taxRate = Math.max(0, Math.min(100, Number(rSettings.tax_rate ?? 0)));

    // 5. Re-validate promo server-side.
    let discount = 0;
    let appliedPromoCode: string | null = null;
    if (data.promoCode) {
      const nowIso = new Date().toISOString();
      const { data: promo } = await supabase
        .from("promotions")
        .select("code, type, value, active_from, active_to, is_active")
        .eq("code", data.promoCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      const active =
        promo &&
        (!promo.active_from || promo.active_from <= nowIso) &&
        (!promo.active_to || promo.active_to >= nowIso);
      if (active && promo) {
        appliedPromoCode = promo.code;
        if (promo.type === "percentage") discount = Math.round((subtotal * Number(promo.value)) / 100);
        else if (promo.type === "fixed_amount") discount = Number(promo.value);
        else if (promo.type === "free_delivery") deliveryFee = 0;
      }
    }

    const tax = Math.round(((subtotal - discount) * taxRate) / 100);
    const total = Math.max(0, subtotal + deliveryFee + tax - discount);
    const combinedInstructions = [
      data.delivery.notes ? `Notes: ${data.delivery.notes}` : "",
      `Contact: ${data.delivery.fullName} · ${data.delivery.phone}`,
    ]
      .filter(Boolean)
      .join(" | ");

    // 5. Insert order + items (RLS as the signed-in customer).
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        restaurant_id: RESTAURANT_ID,
        status: "pending",
        payment_status: "pending",
        payment_method: data.paymentMethod,
        delivery_address: data.delivery.address,
        special_instructions: combinedInstructions,
        promo_code: appliedPromoCode,
        subtotal,
        delivery_fee: deliveryFee,
        tax,
        total,
      })
      .select("id")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "Could not place order");

    const { error: iErr } = await supabase
      .from("order_items")
      .insert(orderItems.map((oi) => ({ ...oi, order_id: order.id })));
    if (iErr) throw new Error(iErr.message);

    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "pending",
      changed_by: userId,
    });

    return { ok: true, orderId: order.id, total };
  });
