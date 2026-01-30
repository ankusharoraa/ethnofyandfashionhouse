import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

import { usePurchaseRecommendations, type PurchaseRecommendationRow, type ReorderStatus } from "@/hooks/usePurchaseRecommendations";

function formatUnits(n: number, priceType: PurchaseRecommendationRow["price_type"]) {
  const v = Number.isFinite(n) ? n : 0;
  return priceType === "per_metre" ? `${v} m` : `${v} pcs`;
}

function labelStatus(s: ReorderStatus) {
  if (s === "reorder_now") return "Reorder Now";
  if (s === "do_not_buy") return "Do Not Buy";
  return "Monitor";
}

function badgeVariant(s: ReorderStatus): "default" | "secondary" | "destructive" {
  if (s === "reorder_now") return "destructive";
  if (s === "do_not_buy") return "secondary";
  return "default";
}

export function PurchaseRecommendationsPanel() {
  const { asOf, setAsOf, rows, isLoading, error, refresh, upsertOverride, clearOverride } = usePurchaseRecommendations();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.sku_code.toLowerCase().includes(q) || r.sku_name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Purchase Recommendations</h2>
          <p className="text-sm text-muted-foreground">Rule-based 30-day cover using last 3 months (blended with last-year same period when available).</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-12 items-end">
          <div className="md:col-span-3">
            <div className="text-xs text-muted-foreground mb-1">As of</div>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <div className="md:col-span-5">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <Input placeholder="Search SKU" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <div className="text-xs text-muted-foreground mb-1">Rule</div>
            <div className="text-sm">Recommended = max(0, need 30 days − stock)</div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading recommendations…</div>
        ) : error ? (
          <div className="p-6">
            <div className="text-sm text-destructive">{error}</div>
            <div className="mt-1 text-sm text-muted-foreground">Try refreshing.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No SKUs match your search.</div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Need 30d</TableHead>
                  <TableHead className="text-right">Suggested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Final qty</TableHead>
                  <TableHead>Final status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <ReorderRow key={r.sku_id} row={r} onSave={upsertOverride} onReset={clearOverride} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </section>
  );
}

function ReorderRow(props: {
  row: PurchaseRecommendationRow;
  onSave: (skuId: string, patch: { override_recommended_qty?: number | null; override_status?: ReorderStatus | null; note?: string | null }) => Promise<void>;
  onReset: (skuId: string) => Promise<void>;
}) {
  const { row, onSave, onReset } = props;
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<string>(row.override_recommended_qty == null ? "" : String(row.override_recommended_qty));
  const [status, setStatus] = useState<ReorderStatus | "">(row.override_status ?? "");
  const [note, setNote] = useState<string>(row.override_note ?? "");

  const isOverride = row.override_recommended_qty != null || row.override_status != null;

  return (
    <>
      <TableRow className={cn(row.final_status === "reorder_now" && "bg-muted/50")}>
        <TableCell>
          <div className="flex items-center gap-2">
            <div>
              <div className="font-medium">{row.sku_code}</div>
              <div className="text-xs text-muted-foreground">{row.sku_name}</div>
            </div>
            {isOverride ? <Badge variant="secondary">Override</Badge> : null}
          </div>
        </TableCell>
        <TableCell className="text-right">{formatUnits(row.stock_on_hand, row.price_type)}</TableCell>
        <TableCell className="text-right">{formatUnits(row.need_horizon, row.price_type)}</TableCell>
        <TableCell className="text-right">{formatUnits(row.recommended_system, row.price_type)}</TableCell>
        <TableCell>
          <Badge variant={badgeVariant(row.status_system)}>{labelStatus(row.status_system)}</Badge>
        </TableCell>
        <TableCell className="text-right">{formatUnits(row.final_recommended_qty, row.price_type)}</TableCell>
        <TableCell>
          <Badge variant={badgeVariant(row.final_status)}>{labelStatus(row.final_status)}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Why / Override"}
          </Button>
        </TableCell>
      </TableRow>

      {open ? (
        <TableRow>
          <TableCell colSpan={8} className="bg-card">
            <div className="grid gap-3 md:grid-cols-12">
              <Card className="p-4 md:col-span-7">
                <div className="text-sm font-medium">Why</div>
                <div className="mt-2 text-sm text-muted-foreground">{row.reason_system}</div>
                <div className="mt-3 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">Avg daily (3 months)</div>
                      <div className="font-medium">{row.avg_daily_3mo.toFixed(3)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">Avg daily (last year)</div>
                      <div className="font-medium">{row.avg_daily_last_year.toFixed(3)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">Used</div>
                      <div className="font-medium">{row.avg_daily_used.toFixed(3)} ({row.demand_source})</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">Need next 30 days</div>
                      <div className="font-medium">{formatUnits(row.need_horizon, row.price_type)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">Stock on hand</div>
                      <div className="font-medium">{formatUnits(row.stock_on_hand, row.price_type)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">Suggested reorder</div>
                      <div className="font-medium">{formatUnits(row.recommended_system, row.price_type)}</div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4 md:col-span-5">
                <div className="text-sm font-medium">Owner override</div>
                <div className="mt-3 grid gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Final quantity (leave blank for system)</div>
                    <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 10" />
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Final status (leave blank for system)</div>
                    <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Use system status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reorder_now">Reorder Now</SelectItem>
                        <SelectItem value="monitor">Monitor</SelectItem>
                        <SelectItem value="do_not_buy">Do Not Buy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Note</div>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Owner note" />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onReset(row.sku_id)}>
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const q = qty.trim() === "" ? null : Number(qty);
                        if (q !== null && !Number.isFinite(q)) return;
                        const st = status === "" ? null : (status as ReorderStatus);
                        onSave(row.sku_id, {
                          override_recommended_qty: q,
                          override_status: st,
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
