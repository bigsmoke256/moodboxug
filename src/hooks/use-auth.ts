import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "customer" | "admin" | "kitchen" | "driver";

export interface AuthState {
  status: "loading" | "signed-in" | "signed-out";
  user: User | null;
  session: Session | null;
  roles: AppRole[];
}

async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((r) => r.role as AppRole);
}

/**
 * Client-only auth hook. Subscribes to Supabase auth state and loads
 * the current user's roles from `user_roles`. Every role-scoped route
 * gate reads from here.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    session: null,
    roles: [],
  });

  useEffect(() => {
    let mounted = true;

    // Listener first, then bootstrap.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (!session) {
        setState({ status: "signed-out", user: null, session: null, roles: [] });
        return;
      }
      setState((prev) => ({
        ...prev,
        status: "signed-in",
        user: session.user,
        session,
      }));
      // Defer role fetch so we don't block the listener.
      setTimeout(async () => {
        if (!mounted) return;
        const roles = await fetchRoles(session.user.id);
        if (!mounted) return;
        setState((prev) => ({ ...prev, roles }));
      }, 0);
      void event;
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setState({ status: "signed-out", user: null, session: null, roles: [] });
        return;
      }
      const roles = await fetchRoles(data.session.user.id);
      if (!mounted) return;
      setState({
        status: "signed-in",
        user: data.session.user,
        session: data.session,
        roles,
      });
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function hasRole(roles: AppRole[], role: AppRole): boolean {
  return roles.includes(role);
}
