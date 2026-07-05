import { Link } from "@tanstack/react-router";
import { ArrowRight, Cake, Briefcase, PartyPopper, Heart, Flower2 } from "lucide-react";

const OCCASIONS = [
  { Icon: Heart, label: "Weddings" },
  { Icon: Cake, label: "Birthdays" },
  { Icon: Briefcase, label: "Corporate Events" },
  { Icon: PartyPopper, label: "Private Parties" },
  { Icon: Flower2, label: "Funerals & Memorials" },
];

export function CateringSection() {
  return (
    <section id="catering" className="bg-background py-16">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 md:grid-cols-2 md:items-center lg:px-8">
        <div>
          <p className="text-eyebrow">We Cater For</p>
          <h2 className="mt-2 text-h1 text-charcoal">Every Occasion</h2>
          <ul className="mt-8 grid grid-cols-5 gap-4">
            {OCCASIONS.map(({ Icon, label }) => (
              <li key={label} className="flex flex-col items-center text-center">
                <div className="motion-card-lift grid h-14 w-14 place-items-center rounded-full bg-secondary/15">
                  <Icon className="h-6 w-6 text-secondary" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-[11px] font-medium leading-tight text-charcoal">
                  {label}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="text-h2 text-charcoal">
              Delicious Food. Perfectly Catered for Your Event.
            </h3>
            <p className="mt-3 max-w-md text-body text-charcoal/70">
              From small gatherings to big celebrations, we've got you covered.
            </p>
            <Link
              to="/catering"
              className="motion-button-elevate mt-5 inline-flex items-center gap-2 rounded-[10px] bg-secondary px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-secondary-foreground shadow-soft"
            >
              Cater With Us
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="motion-image-zoom relative aspect-square w-full max-w-[220px] overflow-hidden rounded-[16px] shadow-soft md:w-[220px]">
            <img
              src="https://images.unsplash.com/photo-1555244162-803834f70033?w=800&q=80"
              alt="Catering trays with prepared food"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
