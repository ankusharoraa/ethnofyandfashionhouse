import { useEffect, useMemo, useState } from "react";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

type DayPoint = {
  day: string; // yyyy-MM-dd
  label: string;
  stockInUnits: number;
  salesRevenue: number;
  salesCost: number;
  salesProfit: number;
  creditCreated: number;
  paymentsReceived: number;
};

type HourPoint = {
  hour: string; // 00..23
  salesRevenue: number;
  billsCount: number;
};

type PaymentSplitPoint = {
  method: string;
  salesRevenue: number;
};

type TopProductPoint = {
  name: string;
  revenue: number;
  units: number;
};

type CategoryProfitPoint = {
  category: string;
  revenue: number;
  cost: number;
  profit: number;
};

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hslVar(name: string) {
  return `hsl(var(${name}))`;
}

export function ReportCharts() {
  const db = supabase as any;
  const [fromDate, setFromDate] = useState<Date>(() => startOfDay(subDays(new Date(), 6)));
  const [toDate, setToDate] = useState<Date>(() => endOfDay(new Date()));
  const [loading, setLoading] = useState(false);

  const [daySeries, setDaySeries] = useState<DayPoint[]>([]);
  const [hourSeries, setHourSeries] = useState<HourPoint[]>([]);
  const [paymentSplit, setPaymentSplit] = useState<PaymentSplitPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductPoint[]>([]);
  const [categoryProfit, setCategoryProfit] = useState<CategoryProfitPoint[]>([]);

  const dateRangeLabel = useMemo(() => {
    const a = format(fromDate, "dd MMM");
    const b = format(toDate, "dd MMM");
    return `${a} → ${b}`;
  }, [fromDate, toDate]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const fromIso = startOfDay(fromDate).toISOString();
        const toIso = endOfDay(toDate).toISOString();

        // Purchases (stock-in) from purchase invoices
        const purchaseReq = db
          .from("invoice_items")
          .select(
            `
            id,
            price_type,
            quantity,
            length_metres,
            invoices!inner(created_at, invoice_type, status)
          `
          )
          .gte("invoices.created_at", fromIso)
          .lte("invoices.created_at", toIso)
          .eq("invoices.invoice_type", "purchase")
          .eq("invoices.status", "completed")
          .limit(1000);

        // Sales items for revenue+cost+profit + top products + category profit
        const salesItemsReq = db
          .from("invoice_items")
          .select(
            `
            id,
            sku_id,
            sku_name,
            price_type,
            quantity,
            length_metres,
            line_total,
            cost_price,
            invoices!inner(created_at, invoice_type, status, payment_method, pending_amount, total_amount),
            skus(purchase_fixed_price, purchase_rate, category_id, categories(name))
          `
          )
          .gte("invoices.created_at", fromIso)
          .lte("invoices.created_at", toIso)
          .eq("invoices.invoice_type", "sale")
          .eq("invoices.status", "completed")
          .limit(1000);

        // Sales invoices (for peak hours, payment split)
        const salesInvoicesReq = db
          .from("invoices")
          .select("id, created_at, total_amount, payment_method, pending_amount")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .eq("invoice_type", "sale")
          .eq("status", "completed")
          .limit(1000);

        // Payments received (for credit activity)
        const paymentsReq = db
          .from("customer_payments")
          .select("id, amount, payment_date")
          .gte("payment_date", fromIso)
          .lte("payment_date", toIso)
          .limit(1000);

        const [{ data: purchases, error: pErr }, { data: saleItems, error: siErr }, { data: salesInv, error: sErr }, { data: payments, error: payErr }] =
          await Promise.all([purchaseReq, salesItemsReq, salesInvoicesReq, paymentsReq]);

        if (pErr) console.error("Purchases load failed:", pErr);
        if (siErr) console.error("Sales items load failed:", siErr);
        if (sErr) console.error("Sales invoices load failed:", sErr);
        if (payErr) console.error("Payments load failed:", payErr);

        const dayMap = new Map<string, DayPoint>();
        const ensureDay = (d: Date) => {
          const key = format(d, "yyyy-MM-dd");
          if (!dayMap.has(key)) {
            dayMap.set(key, {
              day: key,
              label: format(d, "dd MMM"),
              stockInUnits: 0,
              salesRevenue: 0,
              salesCost: 0,
              salesProfit: 0,
              creditCreated: 0,
              paymentsReceived: 0,
            });
          }
          return dayMap.get(key)!;
        };

        // Seed all days so charts don’t look broken on zero days
        for (let i = 0; i < 90; i++) {
          const d = subDays(endOfDay(toDate), i);
          if (d < startOfDay(fromDate)) break;
          ensureDay(d);
        }

        // Stock-in (units: pcs or metres)
        (purchases ?? []).forEach((r: any) => {
          const created = new Date(r.invoices.created_at);
          const day = ensureDay(created);
          const units = r.price_type === "per_metre" ? toNum(r.length_metres) : toNum(r.quantity);
          day.stockInUnits += units;
        });

        // Sales items: revenue + cost + profit, top products, category profit
        const productAgg = new Map<string, TopProductPoint>();
        const categoryAgg = new Map<string, CategoryProfitPoint>();

        (saleItems ?? []).forEach((r: any) => {
          const created = new Date(r.invoices.created_at);
          const day = ensureDay(created);

          const revenue = toNum(r.line_total);

          const unitCost =
            (r.cost_price != null ? toNum(r.cost_price) : null) ??
            (r.price_type === "per_metre" ? toNum(r.skus?.purchase_rate) : toNum(r.skus?.purchase_fixed_price));

          const units = r.price_type === "per_metre" ? toNum(r.length_metres) : toNum(r.quantity);
          const cost = unitCost * units;
          const profit = revenue - cost;

          day.salesRevenue += revenue;
          day.salesCost += cost;
          day.salesProfit += profit;

          const productKey = r.sku_id ?? r.sku_name;
          const prevP = productAgg.get(productKey) ?? { name: r.sku_name ?? "(Unknown)", revenue: 0, units: 0 };
          prevP.revenue += revenue;
          prevP.units += units;
          productAgg.set(productKey, prevP);

          const catName = r.skus?.categories?.name ?? "Uncategorised";
          const prevC = categoryAgg.get(catName) ?? { category: catName, revenue: 0, cost: 0, profit: 0 };
          prevC.revenue += revenue;
          prevC.cost += cost;
          prevC.profit += profit;
          categoryAgg.set(catName, prevC);
        });

        // Credit created per day (pending_amount on completed sales invoices)
        (salesInv ?? []).forEach((inv: any) => {
          const created = new Date(inv.created_at);
          const day = ensureDay(created);
          day.creditCreated += toNum(inv.pending_amount);
        });

        // Payments received per day
        (payments ?? []).forEach((p: any) => {
          const d = new Date(p.payment_date);
          const day = ensureDay(d);
          day.paymentsReceived += toNum(p.amount);
        });

        // Peak hours (revenue/hour and bills/hour)
        const hourAgg = new Map<string, HourPoint>();
        for (let h = 0; h < 24; h++) {
          const key = String(h).padStart(2, "0");
          hourAgg.set(key, { hour: key, salesRevenue: 0, billsCount: 0 });
        }
        (salesInv ?? []).forEach((inv: any) => {
          const d = new Date(inv.created_at);
          const hour = String(d.getHours()).padStart(2, "0");
          const row = hourAgg.get(hour)!;
          row.salesRevenue += toNum(inv.total_amount);
          row.billsCount += 1;
        });

        // Payment split
        const payAgg = new Map<string, number>();
        (salesInv ?? []).forEach((inv: any) => {
          const key = String(inv.payment_method ?? "unknown");
          payAgg.set(key, (payAgg.get(key) ?? 0) + toNum(inv.total_amount));
        });

        const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));
        setDaySeries(sortedDays);
        setHourSeries(Array.from(hourAgg.values()).sort((a, b) => a.hour.localeCompare(b.hour)));
        setPaymentSplit(
          Array.from(payAgg.entries())
            .map(([method, salesRevenue]) => ({ method, salesRevenue }))
            .sort((a, b) => b.salesRevenue - a.salesRevenue)
        );
        setTopProducts(Array.from(productAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10));
        setCategoryProfit(Array.from(categoryAgg.values()).sort((a, b) => b.profit - a.profit));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [fromDate, toDate]);

  const totals = useMemo(() => {
    const revenue = daySeries.reduce((s, d) => s + d.salesRevenue, 0);
    const cost = daySeries.reduce((s, d) => s + d.salesCost, 0);
    const profit = revenue - cost;
    return { revenue, cost, profit };
  }, [daySeries]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Graph Reports</h2>
          <p className="text-sm text-muted-foreground">{loading ? "Loading…" : dateRangeLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[170px] justify-start text-left font-normal")}> 
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(fromDate, "dd MMM")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(d) => d && setFromDate(startOfDay(d))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[170px] justify-start text-left font-normal")}> 
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(toDate, "dd MMM")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(d) => d && setToDate(endOfDay(d))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3">
            <div className="font-semibold">Stock In (Purchases)</div>
            <div className="text-xs text-muted-foreground">Total stock-in units per day (pcs or metres)</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daySeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={hslVar("--border")} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <YAxis tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: hslVar("--popover"), borderColor: hslVar("--border"), color: hslVar("--foreground") }}
                />
                <Line type="monotone" dataKey="stockInUnits" name="Stock in" stroke={hslVar("--primary")} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3">
            <div className="font-semibold">Daily Sales vs Profit</div>
            <div className="text-xs text-muted-foreground">Revenue and profit per day</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daySeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={hslVar("--border")} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <YAxis tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <Tooltip
                  formatter={(v: any) => [`₹${toNum(v).toLocaleString("en-IN")}`, ""]}
                  contentStyle={{ background: hslVar("--popover"), borderColor: hslVar("--border"), color: hslVar("--foreground") }}
                />
                <Legend />
                <Bar dataKey="salesRevenue" name="Sales" fill={hslVar("--primary")} radius={[6, 6, 0, 0]} />
                <Bar dataKey="salesProfit" name="Profit" fill={hslVar("--accent")} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Total Sales</div>
              <div className="font-semibold">₹{totals.revenue.toLocaleString("en-IN")}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Total Profit</div>
              <div className="font-semibold">₹{totals.profit.toLocaleString("en-IN")}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Profit %</div>
              <div className="font-semibold">{totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(2) : "0.00"}%</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3">
            <div className="font-semibold">Peak Hours</div>
            <div className="text-xs text-muted-foreground">Sales amount/hour and bills count/hour</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourSeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={hslVar("--border")} strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: hslVar("--popover"), borderColor: hslVar("--border"), color: hslVar("--foreground") }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="salesRevenue" name="Sales ₹/hour" fill={hslVar("--primary")} radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="billsCount" name="Bills/hour" fill={hslVar("--secondary")} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3">
            <div className="font-semibold">Payment Method Split</div>
            <div className="text-xs text-muted-foreground">Sales revenue by payment method</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentSplit} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={hslVar("--border")} strokeDasharray="3 3" />
                <XAxis dataKey="method" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <YAxis tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <Tooltip
                  formatter={(v: any) => [`₹${toNum(v).toLocaleString("en-IN")}`, ""]}
                  contentStyle={{ background: hslVar("--popover"), borderColor: hslVar("--border"), color: hslVar("--foreground") }}
                />
                <Bar dataKey="salesRevenue" name="Sales" fill={hslVar("--primary")} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3">
            <div className="font-semibold">Top Products</div>
            <div className="text-xs text-muted-foreground">Top 10 by revenue</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 24, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={hslVar("--border")} strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <Tooltip
                  formatter={(v: any) => [`₹${toNum(v).toLocaleString("en-IN")}`, "Revenue"]}
                  contentStyle={{ background: hslVar("--popover"), borderColor: hslVar("--border"), color: hslVar("--foreground") }}
                />
                <Bar dataKey="revenue" fill={hslVar("--primary")} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3">
            <div className="font-semibold">Category Sales + Profit</div>
            <div className="text-xs text-muted-foreground">Revenue vs profit by category</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryProfit} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={hslVar("--border")} strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
                <Tooltip
                  formatter={(v: any) => [`₹${toNum(v).toLocaleString("en-IN")}`, ""]}
                  contentStyle={{ background: hslVar("--popover"), borderColor: hslVar("--border"), color: hslVar("--foreground") }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Sales" fill={hslVar("--primary")} radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill={hslVar("--accent")} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3">
          <div className="font-semibold">Credit Outstanding (Activity)</div>
          <div className="text-xs text-muted-foreground">
            New credit created (pending amounts) vs payments received per day
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daySeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid stroke={hslVar("--border")} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
              <YAxis tick={{ fill: hslVar("--muted-foreground"), fontSize: 12 }} />
              <Tooltip
                formatter={(v: any) => [`₹${toNum(v).toLocaleString("en-IN")}`, ""]}
                contentStyle={{ background: hslVar("--popover"), borderColor: hslVar("--border"), color: hslVar("--foreground") }}
              />
              <Legend />
              <Line type="monotone" dataKey="creditCreated" name="Credit created" stroke={hslVar("--primary")} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="paymentsReceived" name="Payments received" stroke={hslVar("--secondary")} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}
