import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:items-center md:gap-8 md:py-20 lg:px-8">
        <div className="order-2 md:order-1">
          <h1
            className="text-display-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="block text-primary">Good Food,</span>
            <span className="block text-secondary">Good Mood</span>
          </h1>
          <p className="mt-6 max-w-md text-body text-charcoal/80">
            Delicious meals made with love and the freshest ingredients.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#menu"
              className="motion-button-elevate inline-flex items-center gap-2 rounded-[10px] bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-soft"
            >
              Order Now
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#menu"
              className="motion-button-elevate inline-flex items-center gap-2 rounded-[10px] border-2 border-secondary bg-transparent px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-secondary hover:bg-secondary/5"
            >
              Explore Menu
            </a>
          </div>
        </div>

        <div className="relative order-1 md:order-2 md:-ml-10">
          <div className="motion-image-zoom relative aspect-square overflow-hidden rounded-[16px] shadow-soft">
            <img
              src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=80"
              alt="Grilled protein plated with rice, salad, tomatoes and avocado"
              className="h-full w-full object-cover"
            />
          </div>
          {/* leaf garnish accent */}
          <div className="pointer-events-none absolute -top-4 right-8 hidden h-16 w-16 rounded-full bg-secondary/30 blur-2xl md:block" />
        </div>
      </div>
    </section>
  );
}
