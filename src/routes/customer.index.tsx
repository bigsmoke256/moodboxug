import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/customer/")({
  component: CustomerHome,
});

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  badge: string;
}

function CustomerHome() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, description, price, badge")
        .eq("is_available", true);
      setItems((data ?? []) as MenuItem[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-eyebrow">Customer app</p>
        <h1 className="mt-2 text-display-2 text-charcoal">Phase 1 seed test</h1>
        <p className="mt-3 text-body text-muted-foreground">
          Menu items loaded via RLS as the signed-in customer. Full UI ships in Phase 2.
        </p>

        <div className="mt-8 space-y-3">
          {loading && <p className="text-body-sm text-muted-foreground">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="text-body-sm text-muted-foreground">No menu items yet.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="motion-card-lift rounded-[var(--radius-card)] bg-card p-5 shadow-soft"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-h3 text-charcoal">{item.name}</h2>
                {item.badge !== "none" && (
                  <span className="rounded-[var(--radius-pill)] bg-primary/10 px-3 py-1 text-caption text-primary">
                    {item.badge}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-2 text-body-sm text-muted-foreground">{item.description}</p>
              )}
              <p className="mt-3 text-body font-semibold text-secondary">
                UGX {Number(item.price).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
