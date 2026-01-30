import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, RefreshCw } from "lucide-react";

import { useProfitPerSkuReport, type ProfitSkuRow, type RevenueMode } from "@/hooks/useProfitPerSkuReport";

function formatCurrency(n: number) {
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN")}`;
}

function formatUnits(n: number, priceType: ProfitSkuRow["price_type"]) {
  const v = Number.isFinite(n) ? n : 0;
  return priceType === "per_metre" ? `${v} m` : `${v} pcs`;
}

function statusBadge(row: ProfitSkuRow) {
  const flags = [] as { key: string; label: string; variant?: "default" | "secondary" | "destructive" }[];
  if (row.flag_low_margin_high_volume) flags.push({ key: "hv", label: "High volume + low margin", variant: "destructive" });
  else if (row.flag_low_margin) flags.push({ key: "lm", label: "Low margin", variant: "destructive" });
  if (row.flag_negligible_profit) flags.push({ key: "np", label: "Negligible profit", variant: "secondary" });
  return flags;
}

export function ProfitPerSkuPanel() {
  const {
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
  } = useProfitPerSkuReport();

  const [query, setQuery] = useState("");
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [draftMinMargin, setDraftMinMargin] = useState(String(settings.min_margin_pct));
  const [draftMinProfitUnit, setDraftMinProfitUnit] = useState(String(settings.min_profit_per_unit));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.sku_code.toLowerCase().includes(q) || r.sku_name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Profit per SKU</h2>
          <p className="text-sm text-muted-foreground">Sorted by profit contribution. Expand a row to see the exact math and edit owner overrides.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-12 items-end">
          <div className="md:col-span-3">
            <div className="text-xs text-muted-foreground mb-1">From</div>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <div className="text-xs text-muted-foreground mb-1">To</div>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <div className="text-xs text-muted-foreground mb-1">Revenue basis</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={revenueMode === "pre_tax" ? "default" : "outline"}
                onClick={() => setRevenueMode("pre_tax" satisfies RevenueMode)}
              >
                Pre-tax
              </Button>
              <Button
                size="sm"
                variant={revenueMode === "invoice_total" ? "default" : "outline"}
                onClick={() => setRevenueMode("invoice_total" satisfies RevenueMode)}
              >
                Invoice total
              </Button>
            </div>
          </div>
          <div className="md:col-span-3">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <Input placeholder="Search SKU" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </Card>

      <Collapsible open={defaultsOpen} onOpenChange={setDefaultsOpen}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Default warning thresholds</div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {defaultsOpen ? "Hide" : "Edit"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", defaultsOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <Card className="p-4 mt-3">
            <div className="grid gap-3 md:grid-cols-12 items-end">
              <div className="md:col-span-3">
                <div className="text-xs text-muted-foreground mb-1">Min margin %</div>
                <Input
                  inputMode="decimal"
                  value={draftMinMargin}
                  onChange={(e) => setDraftMinMargin(e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <div className="text-xs text-muted-foreground mb-1">Min profit / unit</div>
                <Input
                  inputMode="decimal"
                  value={draftMinProfitUnit}
                  onChange={(e) => setDraftMinProfitUnit(e.target.value)}
                />
              </div>
              <div className="md:col-span-6 md:text-right">
                <Button
                  size="sm"
                  onClick={() => {
                    const m = Number(draftMinMargin);
                    const p = Number(draftMinProfitUnit);
                    if (!Number.isFinite(m) || !Number.isFinite(p)) return;
                    saveDefaults({ min_margin_pct: m, min_profit_per_unit: p });
                  }}
                >
                  Save defaults
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              These defaults drive the “Low margin” (margin &lt; threshold) and “Negligible profit” (profit/unit &lt; threshold) flags.
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading profit report…</div>
        ) : error ? (
          <div className="p-6">
            <div className="text-sm text-destructive">{error}</div>
            <div className="mt-1 text-sm text-muted-foreground">Try refreshing.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No SKUs match your filters (or no sales in this range).</div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <ProfitRow
                    key={r.sku_id}
                    row={r}
                    onSave={upsertSkuOverride}
                    onReset={clearSkuOverride}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </section>
  );
}

function ProfitRow(props: {
  row: ProfitSkuRow;
  onSave: (skuId: string, patch: { cost_override?: number | null; min_margin_pct_override?: number | null; min_profit_per_unit_override?: number | null; note?: string | null }) => Promise<void>;
  onReset: (skuId: string) => Promise<void>;
}) {
  const { row, onSave, onReset } = props;
  const [open, setOpen] = useState(false);

  const [costOverride, setCostOverride] = useState<string>(row.cost_source === "override" ? String(row.unit_cost_used) : "");
  const [minMargin, setMinMargin] = useState<string>(String(row.min_margin_pct_used));
  const [minProfitUnit, setMinProfitUnit] = useState<string>(String(row.min_profit_per_unit_used));
  const [note, setNote] = useState<string>(row.note ?? "");

  const flags = statusBadge(row);

  return (
    <>
      <TableRow className={cn(row.flag_low_margin_high_volume && "bg-muted/50")}>
        <TableCell>
          <div className="font-medium">{row.sku_code}</div>
          <div className="text-xs text-muted-foreground">{row.sku_name}</div>
        </TableCell>
        <TableCell className="text-right">{formatUnits(row.units_sold, row.price_type)}</TableCell>
        <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
        <TableCell className="text-right">
          <div className="font-medium">{formatCurrency(row.unit_cost_used)}</div>
          <div className="text-xs text-muted-foreground">{row.cost_source.replace("_", " ")}</div>
        </TableCell>
        <TableCell className="text-right">
          <div className="font-medium">{formatCurrency(row.profit_total)}</div>
          <div className="text-xs text-muted-foreground">{formatCurrency(row.profit_per_unit)}/{row.price_type === "per_metre" ? "m" : "pc"}</div>
        </TableCell>
        <TableCell className="text-right">
          <div className={cn("font-medium", row.flag_low_margin && "text-destructive")}>
            {Number.isFinite(row.margin_pct) ? row.margin_pct.toFixed(1) : "0.0"}%
          </div>
          <div className="text-xs text-muted-foreground">Avg disc: {Number.isFinite(row.avg_discount_percent) ? row.avg_discount_percent.toFixed(1) : "0.0"}%</div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {flags.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : null}
            {flags.map((f) => (
              <Badge key={f.key} variant={f.variant ?? "default"}>
                {f.label}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Edit"}
          </Button>
        </TableCell>
      </TableRow>

      {open ? (
        <TableRow>
          <TableCell colSpan={8} className="bg-card">
            <div className="grid gap-3 md:grid-cols-12">
              <Card className="p-4 md:col-span-7">
                <div className="text-sm font-medium">Transparent math</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Profit = Revenue − (Unit Cost × Units)
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">Revenue</div>
                    <div className="font-medium">{formatCurrency(row.revenue)}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">Units</div>
                    <div className="font-medium">{formatUnits(row.units_sold, row.price_type)}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">Unit cost used</div>
                    <div className="font-medium">{formatCurrency(row.unit_cost_used)} ({row.cost_source})</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">Computed profit</div>
                    <div className="font-medium">{formatCurrency(row.profit_total)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last purchase: {row.last_purchase_at ? new Date(row.last_purchase_at).toLocaleDateString("en-IN") : "—"} • Cost: {row.last_purchase_unit_cost == null ? "—" : formatCurrency(row.last_purchase_unit_cost)}
                  </div>
                </div>
              </Card>

              <Card className="p-4 md:col-span-5">
                <div className="text-sm font-medium">Owner overrides</div>
                <div className="mt-3 grid gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Unit cost override (leave blank to use last purchase)</div>
                    <Input
                      inputMode="decimal"
                      placeholder="e.g. 120"
                      value={costOverride}
                      onChange={(e) => setCostOverride(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Min margin %</div>
                      <Input inputMode="decimal" value={minMargin} onChange={(e) => setMinMargin(e.target.value)} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Min profit / unit</div>
                      <Input inputMode="decimal" value={minProfitUnit} onChange={(e) => setMinProfitUnit(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Note</div>
                    <Input placeholder="Owner note" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReset(row.sku_id)}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const c = costOverride.trim() === "" ? null : Number(costOverride);
                        const mm = Number(minMargin);
                        const mp = Number(minProfitUnit);
                        if ((c !== null && !Number.isFinite(c)) || !Number.isFinite(mm) || !Number.isFinite(mp)) return;
                        onSave(row.sku_id, {
                          cost_override: c,
                          min_margin_pct_override: mm,
                          min_profit_per_unit_override: mp,
                          note: note.trim() ? note.trim() : null,
                        });
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
