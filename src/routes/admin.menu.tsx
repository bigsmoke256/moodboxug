import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChefHat, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatUGX } from "@/hooks/use-cart";

export const Route = createFileRoute("/admin/menu")({
  component: AdminMenu,
});

interface Category {
  id: string;
  name: string;
  restaurant_id: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string;
}

const RESTAURANT_ID = "61548a61-12cb-4a04-ad26-d57264e9e436";

const ItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  price: z.number().positive().max(1_000_000),
  category_id: z.string().uuid(),
  is_available: z.boolean(),
});

function AdminMenu() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("id, name, restaurant_id").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-menu-items"],
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, description, price, image_url, is_available, category_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const c of categories) m.set(c.id, []);
    for (const it of items) {
      if (!m.has(it.category_id)) m.set(it.category_id, []);
      m.get(it.category_id)!.push(it);
    }
    return m;
  }, [categories, items]);

  const toggleAvailable = async (it: MenuItem) => {
    const { error } = await supabase.from("menu_items").update({ is_available: !it.is_available }).eq("id", it.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-menu-items"] });
  };

  const remove = async (it: MenuItem) => {
    if (!confirm(`Delete ${it.name}? This cannot be undone.`)) return;
    // Check for existing order history first.
    const { count, error: countErr } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("menu_item_id", it.id);
    if (countErr) return toast.error(countErr.message);
    if ((count ?? 0) > 0) {
      const { error: archiveErr } = await supabase
        .from("menu_items")
        .update({ is_available: false })
        .eq("id", it.id);
      if (archiveErr) return toast.error(archiveErr.message);
      toast.message(
        "This item has past orders and can't be permanently deleted — it's been archived and hidden from the menu instead.",
      );
      qc.invalidateQueries({ queryKey: ["admin-menu-items"] });
      return;
    }
    const { error } = await supabase.from("menu_items").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-menu-items"] });
  };


  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-eyebrow">Kitchen</p>
          <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            Menu
          </h1>
        </div>
        <button
          onClick={() => setEditing({ is_available: true, category_id: categories[0]?.id })}
          className="motion-button-elevate glass-surface fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full px-5 py-3 text-body-sm font-semibold text-primary shadow-lg lg:static lg:shadow-soft"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[16px] bg-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={ChefHat} title="No menu items yet" description="Click Add item to create your first dish." />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {categories.map((cat) => {
            const list = grouped.get(cat.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={cat.id}>
                <h2 className="text-h3 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
                  {cat.name}
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((it) => (
                    <article key={it.id} className="flex gap-3 rounded-[16px] bg-card p-3 shadow-soft">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[12px] bg-surface">
                        {it.image_url && (
                          <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-body font-semibold text-charcoal">{it.name}</h3>
                          <span className="text-body-sm font-bold text-secondary">{formatUGX(it.price)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">
                          {it.description ?? "—"}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <label className="flex cursor-pointer items-center gap-2 text-caption text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={it.is_available}
                              onChange={() => toggleAvailable(it)}
                              className="accent-primary"
                            />
                            Available
                          </label>
                          <div className="flex gap-1">
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
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <ItemEditor
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin-menu-items"] });
          }}
        />
      )}
    </div>
  );
}

function ItemEditor({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial: Partial<MenuItem>;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial.name ?? "",
    description: initial.description ?? "",
    price: initial.price ?? 0,
    category_id: initial.category_id ?? categories[0]?.id ?? "",
    is_available: initial.is_available ?? true,
  });
  const [image, setImage] = useState<string | null>(initial.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm({
      name: initial.name ?? "",
      description: initial.description ?? "",
      price: initial.price ?? 0,
      category_id: initial.category_id ?? categories[0]?.id ?? "",
      is_available: initial.is_available ?? true,
    });
    setImage(initial.image_url ?? null);
  }, [initial, categories]);

  const upload = async (file: File) => {
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast.error("JPG, PNG, or WEBP only");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const path = `${RESTAURANT_ID}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("menu-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!signed?.signedUrl) throw new Error("Could not generate URL");
      setImage(signed.signedUrl);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed — try again");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const parsed = ItemSchema.safeParse({
      ...form,
      price: Number(form.price),
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
      const payload = { ...parsed.data, image_url: image, description: parsed.data.description || null };
      if (initial.id) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert(payload);
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
      <div className="glass-surface absolute right-0 top-0 flex h-full w-full max-w-lg flex-col overflow-y-auto p-6 shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between">
          <h2 className="text-h2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            {initial.id ? "Edit item" : "New item"}
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
          <div>
            <label className="text-body-sm font-medium text-charcoal">Photo</label>
            <div className="mt-1 flex items-center gap-3">
              <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-[12px] bg-surface">
                {image ? (
                  <img src={image} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <label className="cursor-pointer rounded-[12px] border border-input bg-background px-3 py-2 text-body-sm hover:bg-surface">
                {uploading ? "Uploading…" : image ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <Field label="Name" required error={errors.name}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={120}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <Field label="Description" error={errors.description}>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (UGX)" required error={errors.price}>
              <input
                type="number"
                min={0}
                step={100}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Category" required error={errors.category_id}>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-body-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
              className="accent-primary"
            />
            Available for order
          </label>
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
            disabled={saving || uploading}
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
