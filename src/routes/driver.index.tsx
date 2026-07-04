import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/driver/")({
  component: () => (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-eyebrow">Driver app</p>
        <h1 className="mt-2 text-display-2 text-charcoal">Driver app</h1>
        <p className="mt-3 text-body text-muted-foreground">
          Placeholder — Phase 2+ will show assigned deliveries and status updates.
        </p>
      </div>
    </div>
  ),
});
