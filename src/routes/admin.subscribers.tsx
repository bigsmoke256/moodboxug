import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/admin/subscribers")({
  component: AdminSubscribers,
});

interface Sub {
  id: string;
  email: string;
  subscribed_at: string;
}

function AdminSubscribers() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: async (): Promise<Sub[]> => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("id, email, subscribed_at")
        .order("subscribed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const exportCsv = () => {
    const rows = [["email", "subscribed_at"], ...data.map((s) => [s.email, s.subscribed_at])];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moodbox-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow">Growth</p>
          <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            Subscribers
          </h1>
          <p className="mt-1 text-body-sm text-muted-foreground">{data.length} total</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={data.length === 0}
          className="motion-button-elevate flex items-center gap-2 rounded-[12px] bg-secondary px-4 py-2 text-body-sm font-semibold text-secondary-foreground disabled:opacity-60"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-[16px] bg-card" />
        ) : data.length === 0 ? (
          <EmptyState icon={Mail} title="No subscribers yet" description="Emails collected from the homepage newsletter form will appear here." />
        ) : (
          <div className="overflow-hidden rounded-[16px] bg-card shadow-soft">
            <table className="w-full text-body-sm">
              <thead className="border-b border-border text-caption text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 text-charcoal">{s.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(s.subscribed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
