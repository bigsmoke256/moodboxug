import { Wifi, WifiOff } from "lucide-react";
import type { RealtimeStatus } from "@/hooks/use-realtime-status";

export function RealtimePill({ status }: { status: RealtimeStatus }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 px-2.5 py-1 text-caption text-secondary">
        <Wifi className="h-3 w-3" />
        Live
      </span>
    );
  }
  if (status === "reconnecting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-caption text-amber-700">
        <WifiOff className="h-3 w-3 animate-pulse" />
        Reconnecting…
      </span>
    );
  }
  return null;
}
