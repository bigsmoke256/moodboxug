import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/shared/RoleGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toaster } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: () => (
    <RoleGate role="admin">
      <AdminShell />
      <Toaster position="top-center" richColors closeButton />
    </RoleGate>
  ),
});
