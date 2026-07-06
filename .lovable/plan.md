# Scope

Three passes in one turn:
1. **Admin Dashboard (Phase 3 Part B)** — the full-power admin app that was deferred.
2. **Glassmorphic visual pass** — selective, per your allow/deny list.
3. **Reliability & error-resilience pass** — loading/empty states, error boundary, form validation, server-side order totals, dedupe, realtime resilience, RLS re-check, 404/redirect.

Realistic expectation: this is a very large single turn. I'll prioritize correctness of the order-integrity work (real money bug prevention) and coverage of the reliability checklist over admin polish. Admin sub-sections (analytics charts, deep settings) will be functional but not lavish.

---

# Part B — Admin Dashboard

Route tree under `/admin` (existing `admin.tsx` layout, gated by `RoleGate` for admin/staff):

- `admin.index.tsx` — Overview: today's orders count, revenue, active orders, quick links.
- `admin.orders.tsx` — Kanban by status (pending → confirmed → preparing → ready → out_for_delivery → delivered), realtime, click card to open detail drawer with status transition + driver assignment.
- `admin.menu.tsx` — Menu items grid: create/edit/delete, image upload to `menu-images` (signed URLs), toggle is_available, manage categories in a side panel, item options editor (radios/checkboxes/price deltas).
- `admin.customers.tsx` — Customers table with search, VIP toggle, order history drawer.
- `admin.drivers.tsx` — Drivers list, create/edit, active toggle.
- `admin.inventory.tsx` — Inventory table, stock adjust, low-stock highlight.
- `admin.promotions.tsx` — Promo CRUD (code, type, value, dates, active).
- `admin.reviews.tsx` — Review moderation.
- `admin.subscribers.tsx` — Newsletter subscribers list + CSV export.
- `admin.analytics.tsx` — Simple charts (orders/day, revenue/day, top items) using recharts.
- `admin.settings.tsx` — Restaurant settings (name, delivery fee), stored as a row in `restaurants` or a `settings` jsonb.

Sidebar: fixed left nav with glass-surface-dark treatment.

---

# Part 1 — Glass design system

Add to `src/styles.css`:
- `@utility glass-surface` — `background: color-mix(in oklab, var(--cream) 65%, transparent); backdrop-filter: blur(14px) saturate(140%); border: 1px solid rgba(255,255,255,0.35); box-shadow: var(--shadow-soft);`
- `@utility glass-surface-dark` — dark translucent variant for photo/dark backdrops.
- Use standard `backdrop-filter` only (Lightning CSS handles prefixes).

Apply to: Header (on scroll), MenuItemModal panel + backdrop, CartDrawer panel, admin FAB, admin sidebar (dark variant), promo overlay pills.

Skip: admin data tables/kanban cards, all form inputs, existing PopularPicks cards.

---

# Part 2 — Reliability hardening

**Loading / empty states**
- Every `useQuery`: skeleton on `isLoading`, designed empty state on empty. Reusable `<EmptyState icon title description action?/>` component.

**Error handling**
- Add `errorComponent` and `notFoundComponent` on every route that has a loader; root route gets a `notFoundComponent` for unmatched URLs.
- Root-level React error boundary via TanStack's `defaultErrorComponent` — friendly fallback + Reload.
- Every mutation wrapped in try/catch → `toast.error(...)`. Distinguish `TypeError: Failed to fetch` (network) with a "Connection issue — retry" message.

**Form validation**
- Add `zod` schemas to: checkout form, menu item editor, category editor, promotions editor, inventory editor, profile/account form, newsletter subscribe. Use `react-hook-form` + `@hookform/resolvers/zod` where forms are non-trivial; inline field errors.

**Order integrity (critical)**
- New `src/lib/orders.functions.ts` `placeOrder` server function using `requireSupabaseAuth`:
  - Input: `{ items: [{ menu_item_id, quantity, option_ids: string[] }], promo_code?, delivery: {...}, payment_method }`.
  - Server re-fetches `menu_items` + `item_options` for the given ids; rejects if any `is_available=false` or missing (returns `{ error: "unavailable", items: [...] }` for UI to surface).
  - Recomputes subtotal from server-side prices + option deltas.
  - Re-validates promo (active, within dates, code match) and recomputes discount.
  - Applies flat delivery fee from settings.
  - Inserts `orders` + `order_items` in a transaction (via `rpc` or sequential inserts under service role); returns `order_id`.
- Client checkout: swap direct inserts for `placeOrder` server fn. "Place Order" button uses `useMutation` — disabled while `isPending` (dedupe).

**Realtime resilience**
- Wrap subscription setup with connection listeners; show a small "Reconnecting…" pill when status !== `SUBSCRIBED`; on reconnect, `queryClient.invalidateQueries` for the relevant key.

**Access control**
- Run `supabase--linter`. Audit RLS on: addresses, customer_favorites, newsletter_subscribers, plus every table added so far. Fix any gaps in a migration.

**Fallbacks**
- Protected routes (admin/kitchen/driver/customer.orders/customer.checkout) redirect to `/auth?redirect=<path>`; `/auth` honors `redirect` after sign-in.
- Custom `notFoundComponent` for root.
- Image upload in menu editor: validate type (jpg/png/webp) + size (<5MB) client-side; catch upload error and surface toast with retry.

---

# Technical notes

- No new deps expected beyond `zod` (already in), `react-hook-form`, `@hookform/resolvers`, `recharts`. Install as needed.
- Server-fn `placeOrder` must load `client.server` inside handler (per import-graph rules).
- Newsletter subscribe/checkout/etc. already exist — I'll edit not rewrite.
- Migration: only if RLS lint flags gaps. No schema shape changes expected.

---

# Delivery order (within this turn)

1. Migration if RLS lint requires it.
2. `placeOrder` server fn + checkout rewire (highest-risk correctness item).
3. Admin routes.
4. Glass utilities + selective application.
5. Error boundary, empty-state component, per-route error/notFound components, realtime reconnect pill, redirect-with-return-path.
6. Form validation sweep.

Reply "approve" to proceed, or tell me what to trim.