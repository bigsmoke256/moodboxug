import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth, type AppRole } from "@/hooks/use-auth";

interface RoleGateProps {
  role: AppRole;
  children: ReactNode;
}

/**
 * Client-only role gate. Redirects unauthenticated users to /auth with the
 * current pathname preserved as `redirect` so they land back where they were
 * after signing in. Users with the wrong role are bounced home.
 */
export function RoleGate({ role, children }: RoleGateProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (auth.status === "signed-out") {
      navigate({
        to: "/auth",
        search: { redirect: location.pathname + (location.searchStr ?? "") },
      });
      return;
    }
    if (auth.status === "signed-in" && !auth.roles.includes(role)) {
      // Roles load async — wait a tick before bouncing.
      const timer = setTimeout(() => {
        if (!auth.roles.includes(role)) navigate({ to: "/" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [auth.status, auth.roles, role, navigate, location.pathname, location.searchStr]);

  if (auth.status !== "signed-in" || !auth.roles.includes(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-body-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
