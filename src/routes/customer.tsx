import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGate } from "@/components/shared/RoleGate";

export const Route = createFileRoute("/customer")({
  ssr: false,
  component: () => (
    <RoleGate role="customer">
      <Outlet />
    </RoleGate>
  ),
});
