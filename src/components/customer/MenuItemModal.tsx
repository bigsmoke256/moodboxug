import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatUGX, type SelectedOption } from "@/hooks/use-cart";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&q=80";

export interface MenuItemLite {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  ingredients: string[] | null;
  allergens: string[] | null;
}

interface Props {
  item: MenuItemLite | null;
  onClose: () => void;
}

interface Opt {
  id: string;
  option_group: string;
  name: string;
  price_delta: number;
}

async function fetchOptions(itemId: string): Promise<Opt[]> {
  const { data, error } = await supabase
    .from("item_options")
    .select("id, option_group, name, price_delta")
    .eq("menu_item_id", itemId);
  if (error) throw error;
  return data ?? [];
}

export function MenuItemModal({ item, onClose }: Props) {
  const open = !!item;
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  // key: `${group}::${name}` for single-select; array of names for multi
  const [singleSel, setSingleSel] = useState<Record<string, string>>({});
  const [multiSel, setMultiSel] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (!open) return;
    setQty(1);
    setSingleSel({});
    setMultiSel({});
  }, [open, item?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { data: options = [] } = useQuery({
    queryKey: ["item-options", item?.id],
    queryFn: () => fetchOptions(item!.id),
    enabled: !!item,
  });

  const groups = useMemo(() => {
    const map = new Map<string, Opt[]>();
    for (const o of options) {
      if (!map.has(o.option_group)) map.set(o.option_group, []);
      map.get(o.option_group)!.push(o);
    }
    return Array.from(map.entries());
  }, [options]);

  // Heuristic: groups whose names match "Size", "Portion" → single select radio; else multi checkbox.
  const isSingle = (group: string) => /size|portion/i.test(group);

  const selected: SelectedOption[] = useMemo(() => {
    const out: SelectedOption[] = [];
    for (const [group, opts] of groups) {
      if (isSingle(group)) {
        const sel = singleSel[group];
        const o = opts.find((x) => x.name === sel);
        if (o) out.push({ group, name: o.name, priceDelta: Number(o.price_delta) });
      } else {
        const set = multiSel[group] ?? new Set<string>();
        for (const o of opts) if (set.has(o.name)) out.push({ group, name: o.name, priceDelta: Number(o.price_delta) });
      }
    }
    return out;
  }, [groups, singleSel, multiSel]);

  const unitTotal = useMemo(() => {
    const extras = selected.reduce((s, o) => s + o.priceDelta, 0);
    return (Number(item?.price ?? 0) + extras) * qty;
  }, [selected, item, qty]);

  if (!open || !item) return null;

  const handleAdd = () => {
    add(
      {
        menuItemId: item.id,
        name: item.name,
        basePrice: Number(item.price),
        imageUrl: item.image_url,
        options: selected,
      },
      qty,
    );
    toast.success(`${item.name} added to cart`);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="glass-surface relative w-full max-w-2xl overflow-hidden rounded-[20px] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-charcoal shadow-soft"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-[4/3] md:aspect-auto">
            <img
              src={item.image_url || FALLBACK_IMG}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex max-h-[80vh] flex-col overflow-y-auto p-6">
            <h2 className="text-h1 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
              {item.name}
            </h2>
            {item.description && <p className="mt-1 text-body-sm text-muted-foreground">{item.description}</p>}

            {item.ingredients && item.ingredients.length > 0 && (
              <div className="mt-4">
                <p className="text-eyebrow">Ingredients</p>
                <p className="mt-1 text-body-sm text-charcoal">{item.ingredients.join(", ")}</p>
              </div>
            )}
            {item.allergens && item.allergens.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.allergens.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                  >
                    Contains: {a}
                  </span>
                ))}
              </div>
            )}

            {groups.map(([group, opts]) => (
              <div key={group} className="mt-5">
                <p className="text-body-sm font-semibold text-charcoal">{group}</p>
                <div className="mt-2 space-y-2">
                  {opts.map((o) => {
                    const single = isSingle(group);
                    const checked = single
                      ? singleSel[group] === o.name
                      : (multiSel[group]?.has(o.name) ?? false);
                    return (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-center justify-between rounded-[12px] border px-3 py-2 transition-colors ${
                          checked ? "border-primary bg-primary/5" : "border-input hover:bg-surface"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-body-sm text-charcoal">
                          <input
                            type={single ? "radio" : "checkbox"}
                            name={group}
                            checked={checked}
                            onChange={() => {
                              if (single) {
                                setSingleSel((s) => ({ ...s, [group]: o.name }));
                              } else {
                                setMultiSel((m) => {
                                  const next = new Set(m[group] ?? []);
                                  if (next.has(o.name)) next.delete(o.name);
                                  else next.add(o.name);
                                  return { ...m, [group]: next };
                                });
                              }
                            }}
                            className="accent-primary"
                          />
                          {o.name}
                        </span>
                        <span className="text-body-sm font-semibold text-secondary">
                          {Number(o.price_delta) > 0
                            ? `+${formatUGX(o.price_delta)}`
                            : Number(o.price_delta) < 0
                              ? `-${formatUGX(-o.price_delta)}`
                              : "Included"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-input px-2 py-1">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-8 w-8 place-items-center rounded-full text-charcoal hover:bg-surface"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-body font-semibold">{qty}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => q + 1)}
                  className="grid h-8 w-8 place-items-center rounded-full text-charcoal hover:bg-surface"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={handleAdd}
                className="motion-button-elevate flex-1 rounded-[12px] bg-primary py-3 text-body font-semibold text-primary-foreground"
              >
                Add to cart • {formatUGX(unitTotal)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
