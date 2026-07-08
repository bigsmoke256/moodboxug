import { createServerFn } from "@tanstack/react-start";

// Hardcoded owner bootstrap. Idempotent: safe to call repeatedly.
// Only ever provisions this single fixed email as admin.
const ADMIN_EMAIL = "musinguzij619@gmail.com";
const ADMIN_PASSWORD = "MoodBox2026!";
const ADMIN_NAME = "Mood Box Admin";

export const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Find or create the auth user.
  let userId: string | null = null;
  try {
    // listUsers doesn't support filter server-side; page and search.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
    if (existing) userId = existing.id;
  } catch {
    // fall through to create
  }

  if (!userId) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    });
    if (error || !created.user) {
      // Race: created between list & create — look it up again.
      const { data: list2 } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const again = list2?.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
      if (!again) throw new Error(error?.message ?? "Failed to create admin user");
      userId = again.id;
    } else {
      userId = created.user.id;
    }
  }

  // Always ensure the documented password + confirmed email are in effect.
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
  } catch {
    /* ignore */
  }

  // 2. Ensure profile row exists.
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, full_name: ADMIN_NAME }, { onConflict: "id" });

  // 3. Grant admin role (idempotent).
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  return { ok: true as const, userId };
});
