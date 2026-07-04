import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Mood Box" },
      { name: "description", content: "Sign in or create your Mood Box account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
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
      navigate({ to: "/" });
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
              className="mt-1 w-full rounded-[var(--radius-input)] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
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
