import { motion } from 'framer-motion';
import { Minus, Plus, Trash2, Ruler, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { InvoiceItem } from '@/hooks/useBilling';

interface BillItemRowProps {
  item: InvoiceItem;
  onUpdate: (skuId: string, updates: Partial<InvoiceItem>) => void;
  onRemove: (skuId: string) => void;
  isPurchase?: boolean;
}

export function BillItemRow({ item, onUpdate, onRemove, isPurchase = false }: BillItemRowProps) {
  const isPerMetre = item.price_type === 'per_metre';
  const currentValue = isPerMetre ? item.length_metres : item.quantity;
  // For purchase, no stock limit; for sales, use available stock
  const maxValue = isPurchase ? 9999 : (item.availableStock || 999);

  const effectiveUnitPrice = isPerMetre ? (item.rate ?? item.unit_price) : item.unit_price;

  const handlePriceChange = (value: string) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    if (isPerMetre) {
      // Keep both fields in sync so:
      // - UI displays consistently
      // - Purchase completion updates SKU rate (uses invoice_items.rate)
      onUpdate(item.sku_id, { rate: numValue, unit_price: numValue });
    } else {
      onUpdate(item.sku_id, { unit_price: numValue });
    }
  };

  const handleIncrement = () => {
    if (currentValue >= maxValue) return;
    
    if (isPerMetre) {
      onUpdate(item.sku_id, { length_metres: item.length_metres + 0.5 });
    } else {
      onUpdate(item.sku_id, { quantity: item.quantity + 1 });
    }
  };

  const handleDecrement = () => {
    if (currentValue <= (isPerMetre ? 0.5 : 1)) return;
    
    if (isPerMetre) {
      onUpdate(item.sku_id, { length_metres: item.length_metres - 0.5 });
    } else {
      onUpdate(item.sku_id, { quantity: item.quantity - 1 });
    }
  };

  const handleValueChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    const clampedValue = Math.min(Math.max(0, numValue), maxValue);
    
    if (isPerMetre) {
      onUpdate(item.sku_id, { length_metres: clampedValue });
    } else {
      onUpdate(item.sku_id, { quantity: Math.floor(clampedValue) });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
    >
      {/* SKU Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isPerMetre ? (
            <Ruler className="w-4 h-4 text-primary shrink-0" />
          ) : (
            <Package className="w-4 h-4 text-secondary shrink-0" />
          )}
          <p className="font-medium truncate">{item.sku_name}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.sku_code} • ₹{effectiveUnitPrice.toFixed(2)}{isPerMetre ? '/m' : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          {isPurchase ? 'Current stock' : 'Stock'}: {item.availableStock} {isPerMetre ? 'm' : 'pcs'}
        </p>
      </div>

      {/* Purchase Cost */}
      {isPurchase && (
        <div className="hidden sm:block">
          <p className="text-[10px] text-muted-foreground mb-1">{isPerMetre ? 'Rate (₹/m)' : 'Cost (₹/pc)'}</p>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={effectiveUnitPrice}
            onChange={(e) => handlePriceChange(e.target.value)}
            className="w-24 h-8"
          />
        </div>
      )}

      {/* Quantity Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleDecrement}
          disabled={currentValue <= (isPerMetre ? 0.5 : 1)}
        >
          <Minus className="w-3 h-3" />
        </Button>
        
        <Input
          type="number"
          value={currentValue}
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-16 h-8 text-center"
          step={isPerMetre ? 0.5 : 1}
          min={isPerMetre ? 0.5 : 1}
          max={maxValue}
        />
        
        <span className="text-xs text-muted-foreground w-4">
          {isPerMetre ? 'm' : ''}
        </span>
        
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleIncrement}
          disabled={currentValue >= maxValue}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* Line Total */}
      <div className="text-right min-w-[80px]">
        <p className="font-semibold">₹{item.line_total.toFixed(2)}</p>
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => onRemove(item.sku_id)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}
