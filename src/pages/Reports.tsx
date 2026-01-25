import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/card';
import { Package, AlertTriangle, TrendingUp, Ruler, CalendarIcon, TrendingDown, IndianRupee, Percent } from 'lucide-react';
import { useSKUs } from '@/hooks/useSKUs';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function Reports() {
  const { skus, categories, getLowStockItems } = useSKUs();

  const [profitDate, setProfitDate] = useState<Date>(() => new Date());
  const [profitLoading, setProfitLoading] = useState(false);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [dailyCost, setDailyCost] = useState(0);
  
  const stats = useMemo(() => {
    const lowStock = getLowStockItems();
    const totalValue = skus.reduce((sum, s) => sum + (s.price_type === 'per_metre' ? (s.rate || 0) * s.length_metres : (s.fixed_price || 0) * s.quantity), 0);
    const totalMetres = skus.filter(s => s.price_type === 'per_metre').reduce((sum, s) => sum + s.length_metres, 0);
    return { lowStock: lowStock.length, totalValue, totalMetres, totalItems: skus.length };
  }, [skus]);

  const categoryStats = useMemo(() => {
    return categories.map(c => ({
      ...c,
      count: skus.filter(s => s.category_id === c.id).length,
      value: skus.filter(s => s.category_id === c.id).reduce((sum, s) => sum + (s.price_type === 'per_metre' ? (s.rate || 0) * s.length_metres : (s.fixed_price || 0) * s.quantity), 0)
    }));
  }, [skus, categories]);

  const dailyProfit = dailyRevenue - dailyCost;
  const dailyProfitPercent = dailyRevenue > 0 ? (dailyProfit / dailyRevenue) * 100 : 0;

  useEffect(() => {
    const run = async () => {
      setProfitLoading(true);
      try {
        const from = startOfDay(profitDate).toISOString();
        const to = endOfDay(profitDate).toISOString();

        const { data, error } = await supabase
          .from('invoice_items')
          .select(
            `
            id,
            price_type,
            quantity,
            length_metres,
            line_total,
            cost_price,
            invoices!inner(created_at, invoice_type, status),
            skus(purchase_fixed_price, purchase_rate)
          `
          )
          .gte('invoices.created_at', from)
          .lte('invoices.created_at', to)
          .eq('invoices.invoice_type', 'sale')
          .eq('invoices.status', 'completed')
          .limit(1000);

        if (error) {
          console.error('Failed to load daily profit:', error);
          setDailyRevenue(0);
          setDailyCost(0);
          return;
        }

        const rows = (data ?? []) as any[];
        const revenue = rows.reduce((sum, r) => sum + (Number(r.line_total) || 0), 0);
        const cost = rows.reduce((sum, r) => {
          const unitCost =
            (r.cost_price != null ? Number(r.cost_price) : null) ??
            (r.price_type === 'per_metre'
              ? (r.skus?.purchase_rate != null ? Number(r.skus.purchase_rate) : 0)
              : (r.skus?.purchase_fixed_price != null ? Number(r.skus.purchase_fixed_price) : 0));

          const units = r.price_type === 'per_metre' ? Number(r.length_metres || 0) : Number(r.quantity || 0);
          return sum + unitCost * units;
        }, 0);

        setDailyRevenue(revenue);
        setDailyCost(cost);
      } finally {
        setProfitLoading(false);
      }
    };

    void run();
  }, [profitDate]);

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total SKUs" value={stats.totalItems} icon={Package} />
        <StatsCard title="Low Stock" value={stats.lowStock} icon={AlertTriangle} variant={stats.lowStock > 0 ? 'destructive' : 'default'} />
        <StatsCard title="Total Value" value={`₹${stats.totalValue.toLocaleString('en-IN')}`} icon={TrendingUp} />
        <StatsCard title="Total Metres" value={`${stats.totalMetres}m`} icon={Ruler} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-semibold">Daily Profit</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn('w-[220px] justify-start text-left font-normal', !profitDate && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {profitDate ? format(profitDate, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={profitDate}
              onSelect={(d) => d && setProfitDate(d)}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title={profitLoading ? 'Sales (loading)' : 'Sales'}
          value={`₹${dailyRevenue.toLocaleString('en-IN')}`}
          icon={TrendingUp}
        />
        <StatsCard
          title={profitLoading ? 'Cost (loading)' : 'Cost'}
          value={`₹${dailyCost.toLocaleString('en-IN')}`}
          icon={TrendingDown}
        />
        <StatsCard
          title={profitLoading ? 'Profit (loading)' : 'Profit'}
          value={`₹${dailyProfit.toLocaleString('en-IN')}`}
          icon={IndianRupee}
        />
        <StatsCard
          title={profitLoading ? 'Profit % (loading)' : 'Profit %'}
          value={`${dailyProfitPercent.toFixed(2)}%`}
          icon={Percent}
        />
      </div>

      <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {categoryStats.map(c => (
          <Card key={c.id} className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{c.name}</h3>
                <p className="text-sm text-muted-foreground hindi">{c.name_hindi}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{c.count} items</p>
                <p className="text-sm text-muted-foreground">₹{c.value.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
