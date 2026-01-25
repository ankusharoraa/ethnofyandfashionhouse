import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Filter, SortAsc } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SKUCard } from '@/components/inventory/SKUCard';
import { SKUForm } from '@/components/inventory/SKUForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSKUs, SKU } from '@/hooks/useSKUs';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

export default function Inventory() {
  const { isOwner } = useAuth();
  const { hasPermission } = usePermissions();
  const { skus, categories, subcategories, isLoading, createSKU, updateSKU, updateStock, deleteSKU } = useSKUs();
  const [showForm, setShowForm] = useState(false);
  const [editingSKU, setEditingSKU] = useState<SKU | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const canEditStock = hasPermission('stock_edit');

  const filtered = useMemo(() => {
    let result = skus;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.sku_code.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      result = result.filter(s => s.category_id === categoryFilter);
    }
    return result;
  }, [skus, search, categoryFilter]);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        {isOwner && (
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Add SKU</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search SKUs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        <AnimatePresence>
          {filtered.map(sku => (
            <SKUCard key={sku.id} sku={sku} onEdit={isOwner ? setEditingSKU : undefined} onDelete={isOwner ? (s) => deleteSKU(s.id) : undefined} />
          ))}
        </AnimatePresence>
      </div>

      <SKUForm
        open={showForm || !!editingSKU}
        onClose={() => {
          setShowForm(false);
          setEditingSKU(null);
        }}
        onSubmit={
          editingSKU
            ? async (d) => {
                // Enforce traceability: if stock is changed manually from this form,
                // record an inventory log entry via updateStock.
                const nextQty = typeof d.quantity === 'number' ? d.quantity : editingSKU.quantity;
                const nextLen = typeof d.length_metres === 'number' ? d.length_metres : editingSKU.length_metres;

                const stockChanged = nextQty !== editingSKU.quantity || nextLen !== editingSKU.length_metres;

                if (stockChanged) {
                  await updateStock(editingSKU.id, nextQty, nextLen, 'Manual adjustment via SKU edit');
                }

                // Update other fields without touching stock.
                const { quantity, length_metres, ...rest } = d as any;
                return updateSKU(editingSKU.id, rest);
              }
            : createSKU
        }
        sku={editingSKU}
        categories={categories}
        subcategories={subcategories}
        allowStockEdit={canEditStock}
      />
    </AppLayout>
  );
}
