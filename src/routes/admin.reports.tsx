import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Download, FileSpreadsheet, FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  exportExcel,
  exportPptx,
  getRange,
  loadReportData,
  type ReportPeriod,
} from "@/lib/reports";
import { formatUGX } from "@/hooks/use-cart";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports;
});

const PERIODS: { id: ReportPeriod; label: string; description: string }[] = [
  { id: "week", label: "This Week", description: "Last 7 days rolling" },
  { id: "month", label: "This Month", description: "From 1st to today" },
  { id: "year", label: "This Year", description: "Full year to date" },
  { id: "custom", label: "Custom Range", description: "Pick start and end date" },
];

function AdminReports() {
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);

  const range = getRange(period, { start: new Date(startDate), end: new Date(endDate) });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-report", period, startDate, endDate],
    queryFn: () => loadReportData(range),
  });

  const download = async (kind: "excel" | "pptx") => {
    if (!data) return;
    try {
      if (kind === "excel") {
        exportExcel(data);
        toast.success("Excel report downloaded");
      } else {
        await exportPptx(data);
        toast.success("PowerPoint report downloaded");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-eyebrow">Business Intelligence</p>
        <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
          Reports
        </h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Auto-generated performance reports with insights, charts, and full order history. Download as Excel or PowerPoint.
        </p>
      </div>

      {/* Period picker */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PERIODS.map((p) => {
          const active = period === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-[16px] border p-4 text-left transition-all ${
                active
                  ? "border-secondary bg-secondary/5 shadow-soft"
                  : "border-border bg-card hover:border-secondary/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className={`h-4 w-4 ${active ? "text-secondary" : "text-muted-foreground"}`} />
                <span className="text-body-sm font-semibold text-charcoal">{p.label}</span>
              </div>
              <p className="mt-1 text-caption text-muted-foreground">{p.description}</p>
            </button>
          );
        })}
      </section>

      {period === "custom" && (
        <section className="flex flex-wrap items-end gap-3 rounded-[16px] bg-card p-4 shadow-soft">
          <div>
            <label className="text-caption text-muted-foreground">Start</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block rounded-[10px] border border-border bg-background px-3 py-2 text-body-sm"
            />
          </div>
          <div>
            <label className="text-caption text-muted-foreground">End</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block rounded-[10px] border border-border bg-background px-3 py-2 text-body-sm"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="rounded-[10px] bg-charcoal px-4 py-2 text-body-sm font-semibold text-white"
          >
            Update
          </button>
        </section>
      )}

      {/* Header row w/ downloads */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-card p-5 shadow-soft">
        <div>
          <h2 className="text-h3 text-charcoal">{range.label}</h2>
          <p className="text-caption text-muted-foreground">
            {isFetching ? "Loading…" : `${data?.totals.orders ?? 0} orders • ${formatUGX(data?.totals.revenue ?? 0)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => download("excel")}
            disabled={!data || isFetching}
            className="motion-button-elevate flex items-center gap-2 rounded-[10px] bg-secondary px-4 py-2 text-body-sm font-semibold text-secondary-foreground disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={() => download("pptx")}
            disabled={!data || isFetching}
            className="motion-button-elevate flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-body-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> PowerPoint
          </button>
        </div>
      </section>

      {isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-[16px] bg-card" />
      ) : (
        <>
          {/* KPIs */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi label="Orders" value={String(data.totals.orders)} />
            <Kpi label="Revenue" value={formatUGX(data.totals.revenue)} />
            <Kpi label="Avg order value" value={formatUGX(data.totals.avgOrder)} />
            <Kpi label="Delivered" value={String(data.totals.delivered)} />
            <Kpi label="Cancelled" value={String(data.totals.cancelled)} />
            <Kpi label="New customers" value={String(data.totals.newCustomers)} />
          </section>

          {/* Insights */}
          <section className="rounded-[20px] bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-secondary" />
              <h2 className="text-h3 text-charcoal">Insights & Analysis</h2>
            </div>
            <ul className="mt-4 space-y-2 text-body-sm text-charcoal">
              {data.insights.map((i, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Top items */}
          {data.topItems.length > 0 && (
            <section className="rounded-[20px] bg-card p-6 shadow-soft">
              <h2 className="text-h3 text-charcoal">Top-selling items</h2>
              <div className="mt-4 overflow-hidden rounded-[12px] border border-border">
                <table className="w-full text-body-sm">
                  <thead className="bg-surface text-caption text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-right">Qty sold</th>
                      <th className="px-4 py-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topItems.map((it) => (
                      <tr key={it.name} className="border-t border-border">
                        <td className="px-4 py-2 text-charcoal">{it.name}</td>
                        <td className="px-4 py-2 text-right">{it.qty}</td>
                        <td className="px-4 py-2 text-right">{formatUGX(it.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Top customers */}
          {data.topCustomers.length > 0 && (
            <section className="rounded-[20px] bg-card p-6 shadow-soft">
              <h2 className="text-h3 text-charcoal">Top customers</h2>
              <div className="mt-4 overflow-hidden rounded-[12px] border border-border">
                <table className="w-full text-body-sm">
                  <thead className="bg-surface text-caption text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-right">Orders</th>
                      <th className="px-4 py-2 text-right">Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCustomers.map((c, i) => (
                      <tr key={c.name + i} className="border-t border-border">
                        <td className="px-4 py-2 text-charcoal">{c.name}</td>
                        <td className="px-4 py-2 text-right">{c.orders}</td>
                        <td className="px-4 py-2 text-right">{formatUGX(c.spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Orders table preview */}
          <section className="rounded-[20px] bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-h3 text-charcoal">Order log</h2>
              <span className="text-caption text-muted-foreground">
                {data.orders.length} rows — full history included in Excel export
              </span>
            </div>
            <div className="mt-4 max-h-[420px] overflow-auto rounded-[12px] border border-border">
              <table className="w-full text-body-sm">
                <thead className="sticky top-0 bg-surface text-caption text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Order</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Payment</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.slice(0, 50).map((o) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-caption">{o.id}</td>
                      <td className="px-4 py-2">{o.created_at}</td>
                      <td className="px-4 py-2 text-charcoal">{o.customer}</td>
                      <td className="px-4 py-2 capitalize">{o.status.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2 capitalize">{o.payment_method}</td>
                      <td className="px-4 py-2 text-right">{formatUGX(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Download footer */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-charcoal p-6 text-white">
            <div className="flex items-center gap-3">
              <Download className="h-6 w-6 text-turquoise" />
              <div>
                <h3 className="text-h3">Ready to share</h3>
                <p className="text-body-sm text-white/70">Both formats include charts, KPIs, and full order history.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => download("excel")}
                disabled={!data}
                className="flex items-center gap-2 rounded-[10px] bg-secondary px-4 py-2 text-body-sm font-semibold text-secondary-foreground disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4" /> Download Excel
              </button>
              <button
                onClick={() => download("pptx")}
                disabled={!data}
                className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-body-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <FileText className="h-4 w-4" /> Download PowerPoint
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-card p-5 shadow-soft">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="mt-2 text-h2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
    </div>
  );
}
