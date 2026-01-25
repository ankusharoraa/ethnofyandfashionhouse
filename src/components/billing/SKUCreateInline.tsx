import { useMemo, useState } from 'react';
import { Plus, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type PriceTypeDraft = 'fixed' | 'per_metre';

export interface SKUCreateDraft {
  base_name: string;
  color: string;
  price_type: PriceTypeDraft;
  fixed_price?: number | null;
  rate?: number | null;
}

interface SKUCreateInlineProps {
  enabled: boolean;
  searchValue: string;
  onCreate: (draft: SKUCreateDraft) => Promise<void>;
}

export function SKUCreateInline({ enabled, searchValue, onCreate }: SKUCreateInlineProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [newBaseName, setNewBaseName] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newPriceType, setNewPriceType] = useState<PriceTypeDraft>('fixed');
  const [newFixedPrice, setNewFixedPrice] = useState('');
  const [newRate, setNewRate] = useState('');

  const suggestedBaseName = useMemo(() => {
    const s = searchValue.trim();
    if (!s) return '';
    // avoid filling in barcodes/SKU codes as a name
    if (/^[A-Z]{2,4}-[A-Z0-9]{4,}$/i.test(s)) return '';
    if (s.length > 60) return s.slice(0, 60);
    return s;
  }, [searchValue]);

  const handleCreate = async () => {
    if (!enabled) return;

    const base_name = (newBaseName || suggestedBaseName).trim();
    const color = newColor.trim();
    if (!base_name || !color) return;

    const draft: SKUCreateDraft = {
      base_name,
      color,
      price_type: newPriceType,
      fixed_price: newPriceType === 'fixed' ? Math.max(0, parseFloat(newFixedPrice) || 0) : null,
      rate: newPriceType === 'per_metre' ? Math.max(0, parseFloat(newRate) || 0) : null,
    };

    setIsCreating(true);
    try {
      await onCreate(draft);
      setNewBaseName('');
      setNewColor('');
      setNewFixedPrice('');
      setNewRate('');
      setOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Add new SKU</div>
              <div className="text-xs text-muted-foreground truncate">
              Creates a product + a color variant (barcode is generated)
              </div>
            </div>
          </div>

          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create SKU
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-3 space-y-2">
          <Input
              placeholder={suggestedBaseName ? `Design name (e.g. ${suggestedBaseName})` : 'Design name'}
              value={newBaseName}
              onChange={(e) => setNewBaseName(e.target.value)}
          />

            <Input
              placeholder="Color (e.g. Maroon)"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
            />

          <div className="flex gap-2">
            <Button
              type="button"
              variant={newPriceType === 'fixed' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setNewPriceType('fixed')}
            >
              Fixed
            </Button>
            <Button
              type="button"
              variant={newPriceType === 'per_metre' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setNewPriceType('per_metre')}
            >
              Per metre
            </Button>
          </div>

          {newPriceType === 'fixed' ? (
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              placeholder="Default cost (₹/pc)"
              value={newFixedPrice}
              onChange={(e) => setNewFixedPrice(e.target.value)}
            />
          ) : (
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              placeholder="Default rate (₹/m)"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
            />
          )}

          <Button type="button" className="w-full" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating…' : 'Create & Add to Purchase'}
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
