import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatUGX } from "@/hooks/use-cart";
import { MenuItemModal, type MenuItemLite } from "./MenuItemModal";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&q=80";

interface MenuRow extends MenuItemLite {
  badge: string;
  category_id: string;
}

interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
}

export function MenuExplorer() {
  const { add } = useCart();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selected, setSelected] = useState<MenuItemLite | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["menu-all"],
    queryFn: async (): Promise<MenuRow[]> => {
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, description, price, image_url, badge, ingredients, allergens, category_id")
        .eq("is_available", true)
        .order("name", { ascending: true });
      return (data ?? []) as MenuRow[];
    },
  });

  const term = query.trim().toLowerCase();

  const sections = useMemo(() => {
    const visible = items.filter((i) => {
      const matchesTerm = !term || i.name.toLowerCase().includes(term);
      const matchesCat = !activeCat || i.category_id === activeCat;
      return matchesTerm && matchesCat;
    });
    return categories
      .map((c) => ({ category: c, items: visible.filter((i) => i.category_id === c.id) }))
      .filter((s) => s.items.length > 0);
  }, [items, categories, term, activeCat]);

  const totalVisible = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <section id="full-menu" className="bg-background py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-eyebrow">Our Menu</p>
        <h2 className="mt-2 text-h1 text-charcoal">Everything on the menu</h2>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the menu"
            placeholder="What are you craving today?"
            className="w-full rounded-[16px] border border-input bg-card py-3.5 pr-4 pl-12 text-body shadow-soft outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          <Chip active={activeCat === null} onClick={() => setActiveCat(null)}>
            Everything
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>

        {totalVisible === 0 && (
          <p className="mt-10 text-body text-muted-foreground">
            {term ? `Nothing matches "${query.trim()}" — try another craving.` : "No menu items yet."}
          </p>
        )}

        {sections.map(({ category, items: catItems }) => (
          <div key={category.id} id={`cat-${category.id}`} className="mt-10 scroll-mt-24">
            <h3 className="text-h2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
              {category.name}
            </h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {catItems.map((item) => (
                <article
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="motion-card-lift group relative flex cursor-pointer flex-col overflow-hidden rounded-[20px] bg-card shadow-soft"
                >
                  <div className="motion-image-zoom relative aspect-[4/3] overflow-hidden">
                    <img
                      src={item.image_url || FALLBACK_IMG}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {item.badge && item.badge !== "none" && (
                      <span className="absolute top-3 left-3 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h4 className="text-base font-bold text-charcoal">{item.name}</h4>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">{item.description}</p>
                    )}
                    <div className="mt-auto flex items-end justify-between pt-4">
                      <p className="text-lg font-bold text-secondary">{formatUGX(item.price)}</p>
                      <button
                        aria-label={`Add ${item.name} to cart`}
                        onClick={(e) => {
                          e.stopPropagation();
                          add({
                            menuItemId: item.id,
                            name: item.name,
                            basePrice: Number(item.price),
                            imageUrl: item.image_url,
                            options: [],
                          });
                          toast.success(`${item.name} added`);
                        }}
                        className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform hover:scale-110"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
      <MenuItemModal item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-body-sm font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-charcoal hover:border-secondary"
      }`}
    >
      {children}
    </button>
  );
}
