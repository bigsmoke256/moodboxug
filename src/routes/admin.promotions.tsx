import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Percent, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/admin/promotions")({
  component: AdminPromotions,
});

const RESTAURANT_ID = "61548a61-12cb-4a04-ad26-d57264e9e436";

const PROMO_TYPES = ["percentage", "fixed_amount", "free_delivery", "combo"] as const;
type PromoType = (typeof PROMO_TYPES)[number];

interface Promo {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  is_active: boolean;
  active_from: string;
  active_to: string | null;
}

const schema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_-]+$/, "Letters, digits, - and _ only"),
  type: z.enum(PROMO_TYPES),
  value: z.number().min(0).max(1_000_000),
});

function AdminPromotions() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", type: "percentage" as PromoType, value: 10 });

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async (): Promise<Promo[]> => {
      const { data, error } = await supabase
        .from("promotions")
        .select("id, code, type, value, is_active, active_from, active_to")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Promo[];
    },
  });

  const create = async () => {
    const parsed = schema.safeParse({ ...form, code: form.code.trim().toUpperCase() });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("promotions").insert({
      ...parsed.data,
      restaurant_id: RESTAURANT_ID,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Promo created");
    setForm({ code: "", type: "percentage", value: 10 });
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  };

  const toggle = async (p: Promo) => {
    const { error } = await supabase.from("promotions").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  };

  const remove = async (p: Promo) => {
    if (!confirm(`Delete promo ${p.code}?`)) return;
    const { error } = await supabase.from("promotions").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  };

  return (
    <div>
      <p className="text-eyebrow">Growth</p>
      <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        Promotions
      </h1>

      <section className="mt-6 rounded-[20px] bg-card p-6 shadow-soft">
        <h2 className="text-h3 text-charcoal">Create a promo code</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="CODE"
            maxLength={50}
            className="rounded-[12px] border border-input bg-background px-3 py-2 font-mono text-body uppercase outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as PromoType })}
            className="rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
          >
            {PROMO_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={form.value}
            onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            className="rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={create}
            className="motion-button-elevate flex items-center gap-2 rounded-[12px] bg-primary px-4 py-2 text-body-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </section>

      <section className="mt-6">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-[16px] bg-card" />
        ) : promos.length === 0 ? (
          <EmptyState icon={Percent} title="No promo codes" description="Create your first campaign above." />
        ) : (
          <div className="overflow-hidden rounded-[16px] bg-card shadow-soft">
            <table className="w-full text-body-sm">
              <thead className="border-b border-border text-caption text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Value</th>
                  <th className="px-4 py-3 text-left">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono font-semibold text-charcoal">{p.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.type.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-charcoal">{p.value}</td>
                    <td className="px-4 py-3">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={p.is_active} onChange={() => toggle(p)} className="accent-primary" />
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => remove(p)}
                        className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                        aria-label={`Delete ${p.code}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
