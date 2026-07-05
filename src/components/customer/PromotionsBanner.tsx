import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Promo {
  id: string;
  code: string;
  type: string;
  value: number;
}

async function fetchPromo(): Promise<Promo | null> {
  const { data } = await supabase
    .from("promotions")
    .select("id, code, type, value")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data as Promo) ?? null;
}

export function PromotionsBanner() {
  const { data: promo } = useQuery({ queryKey: ["active-promo"], queryFn: fetchPromo });
  const discount = promo?.type === "percentage" ? `${Math.round(promo.value)}%` : "20%";

  return (
    <section className="bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative grid overflow-hidden rounded-[20px] bg-secondary/15 md:grid-cols-2">
          {/* faint geometric pattern */}
          <svg
            aria-hidden
            className="pointer-events-none absolute -left-6 top-6 h-56 w-56 text-secondary/30"
            viewBox="0 0 200 200"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <polygon
                key={i}
                points="100,20 175,60 175,140 100,180 25,140 25,60"
                transform={`rotate(${i * 15} 100 100) scale(${0.4 + i * 0.1})`}
                transform-origin="100 100"
              />
            ))}
          </svg>

          <div className="relative z-10 p-8 md:p-12">
            <h2 className="text-h1 text-secondary">Order More, Save More</h2>
            <p className="mt-3 max-w-md text-body text-charcoal/70">
              Enjoy exclusive deals on your favorite meals and combos.
            </p>
            <a
              href="#menu"
              className="motion-button-elevate mt-6 inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-soft"
            >
              See Offers
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="relative min-h-[240px] md:min-h-[280px]">
            <img
              src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80"
              alt="Burger, fries and drink combo"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute top-1/2 -left-10 -translate-y-1/2 grid h-24 w-24 place-items-center rounded-full bg-primary text-center text-primary-foreground shadow-soft md:h-28 md:w-28">
              <div>
                <div className="text-[9px] font-semibold tracking-wider uppercase">Up to</div>
                <div className="text-xl font-bold leading-tight">{discount}</div>
                <div className="text-[9px] font-semibold tracking-wider uppercase">Off</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
