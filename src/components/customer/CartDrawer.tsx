import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatUGX, type AppliedPromo } from "@/hooks/use-cart";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&q=80";

export function CartDrawer() {
  const cart = useCart();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const applyPromo = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setChecking(true);
    setPromoError(null);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("promotions")
      .select("code, type, value, active_from, active_to, is_active")
      .eq("code", trimmed)
      .eq("is_active", true)
      .maybeSingle();
    setChecking(false);
    if (error || !data) {
      setPromoError("Invalid or expired code.");
      return;
    }
    if (data.active_from && data.active_from > nowIso) {
      setPromoError("This code isn't active yet.");
      return;
    }
    if (data.active_to && data.active_to < nowIso) {
      setPromoError("This code has expired.");
      return;
    }
    const applied: AppliedPromo = {
      code: data.code,
      type: data.type,
      value: Number(data.value),
    };
    cart.applyPromo(applied);
    toast.success(`Promo ${data.code} applied`);
    setCode("");
  };

  if (!cart.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Cart">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={cart.closeCart} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-h3 text-charcoal">Your Cart ({cart.count})</h2>
          <button
            aria-label="Close cart"
            onClick={cart.closeCart}
            className="grid h-9 w-9 place-items-center rounded-full text-charcoal hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-surface text-muted-foreground">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="text-body text-charcoal">Your cart is empty.</p>
            <button
              onClick={cart.closeCart}
              className="motion-button-elevate rounded-[12px] bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground"
            >
              Explore Menu
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {cart.lines.map((line) => {
                const optExtras = line.options.reduce((s, o) => s + o.priceDelta, 0);
                const unit = line.basePrice + optExtras;
                return (
                  <article key={line.key} className="flex gap-3 rounded-[16px] bg-card p-3 shadow-soft">
                    <img
                      src={line.imageUrl || FALLBACK_IMG}
                      alt={line.name}
                      className="h-16 w-16 shrink-0 rounded-[12px] object-cover"
                    />
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-body font-semibold text-charcoal">{line.name}</h3>
                        <button
                          aria-label={`Remove ${line.name}`}
                          onClick={() => cart.remove(line.key)}
                          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {line.options.length > 0 && (
                        <p className="mt-0.5 text-caption text-muted-foreground">
                          {line.options.map((o) => o.name).join(", ")}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 rounded-full border border-input px-1.5 py-0.5">
                          <button
                            aria-label="Decrease"
                            onClick={() => cart.setQty(line.key, line.quantity - 1)}
                            className="grid h-7 w-7 place-items-center rounded-full text-charcoal hover:bg-surface"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center text-body-sm font-semibold">{line.quantity}</span>
                          <button
                            aria-label="Increase"
                            onClick={() => cart.setQty(line.key, line.quantity + 1)}
                            className="grid h-7 w-7 place-items-center rounded-full text-charcoal hover:bg-surface"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-body font-bold text-secondary">
                          {formatUGX(unit * line.quantity)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-border px-5 py-4">
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Promo code"
                  className="flex-1 rounded-[10px] border border-input bg-background px-3 py-2 text-body-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  disabled={checking}
                  onClick={applyPromo}
                  className="rounded-[10px] bg-secondary px-4 py-2 text-body-sm font-semibold text-secondary-foreground disabled:opacity-70"
                >
                  {checking ? "…" : "Apply"}
                </button>
              </div>
              {promoError && <p className="mt-1 text-caption text-destructive">{promoError}</p>}
              {cart.promo && (
                <p className="mt-1 text-caption text-secondary">
                  {cart.promo.code} applied ·{" "}
                  <button className="underline" onClick={() => cart.applyPromo(null)}>
                    remove
                  </button>
                </p>
              )}

              <dl className="mt-3 space-y-1 text-body-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="text-charcoal">{formatUGX(cart.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="text-charcoal">{formatUGX(cart.deliveryFee)}</dd>
                </div>
                {cart.discount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd className="text-secondary">-{formatUGX(cart.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-body">
                  <dt className="font-semibold text-charcoal">Total</dt>
                  <dd className="font-bold text-secondary">{formatUGX(cart.total)}</dd>
                </div>
              </dl>

              <Link
                to="/customer/checkout"
                onClick={cart.closeCart}
                className="motion-button-elevate mt-4 block w-full rounded-[12px] bg-primary py-3 text-center text-body font-semibold text-primary-foreground"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
