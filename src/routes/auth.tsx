import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { acceptStaffInvite } from "@/lib/staff.functions";

const searchSchema = z.object({
  redirect: z.string().optional(),
  invite: z.string().optional(),
});


export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Mood Box" },
      { name: "description", content: "Sign in or create your Mood Box account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function isSafeRedirect(path: string | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.invite ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const accept = useServerFn(acceptStaffInvite);

  const roleRedirect = async (userId: string): Promise<string> => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role);
    if (roles.includes("admin")) return "/admin";
    if (roles.includes("kitchen")) return "/kitchen";
    if (roles.includes("driver")) return "/driver";
    return "/";
  };


  const applyInviteIfAny = async (): Promise<string | null> => {
    if (!search.invite) return null;
    try {
      const result = await accept({ data: { token: search.invite } });
      if (result.ok) {
        toast.success(`Welcome — you're set up as ${result.role}.`);
        return result.role === "driver"
          ? "/driver"
          : result.role === "kitchen"
            ? "/kitchen"
            : result.role === "admin"
              ? "/admin"
              : null;
      }
      const messages: Record<string, string> = {
        invalid: "Invite link is invalid.",
        expired: "This invite has expired — ask an admin for a new one.",
        already_accepted: "This invite has already been used.",
        email_mismatch: "Please sign in with the email the invite was sent to.",
      };
      toast.error(messages[result.error] ?? "Could not accept invite");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept invite");
    }
    return null;
  };

  // If already signed in, honor the invite / redirect immediately.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted || !data.session) return;
      const inviteTarget = await applyInviteIfAny();
      const target = inviteTarget ?? (isSafeRedirect(search.redirect) ? search.redirect : "/");
      navigate({ to: target });
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, search.redirect, search.invite]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const inviteTarget = await applyInviteIfAny();
      const target =
        inviteTarget ?? (isSafeRedirect(search.redirect) ? search.redirect : "/");
      navigate({ to: target });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-soft">
        <h1 className="text-h1 text-charcoal">
          {mode === "signup" ? "Join Mood Box" : "Welcome back"}
        </h1>
        <p className="mt-2 text-body-sm text-muted-foreground">
          {mode === "signup"
            ? "Create your account to start ordering."
            : "Sign in to continue."}
        </p>

        {search.invite && (
          <div className="mt-4 rounded-[12px] bg-primary/10 px-3 py-2 text-body-sm text-primary">
            You've been invited to join as staff. Use the email the invite was sent to.
          </div>
        )}


        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-body-sm font-medium text-charcoal">Full name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                className="mt-1 w-full rounded-[var(--radius-input)] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          <div>
            <label className="text-body-sm font-medium text-charcoal">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              className="mt-1 w-full rounded-[var(--radius-input)] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-body-sm font-medium text-charcoal">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === "signup" ? 8 : 1}
              className="mt-1 w-full rounded-[var(--radius-input)] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
            {mode === "signup" && (
              <p className="mt-1 text-caption text-muted-foreground">Minimum 8 characters.</p>
            )}
          </div>

          {error && <p className="text-body-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="motion-button-elevate w-full rounded-[var(--radius-button)] bg-primary py-2.5 text-body font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-4 w-full text-body-sm text-muted-foreground hover:text-charcoal"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New to Mood Box? Create an account"}
        </button>
      </div>
    </div>
  );
}
