import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";
import { RealtimePill } from "@/components/shared/RealtimePill";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import { formatUGX } from "@/hooks/use-cart";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

interface OrderRow {
  id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  delivery_address: string | null;
  payment_method: string | null;
  payment_status: string;
  special_instructions: string | null;
  customer_id: string;
  profiles: { full_name: string | null; phone: string | null } | null;
}

const COLUMNS: { key: OrderStatus; label: string; next: OrderStatus | null }[] = [
  { key: "pending", label: "New", next: "confirmed" },
  { key: "confirmed", label: "Confirmed", next: "preparing" },
  { key: "preparing", label: "Preparing", next: "ready" },
  { key: "ready", label: "Ready", next: "out_for_delivery" },
  { key: "out_for_delivery", label: "Out for delivery", next: "delivered" },
  { key: "delivered", label: "Delivered", next: null },
];

function AdminOrders() {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const status = useRealtimeStatus(channel);
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, total, created_at, delivery_address, payment_method, payment_status, special_instructions, customer_id, profiles:customer_id(full_name, phone)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    setChannel(ch);
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const grouped = useMemo(() => {
    const map = new Map<OrderStatus, OrderRow[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const o of orders) {
      if (map.has(o.status)) map.get(o.status)!.push(o);
    }
    return map;
  }, [orders]);

  const advance = async (order: OrderRow, next: OrderStatus) => {
    try {
      const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);
      if (error) throw error;
      await supabase.from("order_status_history").insert({ order_id: order.id, status: next });
      toast.success(`Moved to ${next}`);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      if (selected?.id === order.id) setSelected({ ...order, status: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update order");
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow">Kitchen + Delivery</p>
          <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            Orders
          </h1>
        </div>
        <RealtimePill status={status} />
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-[16px] bg-card" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={ShoppingBag} title="No orders yet" description="Orders will appear here as customers check out." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {COLUMNS.map((col) => {
            const items = grouped.get(col.key) ?? [];
            return (
              <div key={col.key} className="rounded-[16px] bg-surface p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-body-sm font-bold uppercase tracking-wider text-charcoal">{col.label}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-caption text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelected(o)}
                      className="motion-card-lift w-full rounded-[12px] bg-card p-3 text-left shadow-soft"
                    >
                      <div className="flex items-baseline justify-between">
                        <p className="text-caption text-muted-foreground">#{o.id.slice(0, 6)}</p>
                        <p className="text-body-sm font-bold text-secondary">{formatUGX(o.total)}</p>
                      </div>
                      <p className="mt-1 text-body-sm font-semibold text-charcoal">
                        {o.profiles?.full_name ?? "Customer"}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">
                        {o.delivery_address ?? "—"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onAdvance={(next) => advance(selected, next)}
        />
      )}
    </div>
  );
}

function OrderDrawer({
  order,
  onClose,
  onAdvance,
}: {
  order: OrderRow;
  onClose: () => void;
  onAdvance: (next: OrderStatus) => void;
}) {
  const col = COLUMNS.find((c) => c.key === order.status);
  const nextStatus = col?.next;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass-surface absolute right-0 top-0 flex h-full w-full max-w-md flex-col p-6 shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-caption text-muted-foreground">#{order.id.slice(0, 8)}</p>
            <h2 className="mt-1 text-h2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
              {order.profiles?.full_name ?? "Customer"}
            </h2>
            <p className="text-body-sm text-muted-foreground">{order.profiles?.phone ?? "—"}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-charcoal hover:bg-surface"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-6 space-y-3 text-body-sm">
          <Row label="Status" value={order.status} />
          <Row label="Total" value={formatUGX(order.total)} />
          <Row label="Payment" value={`${order.payment_method ?? "—"} · ${order.payment_status}`} />
          <div>
            <dt className="text-caption text-muted-foreground">Delivery address</dt>
            <dd className="mt-1 text-body-sm text-charcoal">{order.delivery_address ?? "—"}</dd>
          </div>
          {order.special_instructions && (
            <div>
              <dt className="text-caption text-muted-foreground">Instructions</dt>
              <dd className="mt-1 text-body-sm text-charcoal">{order.special_instructions}</dd>
            </div>
          )}
        </dl>

        <div className="mt-auto space-y-2 pt-6">
          {nextStatus && (
            <button
              onClick={() => onAdvance(nextStatus)}
              className="motion-button-elevate w-full rounded-[12px] bg-primary py-3 text-body-sm font-semibold text-primary-foreground"
            >
              Advance to {nextStatus.replaceAll("_", " ")}
            </button>
          )}
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <button
              onClick={() => onAdvance("cancelled")}
              className="w-full rounded-[12px] border border-destructive/40 py-2.5 text-body-sm text-destructive hover:bg-destructive/5"
            >
              Cancel order
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-caption text-muted-foreground uppercase tracking-wider">{label}</dt>
      <dd className="text-body-sm font-semibold text-charcoal">{value}</dd>
    </div>
  );
}
