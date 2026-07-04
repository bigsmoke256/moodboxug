import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth, type AppRole } from "@/hooks/use-auth";

interface RoleGateProps {
  role: AppRole;
  children: ReactNode;
}

/**
 * Client-only role gate. Redirects unauthenticated users to /auth and
 * users with the wrong role to /. Wrap every role-scoped layout with this.
 */
export function RoleGate({ role, children }: RoleGateProps) {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.status === "signed-out") {
      navigate({ to: "/auth", search: { next: `/${role}` } as never });
      return;
    }
    if (auth.status === "signed-in" && !auth.roles.includes(role)) {
      // If we know roles and they don't include the required one, bounce home.
      // Roles load async — wait until at least one role is present OR the fetch settled.
      // We infer "settled" by `signed-in` status + presence check on next tick.
      const timer = setTimeout(() => {
        if (!auth.roles.includes(role)) navigate({ to: "/" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [auth.status, auth.roles, role, navigate]);

  if (auth.status !== "signed-in" || !auth.roles.includes(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-body-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
