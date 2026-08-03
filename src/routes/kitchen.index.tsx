import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { AlertTriangle, Bell, BellOff, ChefHat, Clock, RotateCcw, Utensils } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RealtimePill } from "@/components/shared/RealtimePill";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";

export const Route = createFileRoute("/kitchen/")({
  component: KitchenBoard,
});

type TicketStatus = "confirmed" | "preparing" | "ready";

interface TicketItem {
  id: string;
  quantity: number;
  selected_options: unknown;
  menu_items: { name: string } | null;
}

interface Ticket {
  id: string;
  status: TicketStatus;
  created_at: string;
  special_instructions: string | null;
  order_items: TicketItem[];
}

const COLUMNS: { key: TicketStatus; label: string; hint: string }[] = [
  { key: "confirmed", label: "New orders", hint: "Waiting to start" },
  { key: "preparing", label: "Cooking", hint: "On the line" },
  { key: "ready", label: "Ready for pickup", hint: "Awaiting driver" },
];

/** Target prep time in minutes before a ticket turns amber / red. */
const SLA_WARN = 8;
const SLA_LATE = 15;

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function optionLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => (o && typeof o === "object" && "name" in o ? String((o as { name: unknown }).name) : null))
    .filter((v): v is string => !!v);
}

function useTicker() {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);
}

function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* audio is a nicety, never a failure */
  }
}

function KitchenBoard() {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const rtStatus = useRealtimeStatus(channel);
  const [sound, setSound] = useState(true);
  const knownIds = useRef<Set<string> | null>(null);
  useTicker();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["kds-tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, created_at, special_instructions, order_items(id, quantity, selected_options, menu_items(name))",
        )
        .in("status", ["confirmed", "preparing", "ready"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
    refetchInterval: 30_000,
  });

  // Chime when a genuinely new ticket lands.
  useEffect(() => {
    const ids = new Set(tickets.filter((t) => t.status === "confirmed").map((t) => t.id));
    if (knownIds.current === null) {
      knownIds.current = ids;
      return;
    }
    const fresh = [...ids].filter((id) => !knownIds.current!.has(id));
    knownIds.current = ids;
    if (fresh.length > 0 && sound) beep();
  }, [tickets, sound]);

  useEffect(() => {
    const ch = supabase
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["kds-tickets"] });
      })
      .subscribe();
    setChannel(ch);
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const grouped = useMemo(() => {
    const map = new Map<TicketStatus, Ticket[]>();
    for (const c of COLUMNS) map.set(c.key, []);
    for (const t of tickets) map.get(t.status)?.push(t);
    return map;
  }, [tickets]);

  // "All day" counts — total quantity per dish still to be cooked.
  const allDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tickets) {
      if (t.status === "ready") continue;
      for (const it of t.order_items ?? []) {
        const name = it.menu_items?.name ?? "Item";
        counts.set(name, (counts.get(name) ?? 0) + it.quantity);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  const openCount = tickets.filter((t) => t.status !== "ready").length;
  const oldest = tickets
    .filter((t) => t.status !== "ready")
    .reduce((max, t) => Math.max(max, minutesSince(t.created_at)), 0);

  const move = async (id: string, next: TicketStatus) => {
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["kds-tickets"] });
  };

  return (
    <div className="min-h-screen bg-[#101418] text-white">
      <Toaster position="top-center" richColors closeButton theme="dark" />

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-[color:var(--color-primary,#63D0CF)]" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Kitchen Display</h1>
            <p className="text-xs text-white/50">Mood Box · live ticket rail</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            {openCount} open {openCount === 1 ? "ticket" : "tickets"}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 ${
              oldest >= SLA_LATE ? "bg-red-500/25 text-red-200" : "bg-white/10"
            }`}
          >
            Oldest {oldest}m
          </span>
          <button
            onClick={() => setSound((s) => !s)}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"
            aria-label={sound ? "Mute new order chime" : "Unmute new order chime"}
          >
            {sound ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {sound ? "Sound on" : "Muted"}
          </button>
          <RealtimePill status={rtStatus} />
        </div>
      </header>

      {allDay.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-white/[0.03] px-5 py-2.5">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-white/40">
            All day
          </span>
          {allDay.map(([name, qty]) => (
            <span
              key={name}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm"
            >
              <b className="text-[color:var(--color-primary,#63D0CF)]">{qty}×</b> {name}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = grouped.get(col.key) ?? [];
          return (
            <section key={col.key} className="rounded-2xl bg-white/[0.04] p-3">
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="text-base font-semibold">{col.label}</h2>
                <span className="text-xs text-white/40">
                  {list.length} · {col.hint}
                </span>
              </div>
              <div className="space-y-3">
                {isLoading && <p className="px-1 text-sm text-white/40">Loading tickets…</p>}
                {!isLoading && list.length === 0 && (
                  <p className="px-1 py-6 text-center text-sm text-white/30">Nothing here</p>
                )}
                {list.map((t) => (
                  <TicketCard key={t.id} ticket={t} onMove={move} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  onMove,
}: {
  ticket: Ticket;
  onMove: (id: string, next: TicketStatus) => void;
}) {
  const mins = minutesSince(ticket.created_at);
  const late = mins >= SLA_LATE;
  const warn = !late && mins >= SLA_WARN;
  const accent = ticket.status === "ready"
    ? "border-emerald-400/50"
    : late
      ? "border-red-500"
      : warn
        ? "border-amber-400"
        : "border-white/15";

  return (
    <article className={`rounded-xl border-l-4 bg-[#171d23] p-3 shadow-lg ${accent}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold tracking-wider">
          #{ticket.id.slice(0, 6).toUpperCase()}
        </span>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            late
              ? "bg-red-500/25 text-red-200"
              : warn
                ? "bg-amber-400/20 text-amber-200"
                : "bg-white/10 text-white/60"
          }`}
        >
          <Clock className="h-3 w-3" />
          {mins}m
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {(ticket.order_items ?? []).map((it) => {
          const opts = optionLabels(it.selected_options);
          return (
            <li key={it.id} className="flex gap-2 text-sm">
              <span className="min-w-7 shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-center font-bold">
                {it.quantity}
              </span>
              <span className="leading-snug">
                {it.menu_items?.name ?? "Item"}
                {opts.length > 0 && (
                  <span className="block text-xs text-[color:var(--color-primary,#63D0CF)]">
                    + {opts.join(", ")}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {ticket.special_instructions && (
        <p className="mt-3 flex gap-1.5 rounded-lg bg-amber-400/15 px-2 py-1.5 text-xs text-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {ticket.special_instructions}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {ticket.status === "confirmed" && (
          <button
            onClick={() => onMove(ticket.id, "preparing")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-primary,#63D0CF)] py-2 text-sm font-semibold text-[#0b1013]"
          >
            <Utensils className="h-4 w-4" /> Start cooking
          </button>
        )}
        {ticket.status === "preparing" && (
          <>
            <button
              onClick={() => onMove(ticket.id, "ready")}
              className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-[#0b1013]"
            >
              Bump — ready
            </button>
            <button
              onClick={() => onMove(ticket.id, "confirmed")}
              className="rounded-lg bg-white/10 px-3 py-2 text-white/70 hover:bg-white/20"
              aria-label="Send ticket back to new orders"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </>
        )}
        {ticket.status === "ready" && (
          <button
            onClick={() => onMove(ticket.id, "preparing")}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/10 py-2 text-sm text-white/70 hover:bg-white/20"
          >
            <RotateCcw className="h-4 w-4" /> Recall to line
          </button>
        )}
      </div>
    </article>
  );
}
