import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatUGX } from "@/hooks/use-cart";

export const Route = createFileRoute("/customer/orders/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My Orders — Moodbox" }, { name: "robots", content: "noindex" }],
  }),
  component: MyOrders,
});

interface OrderRow {
  id: string;
  status: string;
  total: number;
  created_at: string;
  payment_method: string | null;
  payment_status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  assigned: "Driver assigned",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function MyOrders() {
  const auth = useAuth();
  const userId = auth.status === "signed-in" ? auth.user?.id : null;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", userId],
    enabled: !!userId,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, created_at, payment_method, payment_status")
        .eq("customer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (auth.status === "loading") return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (auth.status === "signed-out")
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-body text-charcoal">Sign in to see your orders.</p>
        <Link to="/auth" className="mt-4 inline-block rounded-[12px] bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground">
          Sign in
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-eyebrow">Your orders</p>
      <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        My orders
      </h1>

      <div className="mt-8 space-y-3">
        {isLoading && <p className="text-body-sm text-muted-foreground">Loading orders…</p>}
        {!isLoading && orders.length === 0 && (
          <div className="rounded-[20px] bg-card p-8 text-center shadow-soft">
            <p className="text-body text-charcoal">You haven't placed any orders yet.</p>
            <Link
              to="/customer"
              className="mt-4 inline-block rounded-[12px] bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground"
            >
              Explore menu
            </Link>
          </div>
        )}
        {orders.map((o) => (
          <Link
            key={o.id}
            to="/customer/orders/$orderId"
            params={{ orderId: o.id }}
            className="motion-card-lift flex items-center justify-between rounded-[16px] bg-card p-4 shadow-soft"
          >
            <div>
              <p className="text-body-sm text-muted-foreground">
                #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
              </p>
              <p className="mt-1 text-body font-semibold text-charcoal">
                {STATUS_LABEL[o.status] ?? o.status}
              </p>
              <p className="text-caption text-muted-foreground">
                Payment: {o.payment_method ?? "—"} · {o.payment_status}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-body font-bold text-secondary">{formatUGX(o.total)}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
