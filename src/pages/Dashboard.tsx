import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  FolderOpen,
  QrCode,
  ArrowRight,
  Search,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SKUCard } from '@/components/inventory/SKUCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSKUs } from '@/hooks/useSKUs';
import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { profile, isOwner } = useAuth();
  const { skus, categories, isLoading, getLowStockItems } = useSKUs();
  const [searchQuery, setSearchQuery] = useState('');

  const lowStockItems = useMemo(() => getLowStockItems(), [skus]);
  
  const totalValue = useMemo(() => {
    return skus.reduce((sum, sku) => {
      if (sku.price_type === 'per_metre') {
        return sum + (sku.rate || 0) * sku.length_metres;
      }
      return sum + (sku.fixed_price || 0) * sku.quantity;
    }, 0);
  }, [skus]);

  const recentItems = useMemo(() => {
    return skus.slice(0, 5);
  }, [skus]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return recentItems;
    const query = searchQuery.toLowerCase();
    return skus.filter(
      (sku) =>
        sku.name.toLowerCase().includes(query) ||
        sku.sku_code.toLowerCase().includes(query) ||
        sku.barcode?.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [skus, searchQuery, recentItems]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-muted-foreground">{greeting()}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {profile?.full_name || 'Welcome'}
            <span className="hindi text-lg font-normal text-muted-foreground ml-2">
              ({isOwner ? 'मालिक' : 'स्टाफ'})
            </span>
          </h1>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Button variant="outline" asChild className="gap-2">
          <Link to="/scan">
            <QrCode className="w-4 h-4" />
            Scan
          </Link>
        </Button>
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Quick search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total SKUs"
          titleHindi="कुल आइटम"
          value={skus.length}
          icon={Package}
          variant="primary"
        />
        <StatsCard
          title="Low Stock"
          titleHindi="कम स्टॉक"
          value={lowStockItems.length}
          icon={AlertTriangle}
          variant={lowStockItems.length > 0 ? 'destructive' : 'default'}
        />
        <StatsCard
          title="Categories"
          titleHindi="श्रेणियाँ"
          value={categories.length}
          icon={FolderOpen}
        />
        <StatsCard
          title="Stock Value"
          titleHindi="स्टॉक मूल्य"
          value={`₹${totalValue.toLocaleString('en-IN')}`}
          icon={TrendingUp}
        />
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="p-4 border-destructive/50 bg-destructive/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5 pulse-alert" />
                <h3 className="font-semibold">Low Stock Alert</h3>
                <Badge variant="destructive">{lowStockItems.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" asChild className="gap-1">
                <Link to="/inventory?filter=low-stock">
                  View All <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {lowStockItems.slice(0, 4).map((item) => (
                <Badge key={item.id} variant="outline" className="flex-shrink-0 py-1.5">
                  {item.name} - {item.price_type === 'per_metre' ? `${item.length_metres}m` : item.quantity}
                </Badge>
              ))}
              {lowStockItems.length > 4 && (
                <Badge variant="secondary" className="flex-shrink-0">
                  +{lowStockItems.length - 4} more
                </Badge>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Recent Items */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {searchQuery ? 'Search Results' : 'Recent Items'}
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/inventory" className="gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-24 animate-pulse bg-muted" />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid gap-3">
            {filteredItems.map((sku) => (
              <SKUCard
                key={sku.id}
                sku={sku}
                showActions={false}
              />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No items found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery ? 'Try a different search term' : 'Create products from Purchases'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link to="/purchase-billing-revamped">Go to Purchases</Link>
              </Button>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
