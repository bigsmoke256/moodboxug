import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Star, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

interface Row {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_vip: boolean;
  created_at: string;
}

function AdminCustomers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, is_vip, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data.filter((r) =>
    !q.trim()
      ? true
      : (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (r.phone ?? "").includes(q),
  );

  const toggleVip = async (r: Row) => {
    const { error } = await supabase.from("profiles").update({ is_vip: !r.is_vip }).eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };

  return (
    <div>
      <p className="text-eyebrow">Community</p>
      <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        Customers
      </h1>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or phone…"
        className="mt-6 w-full max-w-sm rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="mt-6">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-[16px] bg-card" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No customers" description="They'll appear here after signing up." />
        ) : (
          <div className="overflow-hidden rounded-[16px] bg-card shadow-soft">
            <table className="w-full text-body-sm">
              <thead className="border-b border-border text-caption text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">VIP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold text-charcoal">{r.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleVip(r)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold ${
                          r.is_vip
                            ? "bg-primary/15 text-primary"
                            : "bg-surface text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        }`}
                      >
                        <Star className="h-3 w-3" /> {r.is_vip ? "VIP" : "Set VIP"}
                      </button>
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
