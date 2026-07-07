import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bike, Copy, Mail, Send, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";
import { createStaffInvite, revokeStaffInvite } from "@/lib/staff.functions";

export const Route = createFileRoute("/admin/drivers")({
  component: AdminDrivers,
});

interface DriverRow {
  id: string;
  is_online: boolean;
  vehicle_info: string | null;
  updated_at: string;
  profile: { full_name: string | null; phone: string | null } | null;
}

interface PendingOrder {
  id: string;
  status: string;
  delivery_address: string | null;
  total: number;
  driver_id: string | null;
  profiles: { full_name: string | null } | null;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

function AdminDrivers() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: async (): Promise<DriverRow[]> => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, is_online, vehicle_info, updated_at, profile:id(full_name, phone)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DriverRow[];
    },
  });

  const { data: pending = [] } = useQuery({
    queryKey: ["admin-orders-assignable"],
    queryFn: async (): Promise<PendingOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, delivery_address, total, driver_id, profiles:customer_id(full_name)")
        .in("status", ["ready", "assigned", "picked_up", "out_for_delivery"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as PendingOrder[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["admin-staff-invites"],
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from("staff_invites" as never)
        .select("id, email, role, token, created_at, expires_at, accepted_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Invite[];
    },
  });

  const assign = async (orderId: string, driverId: string | null) => {
    const nextStatus = driverId ? "assigned" : "ready";
    const { error } = await supabase
      .from("orders")
      .update({ driver_id: driverId, status: nextStatus })
      .eq("id", orderId);
    if (error) return toast.error(error.message);
    await supabase.from("order_status_history").insert({ order_id: orderId, status: nextStatus });
    toast.success(driverId ? "Driver assigned" : "Unassigned");
    qc.invalidateQueries({ queryKey: ["admin-orders-assignable"] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow">Fleet</p>
          <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            Drivers
          </h1>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="motion-button-elevate flex items-center gap-2 rounded-[12px] bg-primary px-4 py-2.5 text-body-sm font-semibold text-primary-foreground"
        >
          <UserPlus className="h-4 w-4" /> Invite staff
        </button>
      </div>

      <section className="mt-8">
        <h2 className="text-h3 text-charcoal">Active drivers</h2>
        <div className="mt-4">
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-[16px] bg-card" />
          ) : drivers.length === 0 ? (
            <EmptyState icon={Bike} title="No drivers yet" description="Invite a driver to get started." />
          ) : (
            <div className="overflow-hidden rounded-[16px] bg-card shadow-soft">
              <table className="w-full text-body-sm">
                <thead className="border-b border-border text-caption text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Driver</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold text-charcoal">{d.profile?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{d.profile?.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{d.vehicle_info ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${
                            d.is_online
                              ? "bg-secondary/15 text-secondary"
                              : "bg-surface text-muted-foreground"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              d.is_online ? "bg-secondary animate-pulse" : "bg-muted-foreground"
                            }`}
                          />
                          {d.is_online ? "Online" : "Offline"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-h3 text-charcoal">Assign deliveries</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Ready orders can be handed to an online driver.
        </p>
        <div className="mt-4 space-y-2">
          {pending.length === 0 ? (
            <div className="rounded-[16px] bg-card p-6 text-center text-body-sm text-muted-foreground shadow-soft">
              Nothing waiting to dispatch.
            </div>
          ) : (
            pending.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-[12px] bg-card p-3 shadow-soft">
                <div className="min-w-0 flex-1">
                  <p className="text-caption text-muted-foreground">
                    #{o.id.slice(0, 6)} · {o.status.replaceAll("_", " ")}
                  </p>
                  <p className="text-body-sm font-semibold text-charcoal">
                    {o.profiles?.full_name ?? "Customer"}
                  </p>
                  <p className="line-clamp-1 text-caption text-muted-foreground">{o.delivery_address ?? "—"}</p>
                </div>
                <select
                  value={o.driver_id ?? ""}
                  onChange={(e) => assign(o.id, e.target.value || null)}
                  className="rounded-[12px] border border-input bg-background px-3 py-2 text-body-sm"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.profile?.full_name ?? d.id.slice(0, 6)} {d.is_online ? "· online" : "· offline"}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-h3 text-charcoal">Staff invites</h2>
        <div className="mt-4 space-y-2">
          {invites.length === 0 ? (
            <div className="rounded-[16px] bg-card p-6 text-center text-body-sm text-muted-foreground shadow-soft">
              No invites yet.
            </div>
          ) : (
            invites.map((inv) => <InviteRow key={inv.id} invite={inv} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-staff-invites"] })} />)
          )}
        </div>
      </section>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onCreated={() => {
            setInviteOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-staff-invites"] });
          }}
        />
      )}
    </div>
  );
}

function InviteRow({ invite, onChanged }: { invite: Invite; onChanged: () => void }) {
  const revoke = useServerFn(revokeStaffInvite);
  const [busy, setBusy] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/auth?invite=${invite.token}` : "";
  const expired = new Date(invite.expires_at).getTime() < Date.now();
  const accepted = !!invite.accepted_at;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };
  const remove = async () => {
    if (!confirm(`Revoke invite for ${invite.email}?`)) return;
    setBusy(true);
    try {
      await revoke({ data: { id: invite.id } });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] bg-card p-3 shadow-soft">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
        <Mail className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-charcoal">{invite.email}</p>
        <p className="text-caption text-muted-foreground">
          {invite.role} · {accepted ? "accepted" : expired ? "expired" : `expires ${new Date(invite.expires_at).toLocaleDateString()}`}
        </p>
      </div>
      {!accepted && !expired && (
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-[10px] border border-input px-2.5 py-1.5 text-caption text-charcoal hover:bg-surface"
        >
          <Copy className="h-3 w-3" /> Copy link
        </button>
      )}
      <button
        onClick={remove}
        disabled={busy}
        className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10 disabled:opacity-50"
        aria-label="Revoke"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createStaffInvite);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"driver" | "kitchen" | "admin">("driver");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const inv = await create({ data: { email: email.trim().toLowerCase(), role } });
      const url = `${window.location.origin}/auth?invite=${inv.token}`;
      setLink(url);
      toast.success("Invite created — share the link below");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-surface relative w-full max-w-md rounded-[20px] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="text-h2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            Invite staff
          </h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-charcoal hover:bg-surface"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {link ? (
          <div className="mt-6 space-y-3">
            <p className="text-body-sm text-muted-foreground">
              Send this one-time link to <span className="font-semibold text-charcoal">{email}</span>. They can sign up or sign in with the same email to accept.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 rounded-[12px] border border-input bg-surface px-3 py-2 text-caption text-charcoal"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  toast.success("Copied");
                }}
                className="rounded-[12px] bg-primary px-3 text-body-sm font-semibold text-primary-foreground"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => {
                onCreated();
                setLink(null);
              }}
              className="motion-button-elevate w-full rounded-[12px] bg-secondary py-2.5 text-body-sm font-semibold text-secondary-foreground"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-body-sm font-medium text-charcoal">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-body-sm font-medium text-charcoal">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="driver">Driver</option>
                <option value="kitchen">Kitchen</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="motion-button-elevate flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary py-2.5 text-body-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {busy ? "Creating…" : "Create invite"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
