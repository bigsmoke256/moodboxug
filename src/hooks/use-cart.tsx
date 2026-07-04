import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface SelectedOption {
  group: string;
  name: string;
  priceDelta: number;
}

export interface CartLine {
  key: string; // menuItemId + optionsHash
  menuItemId: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  options: SelectedOption[];
  quantity: number;
}

export interface AppliedPromo {
  code: string;
  type: "percentage" | "fixed_amount" | "free_delivery" | "combo";
  value: number;
}

interface CartState {
  lines: CartLine[];
  count: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  promo: AppliedPromo | null;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (line: Omit<CartLine, "key" | "quantity">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  applyPromo: (promo: AppliedPromo | null) => void;
}

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = "moodbox_cart_v1";
const DEFAULT_DELIVERY_FEE = 5000;

function lineTotal(l: CartLine) {
  const optExtras = l.options.reduce((s, o) => s + Number(o.priceDelta || 0), 0);
  return (Number(l.basePrice) + optExtras) * l.quantity;
}

function makeKey(menuItemId: string, options: SelectedOption[]) {
  const opt = options
    .map((o) => `${o.group}:${o.name}`)
    .sort()
    .join("|");
  return `${menuItemId}::${opt}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // hydrate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { lines?: CartLine[]; promo?: AppliedPromo | null };
        if (parsed.lines) setLines(parsed.lines);
        if (parsed.promo) setPromo(parsed.promo);
      }
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, promo }));
  }, [lines, promo, hydrated]);

  const add = useCallback(
    (input: Omit<CartLine, "key" | "quantity">, qty = 1) => {
      const key = makeKey(input.menuItemId, input.options);
      setLines((prev) => {
        const found = prev.find((l) => l.key === key);
        if (found) {
          return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + qty } : l));
        }
        return [...prev, { ...input, key, quantity: qty }];
      });
    },
    [],
  );

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)),
    );
  }, []);

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => {
    setLines([]);
    setPromo(null);
  }, []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const applyPromo = useCallback((p: AppliedPromo | null) => setPromo(p), []);

  const derived = useMemo(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
    let deliveryFee = lines.length > 0 ? DEFAULT_DELIVERY_FEE : 0;
    let discount = 0;
    if (promo) {
      if (promo.type === "percentage") discount = Math.round((subtotal * promo.value) / 100);
      else if (promo.type === "fixed_amount") discount = promo.value;
      else if (promo.type === "free_delivery") deliveryFee = 0;
    }
    const total = Math.max(0, subtotal + deliveryFee - discount);
    return { count, subtotal, deliveryFee, discount, total };
  }, [lines, promo]);

  const value = useMemo<CartState>(
    () => ({
      lines,
      ...derived,
      promo,
      isOpen,
      openCart,
      closeCart,
      add,
      setQty,
      remove,
      clear,
      applyPromo,
    }),
    [lines, derived, promo, isOpen, openCart, closeCart, add, setQty, remove, clear, applyPromo],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

export function formatUGX(n: number) {
  return `UGX ${Number(n).toLocaleString("en-US")}`;
}
