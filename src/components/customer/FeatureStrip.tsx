import { Truck, Leaf, ChefHat, Heart, type LucideIcon } from "lucide-react";

interface Feature {
  Icon: LucideIcon;
  title: string;
  desc: string;
  color: "coral" | "turquoise";
}

const FEATURES: Feature[] = [
  { Icon: Truck, title: "Fast Delivery", desc: "Quick & reliable delivery to you", color: "turquoise" },
  { Icon: Leaf, title: "Fresh Ingredients", desc: "Locally sourced, always fresh", color: "coral" },
  { Icon: ChefHat, title: "Expert Chefs", desc: "Meals crafted by passionate chefs", color: "turquoise" },
  { Icon: Heart, title: "Made with Love", desc: "Every meal made with care", color: "coral" },
];

export function FeatureStrip() {
  return (
    <section className="border-b border-border/60 bg-background py-10">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:grid-cols-2 sm:px-6 md:grid-cols-4 md:divide-x md:divide-border/60 lg:px-8">
        {FEATURES.map(({ Icon, title, desc, color }) => (
          <div key={title} className="flex items-center gap-4 md:px-6">
            <Icon
              className="h-9 w-9 shrink-0"
              strokeWidth={1.5}
              style={{ color: color === "coral" ? "var(--coral)" : "var(--turquoise)" }}
            />
            <div className="min-w-0">
              <h3 className="text-body font-bold text-charcoal">{title}</h3>
              <p className="mt-0.5 text-body-sm text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
