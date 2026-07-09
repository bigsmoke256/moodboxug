import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, MapPin, Mail, Phone, MessageCircle, Lock } from "lucide-react";


const QUICK = [
  { label: "Home", to: "/customer" as const },
  { label: "Menu", href: "#menu" },
  { label: "Catering", to: "/catering" as const },
  { label: "About Us", href: "#about" },
  { label: "Contact", href: "#contact" },
];
const HELP = ["FAQs", "Delivery Info", "Terms & Conditions", "Privacy Policy"];

export function Footer() {
  return (
    <footer id="contact" className="relative overflow-hidden bg-secondary text-secondary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <p
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Moodbox
          </p>
          <p className="mt-3 text-body-sm text-white/85">
            Good food. Good mood. Every time you order.
          </p>
          <div className="mt-5 flex gap-3">
            {[Facebook, Instagram, MessageCircle].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/60 text-white transition-colors hover:bg-white/10"
                aria-label="Social link"
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
              </a>
            ))}
            <Link
              to="/auth"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/30 text-white/70 transition-colors hover:border-white/60 hover:text-white"
              aria-label="Staff login"
              title="Staff login"
            >
              <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>

        </div>

        <div>
          <h3 className="text-h3 text-white">Quick Links</h3>
          <ul className="mt-4 space-y-2 text-body-sm text-white/85">
            {QUICK.map((q) =>
              "to" in q ? (
                <li key={q.label}>
                  <Link to={q.to} className="hover:text-white">
                    {q.label}
                  </Link>
                </li>
              ) : (
                <li key={q.label}>
                  <a href={q.href} className="hover:text-white">
                    {q.label}
                  </a>
                </li>
              ),
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-h3 text-white">Help</h3>
          <ul className="mt-4 space-y-2 text-body-sm text-white/85">
            {HELP.map((h) => (
              <li key={h}>
                <a href="#" className="hover:text-white">
                  {h}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-h3 text-white">Contact Us</h3>
          <ul className="mt-4 space-y-3 text-body-sm text-white/85">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" /> +256 700 000 000
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" /> hello@moodbox.ug
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" /> Kampala, Uganda
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-caption text-white/70 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Moodbox. All rights reserved.
        </div>
      </div>

      {/* decorative pattern */}
      <svg
        aria-hidden
        className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 text-white/10"
        viewBox="0 0 200 200"
        fill="none"
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <circle key={i} cx="100" cy="100" r={15 + i * 12} stroke="currentColor" strokeWidth="1" />
        ))}
      </svg>
    </footer>
  );
}
