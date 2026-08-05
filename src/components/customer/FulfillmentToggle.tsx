import type { Fulfillment } from "@/hooks/use-cart";

export function FulfillmentToggle({
  value,
  onChange,
  className = "",
}: {
  value: Fulfillment;
  onChange: (v: Fulfillment) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Delivery or pickup"
      className={`grid grid-cols-2 gap-1 rounded-full border border-input bg-surface p-1 ${className}`}
    >
      {(["delivery", "pickup"] as const).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode)}
            className={`rounded-full px-4 py-2 text-body-sm font-semibold transition-colors ${
              active ? "bg-primary text-primary-foreground shadow-soft" : "text-charcoal hover:bg-card"
            }`}
          >
            {mode === "delivery" ? "Delivery" : "Pickup"}
          </button>
        );
      })}
    </div>
  );
}
