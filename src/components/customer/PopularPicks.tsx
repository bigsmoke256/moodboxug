import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/use-cart";

interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  badge: "none" | "new" | "bestseller" | "healthy";
}

const FALLBACK_IMG = "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&q=80";

function formatUGX(n: number) {
  return `UGX ${Number(n).toLocaleString("en-US")}`;
}

async function fetchPopular(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price, image_url, badge")
    .eq("is_available", true)
    .limit(12);
  if (error) throw error;
  return ((data ?? []) as Item[]).sort((a, b) => {
    const aHas = a.badge !== "none" ? 0 : 1;
    const bHas = b.badge !== "none" ? 0 : 1;
    return aHas - bHas;
  });
}

export function PopularPicks() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { add } = useCart();
  const { data: items = [] } = useQuery({ queryKey: ["popular-picks"], queryFn: fetchPopular });

  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section id="menu" className="bg-background py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow">Popular Picks</p>
            <h2 className="mt-2 text-h1 text-charcoal">Customer Favorites</h2>
          </div>
          <a
            href="#menu"
            className="motion-button-elevate inline-flex items-center gap-2 rounded-[10px] border-2 border-secondary px-4 py-2 text-sm font-semibold text-secondary"
          >
            View Full Menu
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="relative mt-8">
          <button
            aria-label="Scroll left"
            onClick={() => scroll(-1)}
            className="absolute top-1/2 left-0 z-10 hidden -translate-x-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-secondary text-white shadow-soft transition-transform hover:scale-105 md:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Scroll right"
            onClick={() => scroll(1)}
            className="absolute top-1/2 right-0 z-10 hidden translate-x-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-secondary text-white shadow-soft transition-transform hover:scale-105 md:grid"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={scrollerRef}
            className="scrollbar-none flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4"
            style={{ scrollbarWidth: "none" }}
          >
            {items.map((item) => (
              <article
                key={item.id}
                className="motion-card-lift group relative flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-[20px] bg-card shadow-soft"
              >
                <div className="motion-image-zoom relative aspect-[4/3] overflow-hidden rounded-b-none">
                  <img
                    src={item.image_url || FALLBACK_IMG}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {item.badge !== "none" && (
                    <span className="absolute top-3 left-3 rounded-full bg-primary px-3 py-1 text-[10px] font-bold tracking-wider text-primary-foreground uppercase">
                      {item.badge}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-base font-bold text-charcoal">{item.name}</h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <p className="text-lg font-bold text-secondary">{formatUGX(item.price)}</p>
                    <button
                      aria-label={`Add ${item.name} to cart`}
                      onClick={() =>
                        add({
                          id: item.id,
                          name: item.name,
                          price: Number(item.price),
                          imageUrl: item.image_url,
                        })
                      }
                      className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform hover:scale-110"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {items.length === 0 && (
              <p className="text-body-sm text-muted-foreground">No menu items yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
