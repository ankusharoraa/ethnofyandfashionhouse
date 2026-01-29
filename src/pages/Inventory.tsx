import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SKUCard } from '@/components/inventory/SKUCard';
import { SKUForm } from '@/components/inventory/SKUForm';
import { BarcodeGenerator } from '@/components/inventory/BarcodeGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSKUs } from '@/hooks/useSKUs';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

export default function Inventory() {
  const { isOwner } = useAuth();
  const { hasPermission } = usePermissions();
  const { skus, categories, subcategories, createSKU, updateSKU, deleteSKU, fetchSKUs } = useSKUs();
  const [showForm, setShowForm] = useState(false);
  const [editingSKU, setEditingSKU] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = skus;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.sku_code.toLowerCase().includes(q) ||
        s.barcode?.toLowerCase().includes(q)
      );
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
        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <BarcodeGenerator 
                skus={skus} 
                onComplete={fetchSKUs}
              />
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Show message if no products */}
      {skus.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">No products in inventory</p>
          {isOwner && (
            <p className="text-sm">Click "Add Product" to create your first product</p>
          )}
        </div>
      )}

      {/* Show message if no search results */}
      {skus.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No products match your search</p>
        </div>
      )}

      {/* Search and Filter */}
      {skus.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search products..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-10" 
              />
            </div>
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Product Grid */}
      {filtered.length > 0 && (
        <div className="grid gap-3">
          <AnimatePresence>
            {filtered.map(sku => (
              <SKUCard 
                key={sku.id} 
                sku={sku} 
                onEdit={isOwner ? setEditingSKU : undefined} 
                onDelete={isOwner ? (s) => deleteSKU(s.id) : undefined} 
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* SKU Form Dialog */}
      <SKUForm
        open={showForm || !!editingSKU}
        onClose={() => {
          setShowForm(false);
          setEditingSKU(null);
        }}
        onSubmit={async (data) => {
          if (editingSKU) {
            await updateSKU(editingSKU.id, data);
          } else {
            await createSKU(data);
          }
          setShowForm(false);
          setEditingSKU(null);
        }}
        sku={editingSKU}
        categories={categories}
        subcategories={subcategories}
      />
    </AppLayout>
  );
}
