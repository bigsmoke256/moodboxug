import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreditCard, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCart, formatUGX } from "@/hooks/use-cart";

export const Route = createFileRoute("/customer/checkout")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Checkout — Moodbox" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const RESTAURANT_ID = "61548a61-12cb-4a04-ad26-d57264e9e436";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  address: z.string().trim().min(4).max(500),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

type Method = "card" | "mtn_momo" | "airtel_money";

const METHODS: { id: Method; label: string; icon: typeof CreditCard; sub: string }[] = [
  { id: "card", label: "Card", icon: CreditCard, sub: "Visa / Mastercard" },
  { id: "mtn_momo", label: "MTN Mobile Money", icon: Smartphone, sub: "You'll receive a prompt" },
  { id: "airtel_money", label: "Airtel Money", icon: Smartphone, sub: "You'll receive a prompt" },
];

function CheckoutPage() {
  const cart = useCart();
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", address: "", notes: "" });
  const [method, setMethod] = useState<Method>("card");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.status === "signed-out") {
      navigate({ to: "/auth" });
    }
    if (auth.status === "signed-in") {
      setForm((f) => ({
        ...f,
        email: f.email || auth.user?.email || "",
      }));
    }
  }, [auth.status, auth.user, navigate]);

  useEffect(() => {
    if (cart.lines.length === 0 && !submitting) {
      // Redirect back if cart empty
      navigate({ to: "/customer" });
    }
  }, [cart.lines.length, navigate, submitting]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.status !== "signed-in" || !auth.user) {
      toast.error("Please sign in first");
      navigate({ to: "/auth" });
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setSubmitting(true);
    try {
      const combinedInstructions = [
        parsed.data.notes ? `Notes: ${parsed.data.notes}` : "",
        `Contact: ${parsed.data.fullName} · ${parsed.data.phone}`,
      ]
        .filter(Boolean)
        .join(" | ");

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          customer_id: auth.user.id,
          restaurant_id: RESTAURANT_ID,
          status: "pending",
          payment_status: "pending",
          payment_method: method,
          delivery_address: parsed.data.address,
          special_instructions: combinedInstructions,
          promo_code: cart.promo?.code ?? null,
          subtotal: cart.subtotal,
          delivery_fee: cart.deliveryFee,
          tax: 0,
          total: cart.total,
        })
        .select("id")
        .single();
      if (orderErr || !order) throw orderErr ?? new Error("Order failed");

      const items = cart.lines.map((l) => {
        const optExtras = l.options.reduce((s, o) => s + o.priceDelta, 0);
        return {
          order_id: order.id,
          menu_item_id: l.menuItemId,
          quantity: l.quantity,
          selected_options: JSON.parse(JSON.stringify(l.options)),
          line_total: (l.basePrice + optExtras) * l.quantity,
        };
      });
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      const { error: histErr } = await supabase.from("order_status_history").insert({
        order_id: order.id,
        status: "pending",
        changed_by: auth.user.id,
      });
      if (histErr) throw histErr;

      cart.clear();
      toast.success("Order placed! Track it below.");
      navigate({ to: "/customer/orders/$orderId", params: { orderId: order.id } });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not place your order");
      setSubmitting(false);
    }
  };

  if (auth.status === "loading") {
    return <div className="grid min-h-[50vh] place-items-center text-body-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-eyebrow">Checkout</p>
      <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        Almost there
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="space-y-6">
          <section className="rounded-[20px] bg-card p-6 shadow-soft">
            <h2 className="text-h3 text-charcoal">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
              <Field label="Phone" required type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <div className="sm:col-span-2">
                <Field label="Email (optional)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              </div>
            </div>
          </section>

          <section className="rounded-[20px] bg-card p-6 shadow-soft">
            <h2 className="text-h3 text-charcoal">Delivery</h2>
            <div className="mt-4 grid gap-4">
              <Field
                label="Delivery address"
                required
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
                placeholder="Street, building, apartment"
              />
              <div>
                <label className="text-body-sm font-medium text-charcoal">Notes / landmarks</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  maxLength={500}
                  className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Gate colour, floor, etc."
                />
              </div>
            </div>
          </section>

          <section className="rounded-[20px] bg-card p-6 shadow-soft">
            <h2 className="text-h3 text-charcoal">Payment method</h2>
            <p className="mt-1 text-body-sm text-muted-foreground">
              You'll be contacted to complete payment via your selected method.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {METHODS.map(({ id, label, icon: Icon, sub }) => {
                const active = method === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMethod(id)}
                    className={`flex flex-col items-start gap-2 rounded-[16px] border-2 p-4 text-left transition-all ${
                      active ? "border-primary bg-primary/5" : "border-input hover:border-secondary"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${active ? "text-primary" : "text-charcoal"}`} />
                    <div>
                      <p className="text-body-sm font-semibold text-charcoal">{label}</p>
                      <p className="text-caption text-muted-foreground">{sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting}
            className="motion-button-elevate w-full rounded-[12px] bg-primary py-4 text-body font-semibold text-primary-foreground disabled:opacity-70"
          >
            {submitting ? "Placing order…" : `Place Order · ${formatUGX(cart.total)}`}
          </button>
        </form>

        <aside className="h-fit space-y-3 rounded-[20px] bg-card p-6 shadow-soft lg:sticky lg:top-24">
          <h2 className="text-h3 text-charcoal">Order summary</h2>
          <ul className="space-y-3">
            {cart.lines.map((l) => {
              const optExtras = l.options.reduce((s, o) => s + o.priceDelta, 0);
              return (
                <li key={l.key} className="flex justify-between gap-3 text-body-sm">
                  <div>
                    <p className="text-charcoal">
                      {l.quantity}× {l.name}
                    </p>
                    {l.options.length > 0 && (
                      <p className="text-caption text-muted-foreground">
                        {l.options.map((o) => o.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="text-charcoal">{formatUGX((l.basePrice + optExtras) * l.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-border pt-3 text-body-sm">
            <Row label="Subtotal" value={formatUGX(cart.subtotal)} />
            <Row label="Delivery" value={formatUGX(cart.deliveryFee)} />
            {cart.discount > 0 && <Row label={`Discount (${cart.promo?.code})`} value={`-${formatUGX(cart.discount)}`} accent />}
            <div className="flex justify-between border-t border-border pt-2 text-body">
              <dt className="font-semibold text-charcoal">Total</dt>
              <dd className="font-bold text-secondary">{formatUGX(cart.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-body-sm font-medium text-charcoal">{label}</label>
      <input
        required={required}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={accent ? "text-secondary" : "text-charcoal"}>{value}</dd>
    </div>
  );
}
