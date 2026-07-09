import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import { supabase } from "@/integrations/supabase/client";
import { formatUGX } from "@/hooks/use-cart";

export type ReportPeriod = "week" | "month" | "year" | "custom";

export interface ReportRange {
  label: string;
  start: Date;
  end: Date;
}

export function getRange(period: ReportPeriod, custom?: { start: Date; end: Date }): ReportRange {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "week") {
    start.setDate(start.getDate() - 6);
    return { label: `Weekly Report — ${fmt(start)} to ${fmt(end)}`, start, end };
  }
  if (period === "month") {
    start.setDate(1);
    return { label: `Monthly Report — ${start.toLocaleString("en", { month: "long", year: "numeric" })}`, start, end };
  }
  if (period === "year") {
    start.setMonth(0, 1);
    return { label: `Annual Report — ${start.getFullYear()}`, start, end };
  }
  if (period === "custom" && custom) {
    const s = new Date(custom.start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(custom.end);
    e.setHours(23, 59, 59, 999);
    return { label: `Report — ${fmt(s)} to ${fmt(e)}`, start: s, end: e };
  }
  return { label: `Report — ${fmt(start)}`, start, end };
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export interface ReportData {
  range: ReportRange;
  totals: {
    orders: number;
    revenue: number;
    avgOrder: number;
    delivered: number;
    cancelled: number;
    newCustomers: number;
  };
  daily: { day: string; orders: number; revenue: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  topCustomers: { name: string; orders: number; spend: number }[];
  paymentBreakdown: { method: string; count: number; total: number }[];
  statusBreakdown: { status: string; count: number }[];
  orders: {
    id: string;
    created_at: string;
    customer: string;
    status: string;
    payment_method: string;
    total: number;
  }[];
  insights: string[];
}

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  payment_method: string | null;
  total: number | null;
  subtotal: number | null;
  user_id: string | null;
  profiles?: { full_name: string | null } | null;
  order_items?: { quantity: number; unit_price: number | null; menu_items?: { name: string | null } | null }[];
}

export async function loadReportData(range: ReportRange): Promise<ReportData> {
  const { data: ordersRaw, error } = await supabase
    .from("orders")
    .select(
      "id, created_at, status, payment_method, total, subtotal, user_id, profiles(full_name), order_items(quantity, unit_price, menu_items(name))",
    )
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  const orders = (ordersRaw ?? []) as unknown as OrderRow[];

  const { count: newCustomers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString());

  const totals = {
    orders: orders.length,
    revenue: orders.reduce((s, o) => s + Number(o.total ?? 0), 0),
    avgOrder: 0,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    newCustomers: newCustomers ?? 0,
  };
  totals.avgOrder = totals.orders > 0 ? totals.revenue / totals.orders : 0;

  // Daily buckets
  const buckets = new Map<string, { day: string; orders: number; revenue: number }>();
  const days = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000));
  for (let i = 0; i < days; i++) {
    const d = new Date(range.start);
    d.setDate(range.start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { day: key, orders: 0, revenue: 0 });
  }
  for (const o of orders) {
    const key = o.created_at.slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      b.orders += 1;
      b.revenue += Number(o.total ?? 0);
    }
  }
  const daily = Array.from(buckets.values());

  // Top items
  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of orders) {
    for (const li of o.order_items ?? []) {
      const name = li.menu_items?.name ?? "Unknown";
      const cur = itemMap.get(name) ?? { name, qty: 0, revenue: 0 };
      cur.qty += li.quantity;
      cur.revenue += li.quantity * Number(li.unit_price ?? 0);
      itemMap.set(name, cur);
    }
  }
  const topItems = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // Top customers
  const custMap = new Map<string, { name: string; orders: number; spend: number }>();
  for (const o of orders) {
    const key = o.user_id ?? "guest";
    const name = o.profiles?.full_name || "Guest";
    const cur = custMap.get(key) ?? { name, orders: 0, spend: 0 };
    cur.orders += 1;
    cur.spend += Number(o.total ?? 0);
    custMap.set(key, cur);
  }
  const topCustomers = Array.from(custMap.values()).sort((a, b) => b.spend - a.spend).slice(0, 10);

  // Payment
  const payMap = new Map<string, { method: string; count: number; total: number }>();
  for (const o of orders) {
    const m = o.payment_method ?? "unknown";
    const cur = payMap.get(m) ?? { method: m, count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(o.total ?? 0);
    payMap.set(m, cur);
  }
  const paymentBreakdown = Array.from(payMap.values());

  // Status
  const stMap = new Map<string, number>();
  for (const o of orders) stMap.set(o.status, (stMap.get(o.status) ?? 0) + 1);
  const statusBreakdown = Array.from(stMap.entries()).map(([status, count]) => ({ status, count }));

  const orderRows = orders.map((o) => ({
    id: o.id.slice(0, 8),
    created_at: new Date(o.created_at).toLocaleString(),
    customer: o.profiles?.full_name || "Guest",
    status: o.status,
    payment_method: o.payment_method ?? "—",
    total: Number(o.total ?? 0),
  }));

  const insights = buildInsights({ totals, daily, topItems, statusBreakdown, range });

  return {
    range,
    totals,
    daily,
    topItems,
    topCustomers,
    paymentBreakdown,
    statusBreakdown,
    orders: orderRows,
    insights,
  };
}

function buildInsights(d: {
  totals: ReportData["totals"];
  daily: ReportData["daily"];
  topItems: ReportData["topItems"];
  statusBreakdown: ReportData["statusBreakdown"];
  range: ReportRange;
}): string[] {
  const out: string[] = [];
  out.push(
    `Moodbox processed ${d.totals.orders} orders generating ${formatUGX(d.totals.revenue)} in revenue during this period.`,
  );
  if (d.totals.orders > 0) {
    out.push(`Average order value was ${formatUGX(d.totals.avgOrder)}.`);
  }
  const bestDay = [...d.daily].sort((a, b) => b.revenue - a.revenue)[0];
  if (bestDay && bestDay.revenue > 0) {
    out.push(`Peak day was ${bestDay.day} with ${formatUGX(bestDay.revenue)} across ${bestDay.orders} orders.`);
  }
  if (d.topItems[0]) {
    out.push(
      `Best-selling item was "${d.topItems[0].name}" (${d.topItems[0].qty} sold, ${formatUGX(d.topItems[0].revenue)} in revenue).`,
    );
  }
  const fulfillmentRate =
    d.totals.orders > 0 ? Math.round((d.totals.delivered / d.totals.orders) * 100) : 0;
  out.push(`Fulfillment rate: ${fulfillmentRate}% of orders reached delivered status.`);
  if (d.totals.cancelled > 0) {
    out.push(`${d.totals.cancelled} orders were cancelled — review kitchen and driver capacity.`);
  }
  if (d.totals.newCustomers > 0) {
    out.push(`${d.totals.newCustomers} new customers signed up in this window.`);
  }
  return out;
}

/* ---------------- Excel ---------------- */

export function exportExcel(data: ReportData) {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["Moodbox — " + data.range.label],
    [],
    ["Metric", "Value"],
    ["Orders", data.totals.orders],
    ["Revenue (UGX)", data.totals.revenue],
    ["Avg order value (UGX)", Math.round(data.totals.avgOrder)],
    ["Delivered", data.totals.delivered],
    ["Cancelled", data.totals.cancelled],
    ["New customers", data.totals.newCustomers],
    [],
    ["Insights"],
    ...data.insights.map((i) => [i]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  const ws2 = XLSX.utils.json_to_sheet(data.daily);
  ws2["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Daily");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.topItems), "Top Items");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.topCustomers), "Top Customers");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.paymentBreakdown), "Payments");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.statusBreakdown), "Status");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.orders), "Orders");

  XLSX.writeFile(wb, `moodbox-${slug(data.range.label)}.xlsx`);
}

/* ---------------- PowerPoint ---------------- */

export async function exportPptx(data: ReportData) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
  pptx.title = data.range.label;

  const brand = { turquoise: "63D0CF", coral: "EF5A8B", cream: "FFFCF8", charcoal: "1F2937" };

  // Cover
  const cover = pptx.addSlide();
  cover.background = { color: brand.charcoal };
  cover.addText("MOODBOX", {
    x: 0.6, y: 0.6, w: 12, h: 0.6, fontSize: 20, color: brand.turquoise, bold: true, fontFace: "Arial",
  });
  cover.addText(data.range.label, {
    x: 0.6, y: 2.2, w: 12, h: 1.6, fontSize: 44, color: "FFFFFF", bold: true, fontFace: "Arial",
  });
  cover.addText("Business Performance Report", {
    x: 0.6, y: 4.0, w: 12, h: 0.6, fontSize: 22, color: brand.cream, fontFace: "Arial",
  });
  cover.addText(`Generated ${new Date().toLocaleString()}`, {
    x: 0.6, y: 6.6, w: 12, h: 0.4, fontSize: 12, color: "9CA3AF", fontFace: "Arial",
  });

  // KPI slide
  const kpi = pptx.addSlide();
  kpi.background = { color: brand.cream };
  kpi.addText("Key Metrics", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 32, bold: true, color: brand.charcoal, fontFace: "Arial" });
  const cards = [
    { label: "Orders", value: String(data.totals.orders), color: brand.turquoise },
    { label: "Revenue", value: formatUGX(data.totals.revenue), color: brand.coral },
    { label: "Avg Order", value: formatUGX(data.totals.avgOrder), color: brand.turquoise },
    { label: "Delivered", value: String(data.totals.delivered), color: brand.coral },
    { label: "Cancelled", value: String(data.totals.cancelled), color: "6B7280" },
    { label: "New Customers", value: String(data.totals.newCustomers), color: brand.turquoise },
  ];
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.6 + col * 4.2;
    const y = 1.5 + row * 2.6;
    kpi.addShape("roundRect", { x, y, w: 3.9, h: 2.3, fill: { color: "FFFFFF" }, line: { color: "E5E7EB" }, rectRadius: 0.15 });
    kpi.addText(c.label, { x: x + 0.2, y: y + 0.3, w: 3.5, h: 0.4, fontSize: 14, color: "6B7280", fontFace: "Arial" });
    kpi.addText(c.value, { x: x + 0.2, y: y + 0.9, w: 3.5, h: 1.2, fontSize: 30, bold: true, color: c.color, fontFace: "Arial" });
  });

  // Daily chart
  const chart = pptx.addSlide();
  chart.background = { color: brand.cream };
  chart.addText("Daily Revenue & Orders", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 32, bold: true, color: brand.charcoal, fontFace: "Arial" });
  const labels = data.daily.map((d) => d.day.slice(5));
  chart.addChart(pptx.ChartType.bar, [
    { name: "Revenue (UGX)", labels, values: data.daily.map((d) => d.revenue) },
  ], {
    x: 0.6, y: 1.4, w: 12, h: 3.0, barDir: "col", chartColors: [brand.coral],
    showLegend: true, legendPos: "b", showTitle: false, catAxisLabelFontSize: 9,
  });
  chart.addChart(pptx.ChartType.line, [
    { name: "Orders", labels, values: data.daily.map((d) => d.orders) },
  ], {
    x: 0.6, y: 4.5, w: 12, h: 2.6, chartColors: [brand.turquoise],
    showLegend: true, legendPos: "b", showTitle: false, catAxisLabelFontSize: 9,
  });

  // Top items
  if (data.topItems.length > 0) {
    const s = pptx.addSlide();
    s.background = { color: brand.cream };
    s.addText("Top-Selling Items", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 32, bold: true, color: brand.charcoal, fontFace: "Arial" });
    s.addChart(pptx.ChartType.bar, [
      { name: "Quantity sold", labels: data.topItems.map((i) => i.name), values: data.topItems.map((i) => i.qty) },
    ], {
      x: 0.6, y: 1.3, w: 12, h: 5.8, barDir: "bar", chartColors: [brand.turquoise],
      showLegend: false, showValue: true, catAxisLabelFontSize: 11,
    });
  }

  // Top customers table
  if (data.topCustomers.length > 0) {
    const s = pptx.addSlide();
    s.background = { color: brand.cream };
    s.addText("Top Customers", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 32, bold: true, color: brand.charcoal, fontFace: "Arial" });
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: "Customer", options: { bold: true, fill: { color: brand.charcoal }, color: "FFFFFF" } },
        { text: "Orders", options: { bold: true, fill: { color: brand.charcoal }, color: "FFFFFF" } },
        { text: "Spend", options: { bold: true, fill: { color: brand.charcoal }, color: "FFFFFF" } },
      ],
      ...data.topCustomers.map((c) => [
        { text: c.name },
        { text: String(c.orders) },
        { text: formatUGX(c.spend) },
      ]),
    ];
    s.addTable(rows, { x: 0.6, y: 1.3, w: 12, colW: [6, 2, 4], fontSize: 14, fontFace: "Arial", border: { type: "solid", color: "E5E7EB", pt: 1 } });
  }

  // Insights slide
  const ins = pptx.addSlide();
  ins.background = { color: brand.charcoal };
  ins.addText("What Happened & What It Means", { x: 0.6, y: 0.5, w: 12, h: 0.7, fontSize: 30, bold: true, color: brand.turquoise, fontFace: "Arial" });
  ins.addText(
    data.insights.map((i) => ({ text: i, options: { bullet: { code: "25CF" }, color: "FFFFFF", fontSize: 18, paraSpaceAfter: 12 } })),
    { x: 0.8, y: 1.6, w: 11.7, h: 5.4, fontFace: "Arial" },
  );

  await pptx.writeFile({ fileName: `moodbox-${slug(data.range.label)}.pptx` });
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
