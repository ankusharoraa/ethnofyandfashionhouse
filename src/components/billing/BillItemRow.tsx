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

  // Purchase-only: selling price per unit/metre is stored on invoice_items.sell_price
  const effectiveSellPrice = isPurchase
    ? (item.sell_price ?? (isPerMetre ? (item.sku?.rate ?? 0) : (item.sku?.fixed_price ?? 0)))
    : 0;

  const profitPerUnit = isPurchase ? (effectiveSellPrice - effectiveUnitPrice) : 0;
  const marginPercent = isPurchase && effectiveUnitPrice > 0
    ? ((effectiveSellPrice - effectiveUnitPrice) / effectiveUnitPrice) * 100
    : 0;

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

  const handleSellPriceChange = (value: string) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    onUpdate(item.sku_id, { sell_price: numValue });
  };

  const handleMarginChange = (value: string) => {
    const margin = parseFloat(value);
    if (!Number.isFinite(margin)) {
      onUpdate(item.sku_id, { sell_price: 0 });
      return;
    }
    const sell = Math.max(0, effectiveUnitPrice * (1 + margin / 100));
    onUpdate(item.sku_id, { sell_price: sell });
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

        {/* Purchase pricing (mobile) */}
        {isPurchase && (
          <div className="sm:hidden mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">{isPerMetre ? 'Cost (₹/m)' : 'Cost (₹/pc)'}</p>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={effectiveUnitPrice}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="h-8"
              />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">{isPerMetre ? 'Selling (₹/m)' : 'Selling (₹/pc)'}</p>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={effectiveSellPrice}
                onChange={(e) => handleSellPriceChange(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] text-muted-foreground">
                  Profit {profitPerUnit >= 0 ? '' : '-'}₹{Math.abs(profitPerUnit).toFixed(2)}{isPerMetre ? '/m' : '/pc'}
                  <span className="mx-2">•</span>
                  Margin {Number.isFinite(marginPercent) ? marginPercent.toFixed(2) : '0.00'}%
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  step={0.01}
                  value={Number.isFinite(marginPercent) ? marginPercent.toFixed(2) : ''}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  className="h-8 w-24"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Purchase Cost */}
      {isPurchase && (
        <div className="hidden sm:flex items-end gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">{isPerMetre ? 'Cost (₹/m)' : 'Cost (₹/pc)'}</p>
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

          <div>
            <p className="text-[10px] text-muted-foreground mb-1">{isPerMetre ? 'Selling (₹/m)' : 'Selling (₹/pc)'}</p>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={effectiveSellPrice}
              onChange={(e) => handleSellPriceChange(e.target.value)}
              className="w-24 h-8"
            />
          </div>

          <div className="w-28">
            <p className="text-[10px] text-muted-foreground mb-1">Margin %</p>
            <Input
              type="number"
              inputMode="decimal"
              step={0.01}
              value={Number.isFinite(marginPercent) ? marginPercent.toFixed(2) : ''}
              onChange={(e) => handleMarginChange(e.target.value)}
              className="w-28 h-8"
            />
          </div>
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
          className="w-24 sm:w-28 h-8 text-center tabular-nums"
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
        {isPurchase && (
          <p className="text-[10px] text-muted-foreground">
            Profit {profitPerUnit >= 0 ? '' : '-'}₹{Math.abs(profitPerUnit).toFixed(2)}{isPerMetre ? '/m' : '/pc'}
          </p>
        )}
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
