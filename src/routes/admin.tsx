import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGate } from "@/components/shared/RoleGate";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: () => (
    <RoleGate role="admin">
      <Outlet />
    </RoleGate>
  ),
});
