import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, DollarSign, ShoppingBag, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatUGX } from "@/hooks/use-cart";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [ordersToday, revenue, active, customers] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()),
        supabase.from("orders").select("total").gte("created_at", start.toISOString()),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery"]),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const revenueSum = (revenue.data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
      return {
        ordersToday: ordersToday.count ?? 0,
        revenueToday: revenueSum,
        activeOrders: active.count ?? 0,
        customers: customers.count ?? 0,
      };
    },
    refetchInterval: 30_000,
  });

  return (
    <div>
      <p className="text-eyebrow">Today</p>
      <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        Overview
      </h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ShoppingBag} label="Orders today" value={isLoading ? "…" : String(data?.ordersToday ?? 0)} />
        <Stat icon={DollarSign} label="Revenue today" value={isLoading ? "…" : formatUGX(data?.revenueToday ?? 0)} />
        <Stat icon={ChefHat} label="Active orders" value={isLoading ? "…" : String(data?.activeOrders ?? 0)} />
        <Stat icon={Users} label="Customers" value={isLoading ? "…" : String(data?.customers ?? 0)} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink to="/admin/orders" title="Orders kanban" description="Move orders through prep and delivery." />
        <QuickLink to="/admin/menu" title="Menu editor" description="Add, update, or hide items." />
        <QuickLink to="/admin/promotions" title="Promotions" description="Manage promo codes and campaigns." />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] bg-card p-5 shadow-soft">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary/15 text-secondary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-caption text-muted-foreground">{label}</p>
      <p className="mt-1 text-h2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
    </div>
  );
}

function QuickLink({ to, title, description }: { to: "/admin/orders" | "/admin/menu" | "/admin/promotions"; title: string; description: string }) {
  return (
    <Link to={to} className="motion-card-lift block rounded-[16px] bg-card p-5 shadow-soft">
      <h3 className="text-h3 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h3>
      <p className="mt-1 text-body-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
