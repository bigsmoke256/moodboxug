import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGate } from "@/components/shared/RoleGate";

export const Route = createFileRoute("/driver")({
  ssr: false,
  component: () => (
    <RoleGate role="driver">
      <Outlet />
    </RoleGate>
  ),
});
