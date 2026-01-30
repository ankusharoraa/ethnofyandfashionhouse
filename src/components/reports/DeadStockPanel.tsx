import { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

import { useDeadStockAnalysis, type DeadStockRow } from "@/hooks/useDeadStockAnalysis";

function formatCurrency(value: number) {
  return `₹${(Number.isFinite(value) ? value : 0).toLocaleString("en-IN")}`;
}

function formatUnits(units: number, priceType: "per_metre" | "fixed") {
  const value = Number.isFinite(units) ? units : 0;
  return priceType === "per_metre" ? `${value} m` : `${value} pcs`;
}

function isDirty(a: DeadStockRow, b: Pick<DeadStockRow, "discount_percent" | "marked_clearance" | "note">) {
  const noteA = (a.note ?? "").trim();
  const noteB = (b.note ?? "").trim();
  return (
    (a.discount_percent ?? null) !== (b.discount_percent ?? null) ||
    Boolean(a.marked_clearance) !== Boolean(b.marked_clearance) ||
    noteA !== noteB
  );
}

export function DeadStockPanel() {
  const { rows, summary, isLoading, error, updateLocalRow, saveDeadStockAction, savingSkuIds } = useDeadStockAnalysis();

  const [deadSearch, setDeadSearch] = useState("");
  const [onlyDead, setOnlyDead] = useState(true);
  const [includeNewUnsold, setIncludeNewUnsold] = useState(false);
  const [showZeroStock, setShowZeroStock] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const initialRef = useRef(
    new Map<string, Pick<DeadStockRow, "discount_percent" | "marked_clearance" | "note">>()
  );

  useEffect(() => {
    // Capture initial per-row values so we can show a simple “unsaved changes” hint.
    const m = new Map<string, Pick<DeadStockRow, "discount_percent" | "marked_clearance" | "note">>();
    for (const r of rows) {
      m.set(r.sku_id, {
        discount_percent: r.discount_percent,
        marked_clearance: r.marked_clearance,
        note: r.note,
      });
    }
    initialRef.current = m;
  }, [rows.length]);

  const filteredRows = useMemo(() => {
    const q = deadSearch.trim().toLowerCase();
    return rows
      .filter((r) => (showZeroStock ? true : r.on_hand_units > 0))
      .filter((r) => {
        if (onlyDead) return r.movement_bucket === "dead";
        if (!includeNewUnsold) return r.movement_bucket !== "new_unsold";
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        return r.sku_code.toLowerCase().includes(q) || r.sku_name.toLowerCase().includes(q);
      });
  }, [rows, deadSearch, onlyDead, includeNewUnsold, showZeroStock]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Dead Stock Analysis</h2>
          <p className="text-sm text-muted-foreground">Owner-only list with clearance actions.</p>
        </div>
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search SKU code or name"
            value={deadSearch}
            onChange={(e) => setDeadSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Fast Moving (0–30 days)</div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <div className="text-lg font-semibold">{summary.fast.units.toLocaleString("en-IN")}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(summary.fast.value)}</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Slow Moving (31–90 days)</div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <div className="text-lg font-semibold">{summary.slow.units.toLocaleString("en-IN")}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(summary.slow.value)}</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Dead Stock (&gt; 90 days / never sold &gt; 30 days)</div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <div className="text-lg font-semibold">{summary.dead.units.toLocaleString("en-IN")}</div>
            <div className="text-sm font-semibold text-destructive">{formatCurrency(summary.dead.value)}</div>
          </div>
        </Card>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Filters</div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {filtersOpen ? "Hide" : "Show"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <Card className="p-4 mt-3">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={onlyDead} onCheckedChange={setOnlyDead} />
                Show only dead stock
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={includeNewUnsold} onCheckedChange={setIncludeNewUnsold} disabled={onlyDead} />
                Include new unsold (&lt; 30 days)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showZeroStock} onCheckedChange={setShowZeroStock} />
                Show zero stock
              </label>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading dead stock…</div>
        ) : error ? (
          <div className="p-6">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-1">Try refreshing the page.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No items match the current filters.</div>
        ) : (
          <div className="divide-y">
            {filteredRows.map((r) => {
              const isDead = r.movement_bucket === "dead";
              const isSaving = savingSkuIds.has(r.sku_id);
              const initial = initialRef.current.get(r.sku_id);
              const dirty = initial ? isDirty(r, initial) : false;

              return (
                <div key={r.sku_id} className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{r.sku_code}</div>
                        {dirty ? <span className="text-xs text-muted-foreground">Unsaved</span> : null}
                      </div>
                      <div className="text-sm text-muted-foreground">{r.sku_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Last sold: {r.last_sold_at ? new Date(r.last_sold_at).toLocaleDateString("en-IN") : "Never sold"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm">
                        On hand: <span className="font-medium">{formatUnits(r.on_hand_units, r.price_type)}</span>
                      </div>
                      <div className={cn("text-sm", isDead && "text-destructive font-semibold")}>
                        Blocked: {formatCurrency(r.blocked_value)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-12 items-center">
                    <div className="md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Discount %</div>
                      <Input
                        inputMode="decimal"
                        className="h-9"
                        placeholder="%"
                        value={r.discount_percent ?? ""}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next.trim() === "") {
                            updateLocalRow(r.sku_id, { discount_percent: null });
                            return;
                          }
                          const n = Number(next);
                          if (!Number.isFinite(n)) return;
                          updateLocalRow(r.sku_id, { discount_percent: n });
                        }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Clearance</div>
                      <label className="flex items-center gap-2 text-sm h-9">
                        <Checkbox
                          checked={r.marked_clearance}
                          onCheckedChange={(v) => updateLocalRow(r.sku_id, { marked_clearance: Boolean(v) })}
                        />
                        Mark
                      </label>
                    </div>

                    <div className="md:col-span-6">
                      <div className="text-xs text-muted-foreground mb-1">Note</div>
                      <Input
                        className="h-9"
                        placeholder="Owner note"
                        value={r.note ?? ""}
                        onChange={(e) => updateLocalRow(r.sku_id, { note: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2 md:text-right">
                      <div className="text-xs text-muted-foreground mb-1">&nbsp;</div>
                      <Button
                        size="sm"
                        variant={isDead ? "default" : "secondary"}
                        disabled={isSaving}
                        onClick={() => saveDeadStockAction(r.sku_id)}
                        className="w-full md:w-auto"
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
