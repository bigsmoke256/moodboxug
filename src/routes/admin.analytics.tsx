import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download, FileSpreadsheet, Presentation } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatUGX } from "@/hooks/use-cart";
import {
  exportExcel,
  exportPptx,
  getRange,
  loadReportData,
  type ReportPeriod,
} from "@/lib/reports";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

const PRESETS: { id: ReportPeriod; label: string }[] = [
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom range" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AdminAnalytics() {
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [busy, setBusy] = useState<"xlsx" | "pptx" | null>(null);

  const range = useMemo(
    () =>
      getRange(period, period === "custom" ? { start: new Date(start), end: new Date(end) } : undefined),
    [period, start, end],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", range.start.toISOString(), range.end.toISOString()],
    queryFn: () => loadReportData(range),
  });

  const daily = (data?.daily ?? []).map((d) => ({
    ...d,
    short: d.day.slice(5),
    avg: d.orders > 0 ? d.revenue / d.orders : 0,
  }));
  const hasData = daily.some((d) => d.orders > 0);

  const download = async (kind: "xlsx" | "pptx") => {
    if (!data) return;
    setBusy(kind);
    try {
      if (kind === "xlsx") exportExcel(data);
      else await exportPptx(data);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <p className="text-eyebrow">Insights</p>
      <h1 className="mt-2 text-display-2 text-foreground" style={{ fontFamily: "var(--font-display)" }}>
        Analytics
      </h1>
      <p className="mt-1 text-body-sm text-muted-foreground">{range.label}</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`rounded-pill px-4 py-2 text-body-sm transition-colors ${
              period === p.id
                ? "bg-secondary text-secondary-foreground"
                : "bg-card text-foreground shadow-soft hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}

        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-input border border-border bg-card px-3 py-2 text-body-sm text-foreground"
            />
            <span className="text-body-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-input border border-border bg-card px-3 py-2 text-body-sm text-foreground"
            />
          </div>
        )}

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => download("xlsx")}
            disabled={!data || busy !== null}
            className="inline-flex items-center gap-2 rounded-button bg-secondary px-4 py-2 text-body-sm text-secondary-foreground disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {busy === "xlsx" ? "Preparing…" : "Excel"}
          </button>
          <button
            onClick={() => download("pptx")}
            disabled={!data || busy !== null}
            className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2 text-body-sm text-primary-foreground disabled:opacity-50"
          >
            <Presentation className="h-4 w-4" />
            {busy === "pptx" ? "Building…" : "PowerPoint"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 h-64 animate-pulse rounded-card bg-card" />
      ) : !data || !hasData ? (
        <div className="mt-8">
          <EmptyState icon={BarChart3} title="No data in this range" description="Pick another range, or wait for orders to roll in." />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Revenue", value: formatUGX(data.totals.revenue) },
              { label: "Orders", value: String(data.totals.orders) },
              { label: "Average order", value: formatUGX(data.totals.avgOrder) },
              {
                label: "Delivered / cancelled",
                value: `${data.totals.delivered} / ${data.totals.cancelled}`,
              },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-card bg-card p-5 shadow-soft">
                <p className="text-caption text-muted-foreground">{kpi.label}</p>
                <p className="mt-2 text-h2 text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-card bg-card p-6 shadow-soft">
              <h2 className="text-h3 text-foreground">Daily revenue</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer>
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="short" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatUGX(v)} width={90} />
                    <Tooltip formatter={(v: number) => formatUGX(v)} />
                    <Bar dataKey="revenue" fill="var(--coral)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="rounded-card bg-card p-6 shadow-soft">
              <h2 className="text-h3 text-foreground">Daily orders &amp; basket size</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer>
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="short" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="orders" stroke="var(--turquoise)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Daily sell-through table */}
          <section className="mt-6 overflow-hidden rounded-card bg-card shadow-soft">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-h3 text-foreground">Day by day</h2>
              <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
                <Download className="h-3.5 w-3.5" /> Included in every export
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="bg-muted text-left text-caption uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Orders</th>
                    <th className="px-6 py-3 font-medium">Revenue</th>
                    <th className="px-6 py-3 font-medium">Average order</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.day} className="border-t border-border">
                      <td className="px-6 py-3 text-foreground">{d.day}</td>
                      <td className="px-6 py-3 text-foreground">{d.orders}</td>
                      <td className="px-6 py-3 text-foreground">{formatUGX(d.revenue)}</td>
                      <td className="px-6 py-3 text-muted-foreground">{formatUGX(d.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top items + insights */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-card bg-card p-6 shadow-soft">
              <h2 className="text-h3 text-foreground">Best sellers</h2>
              <ul className="mt-4 space-y-3">
                {data.topItems.slice(0, 8).map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-4">
                    <span className="truncate text-foreground">{item.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.qty} sold · {formatUGX(item.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-card bg-card p-6 shadow-soft">
              <h2 className="text-h3 text-foreground">What happened</h2>
              <ul className="mt-4 space-y-3">
                {data.insights.map((line) => (
                  <li key={line} className="flex gap-2 text-body-sm text-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
