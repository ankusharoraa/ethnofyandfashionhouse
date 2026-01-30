import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type RevenueMode = "pre_tax" | "invoice_total";

export type ProfitSkuRow = {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  price_type: "per_metre" | "fixed";

  units_sold: number;
  revenue: number;
  unit_sell_avg: number;

  unit_cost_used: number;
  cost_source: "override" | "last_purchase" | "sku_master" | string;
  last_purchase_unit_cost: number | null;
  last_purchase_at: string | null;

  profit_total: number;
  profit_per_unit: number;
  margin_pct: number;

  avg_discount_percent: number;

  flag_low_margin: boolean;
  flag_negligible_profit: boolean;
  flag_low_margin_high_volume: boolean;

  min_margin_pct_used: number;
  min_profit_per_unit_used: number;
  note: string | null;
};

export type ProfitSettings = {
  min_margin_pct: number;
  min_profit_per_unit: number;
};

function toIsoStartOfDay(dateStr: string) {
  // dateStr: yyyy-mm-dd
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toISOString();
}

function toIsoNextDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function useProfitPerSkuReport() {
  const { user } = useAuth();
  const { toast } = useToast();

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [revenueMode, setRevenueMode] = useState<RevenueMode>("pre_tax");

  const [rows, setRows] = useState<ProfitSkuRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<ProfitSettings>({
    min_margin_pct: 10,
    min_profit_per_unit: 10,
  });

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("profit_per_sku_report", {
        p_from: toIsoStartOfDay(fromDate),
        p_to: toIsoNextDay(toDate),
        p_revenue_mode: revenueMode,
        p_cost_basis: "last_purchase",
      });

      if (error) throw error;
      setRows((data ?? []) as unknown as ProfitSkuRow[]);

      // Pull latest defaults (if none exist, keep local defaults).
      const { data: sData, error: sErr } = await supabase
        .from("profit_settings")
        .select("min_margin_pct,min_profit_per_unit")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sErr && sData) {
        setSettings({
          min_margin_pct: Number(sData.min_margin_pct ?? 10),
          min_profit_per_unit: Number(sData.min_profit_per_unit ?? 10),
        });
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to load profit report");
    } finally {
      setIsLoading(false);
    }
  }, [user, fromDate, toDate, revenueMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveDefaults = useCallback(
    async (next: ProfitSettings) => {
      if (!user) return;
      const { error } = await supabase.from("profit_settings").insert({
        min_margin_pct: next.min_margin_pct,
        min_profit_per_unit: next.min_profit_per_unit,
        updated_by: user.id,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      setSettings(next);
      toast({ title: "Saved", description: "Profit thresholds updated" });
      await refresh();
    },
    [user, toast, refresh]
  );

  const upsertSkuOverride = useCallback(
    async (skuId: string, patch: { cost_override?: number | null; min_margin_pct_override?: number | null; min_profit_per_unit_override?: number | null; note?: string | null }) => {
      if (!user) return;
      const { error } = await supabase
        .from("sku_profit_overrides")
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
      toast({ title: "Saved", description: "Override saved" });
      await refresh();
    },
    [user, toast, refresh]
  );

  const clearSkuOverride = useCallback(
    async (skuId: string) => {
      if (!user) return;
      const { error } = await supabase.from("sku_profit_overrides").delete().eq("sku_id", skuId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Reset", description: "Override cleared" });
      await refresh();
    },
    [user, toast, refresh]
  );

  return {
    rows,
    isLoading,
    error,

    fromDate,
    toDate,
    revenueMode,
    setFromDate,
    setToDate,
    setRevenueMode,

    settings,
    saveDefaults,

    refresh,
    upsertSkuOverride,
    clearSkuOverride,
  };
}
