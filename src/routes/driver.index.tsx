import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Bike, MapPin, Phone, Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RealtimePill } from "@/components/shared/RealtimePill";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import { useAuth } from "@/hooks/use-auth";
import { formatUGX } from "@/hooks/use-cart";

export const Route = createFileRoute("/driver/")({
  component: DriverApp,
});

type DeliveryStatus = "assigned" | "picked_up" | "out_for_delivery" | "delivered";

interface Delivery {
  id: string;
  status: DeliveryStatus;
  total: number;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  created_at: string;
  updated_at: string;
  delivery_address: string | null;
  payment_method: string | null;
  payment_status: string;
  special_instructions: string | null;
  customer_id: string;
  profiles: { full_name: string | null; phone: string | null } | null;
  order_items: {
    id: string;
    quantity: number;
    line_total: number;
    selected_options: unknown;
    menu_items: { name: string } | null;
  }[];
}

const NEXT: Record<DeliveryStatus, { to: DeliveryStatus; label: string } | null> = {
  assigned: { to: "picked_up", label: "Picked up from kitchen" },
  picked_up: { to: "out_for_delivery", label: "Start delivery" },
  out_for_delivery: { to: "delivered", label: "Mark delivered" },
  delivered: null,
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  assigned: "Assigned",
  picked_up: "Picked up",
  out_for_delivery: "On the way",
  delivered: "Delivered",
};

function optionLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => (o && typeof o === "object" && "name" in o ? String((o as { name: unknown }).name) : null))
    .filter((v): v is string => !!v);
}

function DriverApp() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const rtStatus = useRealtimeStatus(channel);
  const [receipt, setReceipt] = useState<Delivery | null>(null);
  const userId = auth.user?.id;

  const { data: me } = useQuery({
    queryKey: ["driver-self", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, is_online")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["driver-deliveries", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Delivery[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, total, subtotal, delivery_fee, tax, created_at, updated_at, delivery_address, payment_method, payment_status, special_instructions, customer_id, profiles:customer_id(full_name, phone), order_items(id, quantity, line_total, selected_options, menu_items(name))",
        )
        .eq("driver_id", userId!)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as Delivery[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["driver-deliveries", userId] });
      })
      .subscribe();
    setChannel(ch);
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, userId]);

  const toggleOnline = async () => {
    if (!userId) return;
    const next = !me?.is_online;
    const { error } = await supabase
      .from("drivers")
      .upsert({ id: userId, is_online: next }, { onConflict: "id" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["driver-self", userId] });
    toast.success(next ? "You're online" : "You're offline");
  };

  const advance = async (d: Delivery) => {
    const step = NEXT[d.status];
    if (!step) return;
    const { error } = await supabase.from("orders").update({ status: step.to }).eq("id", d.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["driver-deliveries", userId] });
    if (step.to === "delivered") {
      toast.success("Delivered — print the receipt for the customer.");
      setReceipt({ ...d, status: "delivered" });
    }
  };

  const active = deliveries.filter((d) => d.status !== "delivered");
  const done = deliveries.filter((d) => d.status === "delivered");

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors closeButton />

      <header className="glass-surface sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-body font-bold text-charcoal">Driver app</h1>
            <p className="text-caption text-muted-foreground">
              {active.length} active {active.length === 1 ? "delivery" : "deliveries"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RealtimePill status={rtStatus} />
          <button
            onClick={toggleOnline}
            className={`rounded-full px-4 py-2 text-body-sm font-semibold ${
              me?.is_online
                ? "bg-primary text-primary-foreground"
                : "border border-input text-muted-foreground"
            }`}
          >
            {me?.is_online ? "Online" : "Offline"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {isLoading && <p className="text-body-sm text-muted-foreground">Loading deliveries…</p>}

        {!isLoading && active.length === 0 && (
          <div className="rounded-2xl bg-card p-8 text-center shadow-soft">
            <p className="text-body text-charcoal">No active deliveries</p>
            <p className="mt-1 text-body-sm text-muted-foreground">
              Go online and the admin will assign orders to you as they become ready.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {active.map((d) => (
            <article key={d.id} className="rounded-2xl bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-body-sm font-bold text-charcoal">
                    #{d.id.slice(0, 6).toUpperCase()}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-caption font-semibold text-primary">
                  {STATUS_LABEL[d.status]}
                </span>
              </div>

              <p className="mt-3 flex gap-2 text-body-sm text-charcoal">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                {d.delivery_address ?? "No address on file"}
              </p>
              <p className="mt-1.5 flex gap-2 text-body-sm text-charcoal">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                {d.profiles?.full_name ?? "Customer"}
                {d.profiles?.phone ? ` · ${d.profiles.phone}` : ""}
              </p>

              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-body-sm text-charcoal">
                {d.order_items.map((it) => (
                  <li key={it.id}>
                    {it.quantity}× {it.menu_items?.name ?? "Item"}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-body-sm text-muted-foreground">
                  {d.payment_status === "paid" ? "Paid" : `Collect ${formatUGX(d.total)}`}
                </span>
                <span className="text-body font-bold text-charcoal">{formatUGX(d.total)}</span>
              </div>

              <div className="mt-4 flex gap-2">
                {NEXT[d.status] && (
                  <button
                    onClick={() => advance(d)}
                    className="motion-button-elevate flex-1 rounded-[var(--radius-button)] bg-primary py-2.5 text-body-sm font-semibold text-primary-foreground"
                  >
                    {NEXT[d.status]!.label}
                  </button>
                )}
                <button
                  onClick={() => setReceipt(d)}
                  className="rounded-[var(--radius-button)] border border-input px-4 py-2.5 text-body-sm text-charcoal"
                >
                  Receipt
                </button>
              </div>
            </article>
          ))}
        </div>

        {done.length > 0 && (
          <>
            <h2 className="mt-8 text-body font-semibold text-charcoal">Completed</h2>
            <div className="mt-3 space-y-2">
              {done.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setReceipt(d)}
                  className="flex w-full items-center justify-between rounded-[12px] bg-card px-4 py-3 text-left shadow-soft"
                >
                  <span className="text-body-sm text-charcoal">
                    #{d.id.slice(0, 6).toUpperCase()} · {new Date(d.updated_at).toLocaleDateString()}
                  </span>
                  <span className="text-body-sm font-semibold text-charcoal">
                    {formatUGX(d.total)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {receipt && <ReceiptModal delivery={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function ReceiptModal({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:static print:bg-transparent print:p-0">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl print:bg-paper print:text-ink print:max-w-none print:shadow-none">
        <div className="flex items-start justify-between print:hidden">
          <h2 className="text-body font-bold text-charcoal">Delivery receipt</h2>
          <button onClick={onClose} aria-label="Close receipt">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div id="receipt" className="mt-4 text-charcoal">
          <div className="text-center">
            <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Mood Box
            </p>
            <p className="text-caption text-muted-foreground">Good Food, Good Mood</p>
            <p className="mt-2 text-caption text-muted-foreground">
              Receipt #{delivery.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <dl className="mt-4 space-y-1 border-y border-dashed border-border py-3 text-caption">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Customer</dt>
              <dd>{delivery.profiles?.full_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{delivery.profiles?.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">Address</dt>
              <dd className="text-right">{delivery.delivery_address ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ordered</dt>
              <dd>{new Date(delivery.created_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivered</dt>
              <dd>
                {delivery.status === "delivered"
                  ? new Date(delivery.updated_at).toLocaleString()
                  : "Pending"}
              </dd>
            </div>
          </dl>

          <table className="mt-3 w-full text-caption">
            <tbody>
              {delivery.order_items.map((it) => {
                const opts = optionLabels(it.selected_options);
                return (
                  <tr key={it.id} className="align-top">
                    <td className="py-1">
                      {it.quantity}× {it.menu_items?.name ?? "Item"}
                      {opts.length > 0 && (
                        <span className="block text-muted-foreground">+ {opts.join(", ")}</span>
                      )}
                    </td>
                    <td className="py-1 text-right">{formatUGX(it.line_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <dl className="mt-3 space-y-1 border-t border-dashed border-border pt-3 text-caption">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatUGX(delivery.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>{formatUGX(delivery.delivery_fee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd>{formatUGX(delivery.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-body-sm font-bold">
              <dt>Total</dt>
              <dd>{formatUGX(delivery.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment</dt>
              <dd>
                {delivery.payment_method ?? "Cash"} ·{" "}
                {delivery.payment_status === "paid" ? "Paid" : "Due on delivery"}
              </dd>
            </div>
          </dl>

          {delivery.special_instructions && (
            <p className="mt-3 text-caption text-muted-foreground">
              Note: {delivery.special_instructions}
            </p>
          )}

          <p className="mt-4 text-center text-caption text-muted-foreground">
            Thank you for ordering with Mood Box.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="motion-button-elevate mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--radius-button)] bg-primary py-2.5 text-body-sm font-semibold text-primary-foreground print:hidden"
        >
          <Printer className="h-4 w-4" /> Print / save as PDF
        </button>
      </div>
    </div>
  );
}
