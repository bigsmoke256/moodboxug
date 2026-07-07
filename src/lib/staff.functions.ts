import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["admin", "kitchen", "driver", "customer"]);

export const createStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255).toLowerCase(),
        role: RoleEnum,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is admin.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("staff_invites" as never)
      .insert({
        email: data.email,
        role: data.role,
        created_by: context.userId,
      } as never)
      .select("id, token, email, role, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return invite as { id: string; token: string; email: string; role: string; expires_at: string };
  });

export const revokeStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("staff_invites" as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AcceptResult =
  | { ok: true; role: "admin" | "kitchen" | "driver" | "customer" }
  | { ok: false; error: "invalid" | "expired" | "already_accepted" | "email_mismatch" };

export const acceptStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().trim().min(4).max(200) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<AcceptResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("staff_invites" as never)
      .select("id, email, role, expires_at, accepted_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false, error: "invalid" };
    const inv = invite as {
      id: string;
      email: string;
      role: "admin" | "kitchen" | "driver" | "customer";
      expires_at: string;
      accepted_at: string | null;
    };
    if (inv.accepted_at) return { ok: false, error: "already_accepted" };
    if (new Date(inv.expires_at).getTime() < Date.now()) return { ok: false, error: "expired" };

    const email = String(context.claims.email ?? "").toLowerCase();
    if (!email || email !== inv.email.toLowerCase()) return { ok: false, error: "email_mismatch" };

    // Grant role (idempotent thanks to unique constraint) then mark accepted.
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: inv.role }, { onConflict: "user_id,role" });

    // If the invite is for a driver, seed a drivers row.
    if (inv.role === "driver") {
      await supabaseAdmin
        .from("drivers")
        .upsert({ id: context.userId, is_online: false }, { onConflict: "id" });
    }

    await supabaseAdmin
      .from("staff_invites" as never)
      .update({ accepted_at: new Date().toISOString(), accepted_by: context.userId } as never)
      .eq("id", inv.id);

    return { ok: true, role: inv.role };
  });
