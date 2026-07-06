import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatUGX } from "@/hooks/use-cart";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 13);
      since.setHours(0, 0, 0, 0);
      const { data: orders, error } = await supabase
        .from("orders")
        .select("created_at, total")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      // bucket by day
      const buckets = new Map<string, { day: string; orders: number; revenue: number }>();
      for (let i = 0; i < 14; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        buckets.set(key, { day: key.slice(5), orders: 0, revenue: 0 });
      }
      for (const o of orders ?? []) {
        const key = o.created_at.slice(0, 10);
        const b = buckets.get(key);
        if (!b) continue;
        b.orders += 1;
        b.revenue += Number(o.total ?? 0);
      }
      return Array.from(buckets.values());
    },
  });

  return (
    <div>
      <p className="text-eyebrow">Insights</p>
      <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        Analytics
      </h1>

      {isLoading ? (
        <div className="mt-8 h-64 animate-pulse rounded-[16px] bg-card" />
      ) : !data || data.every((d) => d.orders === 0) ? (
        <div className="mt-8">
          <EmptyState icon={BarChart3} title="No data yet" description="Analytics fill in as orders roll in." />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[20px] bg-card p-6 shadow-soft">
            <h2 className="text-h3 text-charcoal">Orders — last 14 days</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="var(--turquoise)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="rounded-[20px] bg-card p-6 shadow-soft">
            <h2 className="text-h3 text-charcoal">Revenue — last 14 days</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatUGX(v)} width={90} />
                  <Tooltip formatter={(v: number) => formatUGX(v)} />
                  <Bar dataKey="revenue" fill="var(--coral)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
