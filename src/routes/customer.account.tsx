import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Heart, Package, Receipt, ShoppingBag, Sparkles, User as UserIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatUGX } from "@/hooks/use-cart";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/customer/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My account — Moodbox" },
      { name: "description", content: "Your Moodbox profile, orders and favourites." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

interface OrderWithItems {
  id: string;
  status: string;
  total: number;
  created_at: string;
  payment_method: string | null;
  payment_status: string;
  order_items: { menu_item_id: string; name: string; quantity: number; unit_price: number }[];
}

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_vip: boolean;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  assigned: "Driver assigned",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function AccountPage() {
  const auth = useAuth();
  const userId = auth.status === "signed-in" ? auth.user?.id ?? null : null;

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["account-profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url, is_vip, created_at")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["account-orders", userId],
    enabled: !!userId,
    queryFn: async (): Promise<OrderWithItems[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, total, created_at, payment_method, payment_status, order_items(menu_item_id, name, quantity, unit_price)",
        )
        .eq("customer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderWithItems[];
    },
  });

  const stats = useMemo(() => {
    const paying = orders.filter((o) => o.status !== "cancelled");
    const totalSpent = paying.reduce((s, o) => s + Number(o.total || 0), 0);
    const count = paying.length;
    const delivered = paying.filter((o) => o.status === "delivered").length;
    return { totalSpent, count, delivered };
  }, [orders]);

  const favourites = useMemo(() => {
    const tally = new Map<string, { name: string; qty: number; last: string }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      for (const it of o.order_items ?? []) {
        const cur = tally.get(it.menu_item_id) ?? { name: it.name, qty: 0, last: o.created_at };
        cur.qty += it.quantity;
        if (o.created_at > cur.last) cur.last = o.created_at;
        cur.name = it.name;
        tally.set(it.menu_item_id, cur);
      }
    }
    return Array.from(tally.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [orders]);

  if (auth.status === "loading") {
    return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  }
  if (auth.status === "signed-out") {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-body text-charcoal">Sign in to view your account.</p>
        <Link
          to="/auth"
          search={{ redirect: "/customer/account" }}
          className="mt-4 inline-block rounded-[12px] bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-eyebrow">Your account</p>
      <h1
        className="mt-2 text-display-2 text-charcoal"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
      </h1>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Receipt} label="Total spent" value={formatUGX(stats.totalSpent)} accent />
        <StatCard icon={ShoppingBag} label="Orders placed" value={String(stats.count)} />
        <StatCard icon={Package} label="Delivered" value={String(stats.delivered)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Profile + saved details */}
        <ProfileCard profile={profile ?? null} userId={userId!} onSaved={refetchProfile} />

        {/* Favourites */}
        <section className="rounded-[20px] bg-card p-6 shadow-soft lg:col-span-2">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <h2 className="text-h3 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
              Your favourites
            </h2>
          </div>
          {favourites.length === 0 ? (
            <p className="mt-3 text-body-sm text-muted-foreground">
              Order a few dishes and your most-loved picks will show up here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {favourites.map((f, i) => (
                <li key={f.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-body-sm font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-body font-semibold text-charcoal">{f.name}</p>
                      <p className="text-caption text-muted-foreground">
                        Ordered {f.qty} {f.qty === 1 ? "time" : "times"} · last on{" "}
                        {new Date(f.last).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {i === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-caption font-semibold text-primary">
                      <Sparkles className="h-3 w-3" /> Your #1
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Order history */}
      <section className="mt-8">
        <h2 className="text-h3 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
          Order history
        </h2>
        <div className="mt-4 space-y-3">
          {ordersLoading && <div className="h-24 animate-pulse rounded-[16px] bg-card" />}
          {!ordersLoading && orders.length === 0 && (
            <EmptyState
              icon={ShoppingBag}
              title="No orders yet"
              description="Your past orders will appear here."
              action={
                <Link
                  to="/customer"
                  className="inline-block rounded-[12px] bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground"
                >
                  Browse the menu
                </Link>
              }
            />
          )}
          {orders.map((o) => (
            <Link
              key={o.id}
              to="/customer/orders/$orderId"
              params={{ orderId: o.id }}
              className="motion-card-lift flex items-center justify-between rounded-[16px] bg-card p-4 shadow-soft"
            >
              <div>
                <p className="text-body-sm text-muted-foreground">
                  #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
                </p>
                <p className="mt-1 text-body font-semibold text-charcoal">
                  {STATUS_LABEL[o.status] ?? o.status}
                </p>
                <p className="text-caption text-muted-foreground">
                  {(o.order_items ?? []).reduce((s, i) => s + i.quantity, 0)} items · Payment:{" "}
                  {o.payment_method ?? "—"} · {o.payment_status}
                </p>
              </div>
              <span className="text-body font-bold text-secondary">{formatUGX(o.total)}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            toast.success("Signed out");
            window.location.href = "/customer";
          }}
          className="rounded-[12px] border border-border bg-card px-4 py-2 text-body-sm font-semibold text-charcoal hover:bg-surface"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] p-6 shadow-soft ${
        accent ? "bg-primary text-primary-foreground" : "bg-card"
      }`}
    >
      <div className="flex items-center gap-2 opacity-90">
        <Icon className="h-4 w-4" />
        <p className={`text-caption uppercase tracking-wider ${accent ? "" : "text-muted-foreground"}`}>
          {label}
        </p>
      </div>
      <p
        className={`mt-2 text-h1 ${accent ? "" : "text-charcoal"}`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
    </div>
  );
}

function ProfileCard({
  profile,
  userId,
  onSaved,
}: {
  profile: Profile | null;
  userId: string;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);

  // Sync when data loads.
  useMemo(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: fullName.trim() || null, phone: phone.trim() || null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
  };

  return (
    <section className="rounded-[20px] bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-primary" />
        <h2 className="text-h3 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
          Your details
        </h2>
        {profile?.is_vip && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-caption font-semibold text-primary">
            <Crown className="h-3 w-3" /> VIP
          </span>
        )}
      </div>
      <form onSubmit={save} className="mt-4 space-y-3">
        <div>
          <label className="text-body-sm font-medium text-charcoal">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-body-sm font-medium text-charcoal">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={30}
            className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="motion-button-elevate w-full rounded-[12px] bg-primary py-2.5 text-body-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
      {profile?.created_at && (
        <p className="mt-4 text-caption text-muted-foreground">
          Member since {new Date(profile.created_at).toLocaleDateString()}
        </p>
      )}
    </section>
  );
}
