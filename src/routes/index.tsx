import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-h2 text-secondary">Moodbox</span>
        <Link
          to="/auth"
          className="motion-button-elevate rounded-[var(--radius-button)] border border-secondary px-4 py-2 text-body-sm font-semibold text-secondary"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-eyebrow">Phase 1 · Foundation</p>
        <h1 className="mt-3 text-display-1">
          <span className="text-primary">Good Food,</span>
          <br />
          <span className="text-secondary">Good Mood.</span>
        </h1>
        <p className="mt-6 max-w-xl text-body text-muted-foreground">
          Backend, auth, roles, and design tokens are live. Phase 2 will build the
          customer homepage matched to the mockup, using this same schema and system.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/customer" as const, label: "Customer app", role: "customer" },
            { to: "/admin" as const, label: "Admin app", role: "admin" },
            { to: "/kitchen" as const, label: "Kitchen app", role: "kitchen" },
            { to: "/driver" as const, label: "Driver app", role: "driver" },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="motion-card-lift rounded-[var(--radius-card)] bg-card p-5 shadow-soft"
            >
              <p className="text-caption text-muted-foreground">{a.role}</p>
              <p className="mt-1 text-h3 text-charcoal">{a.label}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
