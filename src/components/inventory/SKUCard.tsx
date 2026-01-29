import { motion } from 'framer-motion';
import { Package, Ruler, AlertTriangle, Edit2, Trash2, Barcode } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SKU } from '@/hooks/useSKUs';
import { useState } from 'react';
import { BarcodeActionsDialog } from '@/components/barcodes/BarcodeActionsDialog';

interface SKUCardProps {
  sku: SKU;
  onEdit?: (sku: SKU) => void;
  onDelete?: (sku: SKU) => void;
  onClick?: (sku: SKU) => void;
  showActions?: boolean;
}

export function SKUCard({ sku, onEdit, onDelete, onClick, showActions = true }: SKUCardProps) {
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const isLowStock = sku.price_type === 'per_metre'
    ? sku.length_metres < sku.low_stock_threshold
    : sku.quantity < sku.low_stock_threshold;

  const stockValue = sku.price_type === 'per_metre'
    ? `${sku.length_metres}m`
    : sku.quantity;

  const price = sku.price_type === 'per_metre'
    ? `₹${sku.rate}/m`
    : `₹${sku.fixed_price}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'p-4 cursor-pointer card-hover overflow-hidden',
          isLowStock && 'border-destructive/50 bg-destructive/5'
        )}
        onClick={() => onClick?.(sku)}
      >
        <div className="flex gap-4">
          {/* Image or Placeholder */}
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {sku.image_url ? (
              <img
                src={sku.image_url}
                alt={sku.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{sku.name}</h3>
                {/* Hindi name intentionally hidden to keep UI concise */}
              </div>
              
              {isLowStock && (
                <Badge variant="destructive" className="flex-shrink-0 gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Low
                </Badge>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="font-mono">
                {sku.sku_code}
              </Badge>
              {sku.barcode && (
                <Badge variant="outline" className="font-mono">
                  {sku.barcode}
                </Badge>
              )}
              {sku.categories && (
                <Badge variant="outline">{sku.categories.name}</Badge>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Price */}
                <span className="font-semibold text-primary">{price}</span>
                
                {/* Stock */}
                <span className={cn(
                  'flex items-center gap-1 text-sm',
                  isLowStock ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {sku.price_type === 'per_metre' ? (
                    <Ruler className="w-4 h-4" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                  {stockValue}
                </span>
              </div>

              {/* Actions */}
              {showActions && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {sku.barcode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setBarcodeOpen(true)}
                      aria-label="Barcode actions"
                    >
                      <Barcode className="w-4 h-4" />
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(sku)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(sku)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <BarcodeActionsDialog
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        sku={sku}
      />
    </motion.div>
  );
}
