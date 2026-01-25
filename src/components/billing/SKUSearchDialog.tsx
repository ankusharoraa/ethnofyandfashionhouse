import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, QrCode, Package, Ruler, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SKU } from '@/hooks/useSKUs';
import { SKUCreateInline, type SKUCreateDraft } from '@/components/billing/SKUCreateInline';

interface SKUSearchDialogProps {
  open: boolean;
  onClose: () => void;
  skus: SKU[];
  onSelect: (sku: SKU) => void;
  onScanRequest: () => void;
  mode?: 'sale' | 'purchase';
  onCreateSku?: (draft: {
    name: string;
    price_type: 'fixed' | 'per_metre';
    fixed_price?: number | null;
    rate?: number | null;
  }) => Promise<SKU | null>;
}

export function SKUSearchDialog({
  open,
  onClose,
  skus,
  onSelect,
  onScanRequest,
  mode = 'sale',
  onCreateSku,
}: SKUSearchDialogProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return skus.slice(0, 20);
    
    const q = search.toLowerCase();
    return skus.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.sku_code.toLowerCase().includes(q) ||
        s.barcode?.toLowerCase().includes(q) ||
        s.categories?.name?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [skus, search]);

  const handleSelect = (sku: SKU) => {
    onSelect(sku);
    setSearch('');
    onClose();
  };

  const canCreate = mode === 'purchase' && typeof onCreateSku === 'function';

  const handleCreate = async (draft: SKUCreateDraft) => {
    if (!canCreate || !onCreateSku) return;
    const sku = await onCreateSku(draft);
    if (sku) handleSelect(sku);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            {mode === 'purchase' ? 'Add Purchased Item' : 'Add Item to Bill'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search items by name, SKU, or barcode and add them to the current bill.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <Button variant="outline" size="icon" onClick={onScanRequest}>
              <QrCode className="w-4 h-4" />
            </Button>
          </div>

          {/* Create new SKU (purchase only) */}
          <SKUCreateInline enabled={canCreate} searchValue={search} onCreate={handleCreate} />

          {/* Results */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-1">
              <AnimatePresence>
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No items found</p>
                  </div>
                ) : (
                  filtered.map((sku) => {
                    const isPerMetre = sku.price_type === 'per_metre';
                    const stock = isPerMetre ? sku.length_metres : sku.quantity;
                    const isOutOfStock = stock <= 0;
                    const isDisabled = mode === 'sale' && isOutOfStock;

                    return (
                      <motion.div
                        key={sku.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          isDisabled
                            ? 'bg-muted/50 opacity-60 cursor-not-allowed'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => !isDisabled && handleSelect(sku)}
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          {isPerMetre ? (
                            <Ruler className="w-5 h-5 text-primary" />
                          ) : (
                            <Package className="w-5 h-5 text-primary" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{sku.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{sku.sku_code}</span>
                            {sku.categories?.name && (
                              <>
                                <span>•</span>
                                <span>{sku.categories.name}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            ₹{isPerMetre ? sku.rate : sku.fixed_price}
                            {isPerMetre && <span className="text-xs">/m</span>}
                          </p>
                          <Badge
                            variant={
                              mode === 'purchase'
                                ? 'outline'
                                : isOutOfStock
                                  ? 'destructive'
                                  : stock < 5
                                    ? 'secondary'
                                    : 'outline'
                            }
                            className="text-xs"
                          >
                            {mode === 'purchase' ? 'Current: ' : ''}
                            {stock} {isPerMetre ? 'm' : 'pcs'}
                          </Badge>
                        </div>

                        {!isDisabled && (
                          <Button size="icon" variant="ghost" className="shrink-0">
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
