import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type DeadStockBucket = "fast" | "slow" | "dead" | "new_unsold";

export type DeadStockRow = {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  price_type: "per_metre" | "fixed";
  on_hand_units: number;
  avg_unit_cost: number;
  blocked_value: number;
  last_sold_at: string | null;
  sku_created_at: string;
  movement_bucket: DeadStockBucket;
  discount_percent: number | null;
  marked_clearance: boolean;
  note: string | null;
};

type Summary = {
  fast: { units: number; value: number };
  slow: { units: number; value: number };
  dead: { units: number; value: number };
};

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function useDeadStockAnalysis() {
  const { user, isOwner } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<DeadStockRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingSkuIds, setSavingSkuIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user || !isOwner) {
      setRows([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("dead_stock_analysis", {
        p_as_of: new Date().toISOString(),
        p_fast_days: 30,
        p_slow_days: 90,
        p_never_sold_dead_days: 30,
      });

      if (rpcError) throw rpcError;

      const normalized: DeadStockRow[] = (data ?? []).map((r: any) => ({
        sku_id: String(r.sku_id),
        sku_code: String(r.sku_code ?? ""),
        sku_name: String(r.sku_name ?? ""),
        price_type: r.price_type,
        on_hand_units: toNumber(r.on_hand_units),
        avg_unit_cost: toNumber(r.avg_unit_cost),
        blocked_value: toNumber(r.blocked_value),
        last_sold_at: r.last_sold_at ?? null,
        sku_created_at: String(r.sku_created_at),
        movement_bucket: r.movement_bucket,
        discount_percent: r.discount_percent === null || r.discount_percent === undefined ? null : toNumber(r.discount_percent),
        marked_clearance: Boolean(r.marked_clearance),
        note: r.note ?? null,
      }));

      setRows(normalized);
    } catch (e: any) {
      console.error("dead_stock_analysis error", e);
      setError(e?.message ?? "Failed to load dead stock analysis");
    } finally {
      setIsLoading(false);
    }
  }, [user, isOwner]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const summary: Summary = useMemo(() => {
    const init = {
      fast: { units: 0, value: 0 },
      slow: { units: 0, value: 0 },
      dead: { units: 0, value: 0 },
    };

    for (const r of rows) {
      if (r.on_hand_units <= 0) continue;
      if (r.movement_bucket !== "fast" && r.movement_bucket !== "slow" && r.movement_bucket !== "dead") continue;
      init[r.movement_bucket].units += r.on_hand_units;
      init[r.movement_bucket].value += r.blocked_value;
    }
    return init;
  }, [rows]);

  const updateLocalRow = useCallback((skuId: string, patch: Partial<DeadStockRow>) => {
    setRows((prev) => prev.map((r) => (r.sku_id === skuId ? { ...r, ...patch } : r)));
  }, []);

  const saveDeadStockAction = useCallback(
    async (skuId: string) => {
      if (!user || !isOwner) return false;

      const row = rows.find((r) => r.sku_id === skuId);
      if (!row) return false;

      setSavingSkuIds((prev) => new Set(prev).add(skuId));
      try {
        const { error: upsertError } = await supabase.from("dead_stock_actions").upsert(
          {
            sku_id: skuId,
            discount_percent: row.discount_percent,
            marked_clearance: row.marked_clearance,
            note: row.note,
            updated_by: user.id,
          },
          { onConflict: "sku_id" },
        );

        if (upsertError) throw upsertError;

        toast({ title: "Saved", description: "Dead stock action saved." });
        return true;
      } catch (e: any) {
        console.error("dead_stock_actions upsert error", e);
        toast({
          title: "Save failed",
          description: e?.message ?? "Could not save action",
          variant: "destructive",
        });
        return false;
      } finally {
        setSavingSkuIds((prev) => {
          const next = new Set(prev);
          next.delete(skuId);
          return next;
        });
      }
    },
    [user, isOwner, rows, toast],
  );

  return {
    rows,
    isLoading,
    error,
    summary,
    refresh,
    updateLocalRow,
    saveDeadStockAction,
    savingSkuIds,
  };
}
