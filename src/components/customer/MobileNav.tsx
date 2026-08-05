import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Headphones, Home, Layers, ShoppingBag, User, UtensilsCrossed, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupportChat } from "@/hooks/use-support-chat";

interface Category {
  id: string;
  name: string;
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const support = useSupportChat();

  const { data: categories = [] } = useQuery({
    queryKey: ["nav-categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });
      return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
    },
  });

  if (!open) return null;

  const jump = (hash: string) => {
    onClose();
    void navigate({ to: "/customer", hash }).then(() => {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in" onClick={onClose} />
      <aside className="absolute top-0 left-0 flex h-full w-[84%] max-w-[320px] flex-col bg-card shadow-2xl animate-in slide-in-from-left duration-200">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-2xl font-bold text-secondary" style={{ fontFamily: "var(--font-display)" }}>
            Moodbox
          </span>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-charcoal hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            <li>
              <Link to="/customer" onClick={onClose} className={rowClass}>
                <Home className="h-4 w-4 text-primary" /> Home
              </Link>
            </li>
            <li>
              <Link to="/customer/orders" onClick={onClose} className={rowClass}>
                <ShoppingBag className="h-4 w-4 text-primary" /> My Orders
              </Link>
            </li>
            <li>
              <button
                onClick={() => {
                  onClose();
                  support.open();
                }}
                className={`${rowClass} w-full`}
              >
                <Headphones className="h-4 w-4 text-primary" /> Live Support
              </button>
            </li>
            <li>
              <Link to="/catering" onClick={onClose} className={rowClass}>
                <UtensilsCrossed className="h-4 w-4 text-primary" /> Catering
              </Link>
            </li>
            <li>
              <Link to="/customer/account" onClick={onClose} className={rowClass}>
                <User className="h-4 w-4 text-primary" /> Account
              </Link>
            </li>
          </ul>

          <hr className="my-4 border-border" />

          <button onClick={() => jump("menu")} className={`${rowClass} w-full`}>
            <Layers className="h-4 w-4 text-primary" /> Everything
          </button>

          <p className="mt-4 px-3 text-caption uppercase tracking-[0.16em] text-muted-foreground">
            Categories
          </p>
          <ul className="mt-2 space-y-1">
            {categories.map((c) => (
              <li key={c.id}>
                <button onClick={() => jump(`cat-${c.id}`)} className={`${rowClass} w-full`}>
                  {c.name}
                </button>
              </li>
            ))}
            {categories.length === 0 && (
              <li className="px-3 py-2 text-body-sm text-muted-foreground">No categories yet.</li>
            )}
          </ul>
        </nav>
      </aside>
    </div>
  );
}

const rowClass =
  "flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-body font-medium text-charcoal hover:bg-surface";
