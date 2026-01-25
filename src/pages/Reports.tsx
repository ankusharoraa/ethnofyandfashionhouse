import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/card';
import { Package, AlertTriangle, TrendingUp, Ruler } from 'lucide-react';
import { useSKUs } from '@/hooks/useSKUs';
import { ReportCharts } from '@/components/reports/ReportCharts';

export default function Reports() {
  const { skus, categories, getLowStockItems } = useSKUs();
  
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


  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total SKUs" value={stats.totalItems} icon={Package} />
        <StatsCard title="Low Stock" value={stats.lowStock} icon={AlertTriangle} variant={stats.lowStock > 0 ? 'destructive' : 'default'} />
        <StatsCard title="Total Value" value={`₹${stats.totalValue.toLocaleString('en-IN')}`} icon={TrendingUp} />
        <StatsCard title="Total Metres" value={`${stats.totalMetres}m`} icon={Ruler} />
      </div>

      <div className="mb-8">
        <ReportCharts />
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
