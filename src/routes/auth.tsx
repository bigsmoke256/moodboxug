import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  redirect: z.string().optional(),
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If already signed in, honor the redirect immediately.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted || !data.session) return;
      const target = isSafeRedirect(search.redirect) ? search.redirect : "/";
      navigate({ to: target });
    });
    return () => {
      mounted = false;
    };
  }, [navigate, search.redirect]);

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
      const target = isSafeRedirect(search.redirect) ? search.redirect : "/";
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
