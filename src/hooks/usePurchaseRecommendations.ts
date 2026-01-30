import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type ReorderStatus = "reorder_now" | "monitor" | "do_not_buy";

export type PurchaseRecommendationRow = {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  price_type: "per_metre" | "fixed";

  stock_on_hand: number;
  avg_daily_3mo: number;
  avg_daily_last_year: number;
  avg_daily_used: number;
  demand_source: string;
  need_horizon: number;

  recommended_system: number;
  status_system: ReorderStatus;
  reason_system: string;

  override_recommended_qty: number | null;
  override_status: ReorderStatus | null;
  override_note: string | null;

  final_recommended_qty: number;
  final_status: ReorderStatus;
  final_reason: string;
};

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function usePurchaseRecommendations() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [asOf, setAsOf] = useState(todayStr());
  const [rows, setRows] = useState<PurchaseRecommendationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asOfIso = useMemo(() => new Date(`${asOf}T00:00:00`).toISOString(), [asOf]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("purchase_recommendations_report", {
        p_as_of: asOfIso,
        p_lookback_days: 90,
        p_horizon_days: 30,
      });
      if (error) throw error;
      setRows((data ?? []) as unknown as PurchaseRecommendationRow[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to load purchase recommendations");
    } finally {
      setIsLoading(false);
    }
  }, [user, asOfIso]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upsertOverride = useCallback(
    async (skuId: string, patch: { override_recommended_qty?: number | null; override_status?: ReorderStatus | null; note?: string | null }) => {
      if (!user) return;
      const { error } = await supabase
        .from("sku_reorder_overrides")
        .upsert(
          {
            sku_id: skuId,
            ...patch,
            updated_by: user.id,
          },
          { onConflict: "sku_id" }
        );
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Saved", description: "Recommendation override saved" });
      await refresh();
    },
    [user, toast, refresh]
  );

  const clearOverride = useCallback(
    async (skuId: string) => {
      if (!user) return;
      const { error } = await supabase.from("sku_reorder_overrides").delete().eq("sku_id", skuId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Reset", description: "Override cleared" });
      await refresh();
    },
    [user, toast, refresh]
  );

  return { asOf, setAsOf, rows, isLoading, error, refresh, upsertOverride, clearOverride };
}
