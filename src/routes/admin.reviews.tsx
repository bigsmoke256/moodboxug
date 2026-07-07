import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviews,
});

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  order_id: string;
  customer_id: string;
  profiles: { full_name: string | null } | null;
  orders: { id: string; total: number; created_at: string } | null;
}

function AdminReviews() {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async (): Promise<ReviewRow[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          "id, rating, comment, created_at, order_id, customer_id, profiles:customer_id(full_name), orders:order_id(id, total, created_at)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ReviewRow[];
    },
  });

  const avg =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div>
      <p className="text-eyebrow">Feedback</p>
      <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        Reviews
      </h1>

      {reviews.length > 0 && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary/15 px-4 py-2">
          <Star className="h-4 w-4 fill-secondary text-secondary" />
          <span className="text-body-sm font-semibold text-charcoal">{avg.toFixed(1)}</span>
          <span className="text-caption text-muted-foreground">
            avg across {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="mt-6">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-[16px] bg-card" />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No reviews yet"
            description="Customer feedback will appear here after delivered orders."
          />
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <article key={r.id} className="rounded-[16px] bg-card p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-body-sm font-semibold text-charcoal">
                      {r.profiles?.full_name ?? "Customer"}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      Order #{r.order_id.slice(0, 6)} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="mt-3 text-body-sm text-charcoal">{r.comment}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
