import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Bike,
  ChefHat,
  FileText,
  LayoutDashboard,
  Mail,
  Menu as MenuIcon,
  MessageSquare,
  Package,
  Percent,
  Settings as SettingsIcon,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";


const NAV = [
  { to: "/admin" as const, label: "Overview", icon: LayoutDashboard },
  { to: "/admin/orders" as const, label: "Orders", icon: ShoppingBag },
  { to: "/admin/menu" as const, label: "Menu", icon: ChefHat },
  { to: "/admin/inventory" as const, label: "Inventory", icon: Package },
  { to: "/admin/drivers" as const, label: "Drivers", icon: Bike },
  { to: "/admin/promotions" as const, label: "Promotions", icon: Percent },
  { to: "/admin/customers" as const, label: "Customers", icon: Users },
  { to: "/admin/reviews" as const, label: "Reviews", icon: MessageSquare },
  { to: "/admin/subscribers" as const, label: "Subscribers", icon: Mail },
  { to: "/admin/analytics" as const, label: "Analytics", icon: BarChart3 },
  { to: "/admin/reports" as const, label: "Reports", icon: FileText },
  { to: "/admin/settings" as const, label: "Settings", icon: SettingsIcon },
];

export function AdminShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`glass-surface-dark fixed inset-y-0 left-0 z-40 flex w-64 flex-col p-5 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <Link to="/admin" className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Moodbox
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-caption text-white/60">Admin</p>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/admin" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-body-sm transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={signOut}
            className="flex-1 rounded-[12px] border border-white/20 py-2 text-body-sm text-white/80 hover:bg-white/10"
          >
            Sign out
          </button>
          <ThemeToggle onDark />
        </div>

      </aside>

      {/* Backdrop for mobile */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-surface sticky top-0 z-20 flex items-center justify-between px-4 py-3 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-charcoal hover:bg-surface"
            aria-label="Open menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="text-body-sm font-semibold text-charcoal">Admin</span>
          <span className="w-9" />
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
