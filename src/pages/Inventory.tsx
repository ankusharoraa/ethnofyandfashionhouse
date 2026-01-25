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
  const { variantSkus, categories, subcategories, isLoading, createSKU, updateSKU, updateStock, deleteSKU } = useSKUs();
  const [showForm, setShowForm] = useState(false);
  const [editingSKU, setEditingSKU] = useState<SKU | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const canEditStock = hasPermission('stock_edit');

  const filtered = useMemo(() => {
    let result = variantSkus;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.sku_code.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      result = result.filter(s => s.category_id === categoryFilter);
    }
    return result;
  }, [variantSkus, search, categoryFilter]);

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
        onSubmit={async (d) => {
          // Form now sends base_name + color for variants.
          const baseName = (d as any).base_name?.toString().trim();
          const color = (d as any).color?.toString().trim();

          if (!baseName || !color) return null;

          if (editingSKU) {
            // Stock updates must be traceable
            const nextQty = typeof d.quantity === 'number' ? d.quantity : editingSKU.quantity;
            const nextLen = typeof d.length_metres === 'number' ? d.length_metres : editingSKU.length_metres;
            const stockChanged = nextQty !== editingSKU.quantity || nextLen !== editingSKU.length_metres;
            if (stockChanged) {
              await updateStock(editingSKU.id, nextQty, nextLen, 'Manual adjustment via SKU edit');
            }

            // Update shared fields on base product (price/name/category/etc)
            if (editingSKU.parent_sku_id) {
              const { quantity, length_metres, sku_code, barcode, color: _c, base_name: _b, ...rest } = d as any;
              await updateSKU(editingSKU.parent_sku_id, {
                name: baseName,
                category_id: rest.category_id ?? null,
                subcategory_id: rest.subcategory_id ?? null,
                description: rest.description ?? null,
                price_type: rest.price_type,
                fixed_price: rest.price_type === 'fixed' ? rest.fixed_price : null,
                rate: rest.price_type === 'per_metre' ? rest.rate : null,
                low_stock_threshold: rest.low_stock_threshold,
                image_url: rest.image_url ?? null,
              });
            }

            // Update variant-specific fields
            const { quantity, length_metres, price_type, fixed_price, rate, category_id, subcategory_id, description, low_stock_threshold, ...variantRest } = d as any;
            return updateSKU(editingSKU.id, {
              sku_code: variantRest.sku_code,
              barcode: variantRest.barcode ?? null,
              color,
              base_name: baseName,
              name_hindi: variantRest.name_hindi ?? null,
              image_url: variantRest.image_url ?? null,
            });
          }

          // Create base product + first variant
          const base = await createSKU({
            sku_code: `BASE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            barcode: null,
            name: baseName,
            category_id: (d as any).category_id ?? null,
            subcategory_id: (d as any).subcategory_id ?? null,
            description: (d as any).description ?? null,
            price_type: (d as any).price_type,
            fixed_price: (d as any).price_type === 'fixed' ? (d as any).fixed_price : null,
            rate: (d as any).price_type === 'per_metre' ? (d as any).rate : null,
            quantity: 0,
            length_metres: 0,
            low_stock_threshold: (d as any).low_stock_threshold ?? 5,
            image_url: (d as any).image_url ?? null,
          });
          if (!base) return null;

          return createSKU({
            sku_code: (d as any).sku_code,
            barcode: (d as any).barcode ?? null,
            name: baseName,
            parent_sku_id: base.id,
            base_name: baseName,
            color,
            name_hindi: (d as any).name_hindi ?? null,
            quantity: 0,
            length_metres: 0,
            low_stock_threshold: (d as any).low_stock_threshold ?? 5,
            image_url: (d as any).image_url ?? null,
          });
        }}
        sku={editingSKU}
        categories={categories}
        subcategories={subcategories}
        allowStockEdit={canEditStock}
      />
    </AppLayout>
  );
}
