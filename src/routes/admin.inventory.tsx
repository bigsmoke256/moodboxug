import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/admin/inventory")({
  component: AdminInventory,
});

const RESTAURANT_ID = "61548a61-12cb-4a04-ad26-d57264e9e436";

interface Item {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  supplier: string | null;
  updated_at: string;
}

const Schema = z.object({
  name: z.string().trim().min(2).max(120),
  unit: z.string().trim().min(1).max(20),
  quantity: z.number().min(0).max(1_000_000),
  low_stock_threshold: z.number().min(0).max(1_000_000),
  supplier: z.string().trim().max(200).optional().or(z.literal("")),
});

function AdminInventory() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Item> | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-inventory"],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, quantity, unit, low_stock_threshold, supplier, updated_at")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = async (it: Item) => {
    if (!confirm(`Delete ${it.name}?`)) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-inventory"] });
  };

  const lowCount = items.filter((i) => i.quantity <= i.low_stock_threshold).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow">Stock</p>
          <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            Inventory
          </h1>
          {lowCount > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-caption font-semibold text-primary">
              <AlertTriangle className="h-3 w-3" /> {lowCount} item{lowCount === 1 ? "" : "s"} low on stock
            </p>
          )}
        </div>
        <button
          onClick={() =>
            setEditing({ name: "", unit: "kg", quantity: 0, low_stock_threshold: 5, supplier: "" })
          }
          className="motion-button-elevate glass-surface fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full px-5 py-3 text-body-sm font-semibold text-primary shadow-lg lg:static lg:shadow-soft"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-[16px] bg-card" />
        ) : items.length === 0 ? (
          <EmptyState icon={Package} title="No stock tracked yet" description="Add ingredients to start monitoring supply." />
        ) : (
          <div className="overflow-hidden rounded-[16px] bg-card shadow-soft">
            <table className="w-full text-body-sm">
              <thead className="border-b border-border text-caption text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Low at</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const low = it.quantity <= it.low_stock_threshold;
                  return (
                    <tr key={it.id} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold text-charcoal">{it.name}</td>
                      <td className="px-4 py-3 text-charcoal">
                        {it.quantity} <span className="text-muted-foreground">{it.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {it.low_stock_threshold} {it.unit}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{it.supplier ?? "—"}</td>
                      <td className="px-4 py-3">
                        {low ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-caption font-semibold text-primary">
                            <AlertTriangle className="h-3 w-3" /> Low
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-secondary/15 px-2 py-1 text-caption font-semibold text-secondary">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => setEditing(it)}
                            className="grid h-8 w-8 place-items-center rounded-full text-charcoal hover:bg-surface"
                            aria-label={`Edit ${it.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => remove(it)}
                            className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                            aria-label={`Delete ${it.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <InventoryEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin-inventory"] });
          }}
        />
      )}
    </div>
  );
}

function InventoryEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<Item>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial.name ?? "",
    unit: initial.unit ?? "kg",
    quantity: initial.quantity ?? 0,
    low_stock_threshold: initial.low_stock_threshold ?? 5,
    supplier: initial.supplier ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: initial.name ?? "",
      unit: initial.unit ?? "kg",
      quantity: initial.quantity ?? 0,
      low_stock_threshold: initial.low_stock_threshold ?? 5,
      supplier: initial.supplier ?? "",
    });
  }, [initial]);

  const save = async () => {
    const parsed = Schema.safeParse({
      ...form,
      quantity: Number(form.quantity),
      low_stock_threshold: Number(form.low_stock_threshold),
    });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues) e[String(issue.path[0])] = issue.message;
      setErrors(e);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = { ...parsed.data, supplier: parsed.data.supplier || null };
      if (initial.id) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("inventory_items")
          .insert({ ...payload, restaurant_id: RESTAURANT_ID });
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-surface absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto p-6 shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between">
          <h2 className="text-h2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            {initial.id ? "Edit stock" : "New stock item"}
          </h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-charcoal hover:bg-surface"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Name" required error={errors.name}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" required error={errors.quantity}>
              <input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Unit" required error={errors.unit}>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
          <Field label="Low stock threshold" required error={errors.low_stock_threshold}>
            <input
              type="number"
              min={0}
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Supplier" error={errors.supplier}>
            <input
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>

        <div className="mt-auto flex gap-2 pt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-[12px] border border-input py-2.5 text-body-sm font-semibold text-charcoal hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="motion-button-elevate flex-1 rounded-[12px] bg-primary py-2.5 text-body-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-body-sm font-medium text-charcoal">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-caption text-destructive">{error}</p>}
    </div>
  );
}
