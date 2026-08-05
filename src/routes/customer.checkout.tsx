import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, LocateFixed, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCart, formatUGX } from "@/hooks/use-cart";
import { useGeolocate } from "@/hooks/use-geolocate";
import { FulfillmentToggle } from "@/components/customer/FulfillmentToggle";
import { placeOrder, type PlaceOrderResult } from "@/lib/orders.functions";


const RESTAURANT_ID = "61548a61-12cb-4a04-ad26-d57264e9e436";

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
  const place = useServerFn(placeOrder);

  const { data: pricing } = useQuery({
    queryKey: ["restaurant-pricing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("settings")
        .eq("id", RESTAURANT_ID)
        .maybeSingle();
      const s = (data?.settings ?? {}) as { delivery_fee?: number; tax_rate?: number };
      return {
        deliveryFee: Number(s.delivery_fee ?? 5000),
        taxRate: Math.max(0, Math.min(100, Number(s.tax_rate ?? 0))),
      };
    },
  });

  const isPickup = cart.fulfillment === "pickup";
  const displayDeliveryFee =
    cart.lines.length > 0 && !isPickup ? (pricing?.deliveryFee ?? cart.deliveryFee) : 0;
  const displayTax = useMemo(() => {
    const rate = pricing?.taxRate ?? 0;
    return Math.round(((cart.subtotal - cart.discount) * rate) / 100);
  }, [cart.subtotal, cart.discount, pricing?.taxRate]);
  const displayTotal = Math.max(0, cart.subtotal + displayDeliveryFee + displayTax - cart.discount);

  const [form, setForm] = useState({ fullName: "", phone: "", email: "", address: "", notes: "" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const geo = useGeolocate();
  const [method, setMethod] = useState<Method>("card");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placed, setPlaced] = useState(false);

  const useMyLocation = async () => {
    const res = await geo.locate();
    if (!res) return;
    setCoords({ lat: res.lat, lng: res.lng });
    if (res.address) {
      setForm((f) => ({ ...f, address: res.address }));
      setErrors((e) => ({ ...e, address: "" }));
    }
    toast.success("Location pinned");
  };


  useEffect(() => {
    if (auth.status === "signed-out") {
      navigate({ to: "/auth", search: { redirect: "/customer/checkout" } });
    }
    if (auth.status === "signed-in") {
      setForm((f) => ({ ...f, email: f.email || auth.user?.email || "" }));
    }
  }, [auth.status, auth.user, navigate]);

  useEffect(() => {
    if (cart.lines.length === 0 && !placed) navigate({ to: "/customer" });
  }, [cart.lines.length, navigate, placed]);

  const mutation = useMutation<PlaceOrderResult>({
    mutationFn: () =>
      place({
        data: {
          lines: cart.lines.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            options: l.options.map((o) => ({ group: o.group, name: o.name })),
          })),
          promoCode: cart.promo?.code ?? null,
          paymentMethod: method,
          fulfillment: cart.fulfillment,
          delivery: {
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            address: isPickup ? "" : form.address.trim(),
            notes: form.notes.trim(),
            lat: isPickup ? null : (coords?.lat ?? null),
            lng: isPickup ? null : (coords?.lng ?? null),
          },
        },
      }),
    onSuccess: (result) => {
      if (result.ok) {
        setPlaced(true);
        cart.clear();
        toast.success("Order placed! Track it below.");
        navigate({ to: "/customer/orders/$orderId", params: { orderId: result.orderId } });
        return;
      }
      if (result.error === "unavailable") {
        toast.error(
          `No longer available: ${result.unavailableNames.join(", ")}. Please remove from cart.`,
          { duration: 6000 },
        );
      } else if (result.error === "invalid_option") {
        toast.error(`An option is no longer available: ${result.detail}. Please re-add the item.`);
      }
    },
    onError: (err) => {
      const isNetwork = err instanceof TypeError && /fetch/i.test(err.message);
      toast.error(
        isNetwork
          ? "Connection issue — please retry."
          : err instanceof Error
            ? err.message
            : "Could not place your order",
      );
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 2) e.fullName = "Please enter your full name";
    if (form.phone.trim().length < 6) e.phone = "Please enter a valid phone number";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Invalid email";
    if (form.address.trim().length < 4) e.address = "Delivery address is required";
    if (form.notes.length > 500) e.notes = "Notes too long";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.status !== "signed-in") {
      navigate({ to: "/auth", search: { redirect: "/customer/checkout" } });
      return;
    }
    if (!validate()) {
      toast.error("Please check the highlighted fields");
      return;
    }
    if (mutation.isPending) return; // dedupe safety net
    mutation.mutate();
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
        <form onSubmit={submit} className="space-y-6" noValidate>
          <section className="rounded-[20px] bg-card p-6 shadow-soft">
            <h2 className="text-h3 text-charcoal">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                required
                value={form.fullName}
                onChange={(v) => setForm({ ...form, fullName: v })}
                error={errors.fullName}
              />
              <Field
                label="Phone"
                required
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                error={errors.phone}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Email (optional)"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  error={errors.email}
                />
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
                error={errors.address}
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
                {errors.notes && <p className="mt-1 text-caption text-destructive">{errors.notes}</p>}
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
            disabled={mutation.isPending}
            className="motion-button-elevate w-full rounded-[12px] bg-primary py-4 text-body font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending ? "Placing order…" : `Place Order · ${formatUGX(displayTotal)}`}
          </button>
          <p className="text-caption text-muted-foreground">
            The final total is recomputed server-side from current prices — this display total is a preview.
          </p>
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
            <Row label="Delivery" value={formatUGX(displayDeliveryFee)} />
            {displayTax > 0 && <Row label={`Tax (${pricing?.taxRate}%)`} value={formatUGX(displayTax)} />}
            {cart.discount > 0 && <Row label={`Discount (${cart.promo?.code})`} value={`-${formatUGX(cart.discount)}`} accent />}
            <div className="flex justify-between border-t border-border pt-2 text-body">
              <dt className="font-semibold text-charcoal">Total</dt>
              <dd className="font-bold text-secondary">{formatUGX(displayTotal)}</dd>
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
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  error?: string;
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
        aria-invalid={!!error}
        className={`mt-1 w-full rounded-[12px] border bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring ${
          error ? "border-destructive" : "border-input"
        }`}
      />
      {error && <p className="mt-1 text-caption text-destructive">{error}</p>}
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
