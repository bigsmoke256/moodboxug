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
    <section className="bg-background py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
        {FEATURES.map(({ Icon, title, desc, color }) => (
          <div key={title} className="flex flex-col items-center text-center">
            <Icon
              className="h-10 w-10"
              strokeWidth={1.5}
              style={{ color: color === "coral" ? "var(--coral)" : "var(--turquoise)" }}
            />
            <h3 className="mt-4 text-h3 text-charcoal">{title}</h3>
            <p className="mt-1 max-w-[16ch] text-body-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
