import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeStatus = "connected" | "reconnecting" | "idle";

/**
 * Track a Supabase Realtime channel's state so the UI can surface a
 * "reconnecting…" indicator instead of silently going stale.
 */
export function useRealtimeStatus(channel: RealtimeChannel | null): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  useEffect(() => {
    if (!channel) return;
    // Poll channel state — Supabase JS doesn't expose a clean status event across versions.
    const tick = () => {
      const state = channel.state;
      if (state === "joined") setStatus("connected");
      else if (state === "closed" || state === "errored" || state === "leaving") setStatus("reconnecting");
      else setStatus("reconnecting");
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [channel]);
  return status;
}
