import { Link, useLocation } from "@tanstack/react-router";
import { Search, ShoppingCart, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/hooks/use-cart";

const NAV = [
  { label: "Home", to: "/customer" as const },
  { label: "Menu", href: "#menu" },
  { label: "Catering", to: "/catering" as const },
  { label: "My Orders", to: "/customer/orders" as const },
  { label: "Contact", href: "#contact" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { count, openCart } = useCart();
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full bg-cream/95 backdrop-blur transition-shadow ${
        scrolled ? "shadow-soft" : ""
      }`}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/customer"
          className="text-2xl font-bold text-secondary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Moodbox
        </Link>

        <nav className="hidden items-center justify-center gap-10 md:flex">
          {NAV.map((item) => {
            const isActive = "to" in item && item.to === pathname;
            const className = `nav-underline text-[13px] font-semibold uppercase tracking-[0.16em] transition-colors ${
              isActive ? "text-primary" : "text-charcoal hover:text-primary"
            }`;
            return "to" in item ? (
              <Link
                key={item.label}
                to={item.to}
                className={className}
                data-active={isActive ? "true" : undefined}
              >
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className={className}>
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <button
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-full text-charcoal transition-colors hover:bg-surface"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            to="/auth"
            aria-label="Profile"
            className="grid h-10 w-10 place-items-center rounded-full text-charcoal transition-colors hover:bg-surface"
          >
            <User className="h-5 w-5" />
          </Link>
          <button
            onClick={openCart}
            aria-label={`Cart (${count} items)`}
            className="relative grid h-10 w-10 place-items-center rounded-full text-charcoal transition-colors hover:bg-surface"
          >
            <ShoppingCart className="h-5 w-5" />
            <span
              className={`absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground transition-opacity ${
                count > 0 ? "opacity-100" : "opacity-0"
              }`}
            >
              {count}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
