import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Sub = {
  table: string;
  brandId?: string;
  queryKey: unknown[];
};

/**
 * Subscribe to postgres_changes for one or more tables scoped to a brand
 * and invalidate the matching React Query keys on any change.
 */
export function useRealtimeInvalidate(subs: Sub[], channelName: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!subs.length) return;
    const channel = supabase.channel(channelName);
    for (const s of subs) {
      channel.on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: s.table,
          ...(s.brandId ? { filter: `brand_id=eq.${s.brandId}` } : {}),
        },
        () => {
          qc.invalidateQueries({ queryKey: s.queryKey });
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(subs.map((s) => [s.table, s.brandId, s.queryKey]))]);
}
