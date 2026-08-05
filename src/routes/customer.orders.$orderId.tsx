import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatUGX } from "@/hooks/use-cart";

export const Route = createFileRoute("/customer/orders/$orderId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Order tracking — Moodbox" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderTracking,
});

const STAGES = [
  { key: "pending", label: "Order Received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "assigned", label: "Driver Assigned" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  pending: { label: "Order received", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  confirmed: { label: "Confirmed", className: "bg-secondary/15 text-secondary" },
  preparing: { label: "In the kitchen", className: "bg-secondary/15 text-secondary" },
  ready: { label: "Ready", className: "bg-secondary/20 text-secondary" },
  assigned: { label: "Driver assigned", className: "bg-primary/15 text-primary" },
  out_for_delivery: { label: "Out for delivery", className: "bg-primary/20 text-primary" },
  delivered: { label: "Delivered", className: "bg-secondary/20 text-secondary" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
};

interface OrderDetail {
  id: string;
  status: string;
  payment_method: string | null;
  payment_status: string;
  delivery_address: string | null;
  special_instructions: string | null;
  estimated_delivery_at: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  items: {
    id: string;
    quantity: number;
    line_total: number;
    selected_options: unknown;
    menu_items: { name: string; image_url: string | null } | null;
  }[];
}


function OrderTracking() {
  const { orderId } = Route.useParams();
  const auth = useAuth();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<OrderDetail | null> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, payment_method, payment_status, delivery_address, special_instructions, estimated_delivery_at, subtotal, delivery_fee, total, created_at, order_items:order_items(id, quantity, line_total, selected_options, menu_items:menu_items(name, image_url))",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        items: (data as unknown as { order_items: OrderDetail["items"] }).order_items,
      };
    },
  });

  // realtime: refetch on any change to this order
  useEffect(() => {
    if (!orderId) return;
    const ch = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, qc]);

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!order)
    return (
      <div className="p-10 text-center">
        <p className="text-body text-charcoal">Order not found.</p>
        <Link to="/customer/orders" className="mt-3 inline-block text-body-sm text-primary underline">
          Back to my orders
        </Link>
      </div>
    );

  const currentIdx = STAGES.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/customer/orders" className="text-body-sm text-primary hover:underline">
        ← My orders
      </Link>
      <p className="mt-4 text-eyebrow">Order #{order.id.slice(0, 8)}</p>
      <h1 className="mt-1 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        {isCancelled ? "Order cancelled" : "Tracking your order"}
      </h1>
      <p className="mt-1 text-body-sm text-muted-foreground">
        Placed {new Date(order.created_at).toLocaleString()}
      </p>

      {/* Timeline */}
      {isCancelled ? (
        <div className="mt-8 rounded-[16px] border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          This order was cancelled. Please contact us if this looks wrong.
        </div>
      ) : (
        <ol className="mt-8 space-y-4">
          {STAGES.map((s, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <li key={s.key} className="flex items-center gap-4">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full ${
                    done || active ? "bg-secondary text-secondary-foreground" : "bg-surface text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-5 w-5" /> : <span className="text-body-sm font-bold">{idx + 1}</span>}
                </span>
                <span
                  className={`text-body ${
                    active ? "font-bold text-charcoal" : done ? "text-charcoal" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                  {active && <span className="ml-2 text-caption text-secondary">· in progress</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[20px] bg-card p-6 shadow-soft">
          <h2 className="text-h3 text-charcoal">Items</h2>
          <ul className="mt-3 space-y-3">
            {order.items?.map((it) => (
              <li key={it.id} className="flex justify-between gap-3 text-body-sm">
                <span className="text-charcoal">
                  {it.quantity}× {it.menu_items?.name ?? "Item"}
                </span>
                <span className="text-charcoal">{formatUGX(it.line_total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-border pt-3 text-body-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatUGX(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>{formatUGX(order.delivery_fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-body">
              <dt className="font-semibold">Total</dt>
              <dd className="font-bold text-secondary">{formatUGX(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[20px] bg-card p-6 shadow-soft">
          <h2 className="text-h3 text-charcoal">Delivery</h2>
          <p className="mt-2 text-body-sm text-charcoal">{order.delivery_address}</p>
          {order.special_instructions && (
            <p className="mt-2 text-caption text-muted-foreground">{order.special_instructions}</p>
          )}
          <h2 className="mt-6 text-h3 text-charcoal">Payment</h2>
          <p className="mt-2 text-body-sm text-charcoal">
            {order.payment_method ?? "—"} · {order.payment_status}
          </p>
        </section>
      </div>

      {order.status === "delivered" && auth.status === "signed-in" && (
        <ReviewCard orderId={order.id} customerId={auth.user!.id} />
      )}
    </div>
  );
}

function ReviewCard({ orderId, customerId }: { orderId: string; customerId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (data) setDone(true);
    })();
  }, [orderId]);

  const submit = async () => {
    if (rating < 1) {
      toast.error("Pick a rating first");
      return;
    }
    const { error } = await supabase
      .from("reviews")
      .insert({ order_id: orderId, customer_id: customerId, rating, comment: comment || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("Thanks for your review!");
  };

  if (done) return null;

  return (
    <section className="mt-8 rounded-[20px] bg-card p-6 shadow-soft">
      <h2 className="text-h3 text-charcoal">How was it?</h2>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${n} star`}
            onClick={() => setRating(n)}
            className="p-1"
          >
            <Star
              className={`h-8 w-8 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Tell us more (optional)"
        className="mt-3 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        onClick={submit}
        className="motion-button-elevate mt-3 rounded-[12px] bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground"
      >
        Submit review
      </button>
    </section>
  );
}
