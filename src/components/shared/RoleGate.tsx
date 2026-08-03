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
    // Only bounce once roles are definitively known — otherwise a slow role
    // fetch looks like "wrong role" and kicks the user back to the homepage.
    if (auth.status === "signed-in" && auth.rolesLoaded && !auth.roles.includes(role)) {
      navigate({ to: "/" });
    }
  }, [
    auth.status,
    auth.roles,
    auth.rolesLoaded,
    role,
    navigate,
    location.pathname,
    location.searchStr,
  ]);

  if (auth.status !== "signed-in" || !auth.rolesLoaded || !auth.roles.includes(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-body-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
