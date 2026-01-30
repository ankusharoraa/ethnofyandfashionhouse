import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Package, AlertTriangle, TrendingUp, Ruler } from 'lucide-react';
import { useSKUs } from '@/hooks/useSKUs';
import { useAuth } from '@/hooks/useAuth';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportsOverview } from '@/components/reports/ReportsOverview';
import { ReportsCategories } from '@/components/reports/ReportsCategories';
import { DeadStockPanel } from '@/components/reports/DeadStockPanel';
import { ReportCharts } from '@/components/reports/ReportCharts';
import { ProfitPerSkuPanel } from '@/components/reports/ProfitPerSkuPanel';
import { PurchaseRecommendationsPanel } from '@/components/reports/PurchaseRecommendationsPanel';

export default function Reports() {
  const { skus, categories, getLowStockItems } = useSKUs();
  const { isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'graphs' | 'categories' | 'dead' | 'profit' | 'reorder'>(
    'overview'
  );
  
  const stats = useMemo(() => {
    const lowStock = getLowStockItems();
    const totalValue = skus.reduce((sum, s) => sum + (s.price_type === 'per_metre' ? (s.rate || 0) * s.length_metres : (s.fixed_price || 0) * s.quantity), 0);
    const totalMetres = skus.filter(s => s.price_type === 'per_metre').reduce((sum, s) => sum + s.length_metres, 0);
    return { lowStock: lowStock.length, totalValue, totalMetres, totalItems: skus.length };
  }, [skus]);

  return (
    <AppLayout>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Switch tabs to focus on one report at a time.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="graphs">Graphs</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          {isOwner && <TabsTrigger value="dead">Dead Stock</TabsTrigger>}
          {isOwner && <TabsTrigger value="profit">Profit</TabsTrigger>}
          {isOwner && <TabsTrigger value="reorder">Reorder</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ReportsOverview
            isOwner={isOwner}
            stats={stats}
            onOpenGraphs={() => setActiveTab('graphs')}
            onOpenCategories={() => setActiveTab('categories')}
            onOpenDeadStock={() => setActiveTab('dead')}
            cards={
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Total SKUs" value={stats.totalItems} icon={Package} />
                <StatsCard title="Low Stock" value={stats.lowStock} icon={AlertTriangle} variant={stats.lowStock > 0 ? 'destructive' : 'default'} />
                <StatsCard title="Total Value" value={`₹${stats.totalValue.toLocaleString('en-IN')}`} icon={TrendingUp} />
                <StatsCard title="Total Metres" value={`${stats.totalMetres}m`} icon={Ruler} />
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="graphs" className="mt-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Graphs are best for trend checking; use Dead Stock for action items.</p>
            {activeTab === 'graphs' && <ReportCharts />}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <ReportsCategories categories={categories} skus={skus} />
        </TabsContent>

        {isOwner && (
          <TabsContent value="dead" className="mt-6">
            {activeTab === 'dead' && <DeadStockPanel />}
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="profit" className="mt-6">
            {activeTab === 'profit' && <ProfitPerSkuPanel />}
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="reorder" className="mt-6">
            {activeTab === 'reorder' && <PurchaseRecommendationsPanel />}
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
