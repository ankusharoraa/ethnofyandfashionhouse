 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Button } from '@/components/ui/button';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Checkbox } from '@/components/ui/checkbox';
  import { Barcode, Plus, X, Search } from 'lucide-react';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
 import type { PurchaseItemDraft, DiscountType } from '@/types/purchase';
 import { SKUSearchDialog } from '@/components/billing/SKUSearchDialog';
 import { useSKUs } from '@/hooks/useSKUs';
import type { SKU } from '@/hooks/useSKUs';
 import { calculateLineTotal, applyMarginIfEnabled } from '@/lib/purchaseCalculations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ShortcutHint } from '@/components/ui/shortcut-hint';
 
 interface PurchaseEntryFormProps {
   draft: PurchaseItemDraft | null;
   marginEnabled: boolean;
   marginRetail: number;
   marginWholesale: number;
    skuSearchOpen: boolean;
    setSkuSearchOpen: (open: boolean) => void;
   onDraftChange: (field: string, value: any) => void;
   onAddToTable: () => void;
   onClear: () => void;
 }

export type PurchaseEntryFormHandle = {
  focusEditor: () => void;
};
 
 export const PurchaseEntryForm = forwardRef<PurchaseEntryFormHandle, PurchaseEntryFormProps>(function PurchaseEntryForm(
   {
     draft,
     marginEnabled,
     marginRetail,
     onDraftChange,
     onAddToTable,
     onClear,
     skuSearchOpen,
     setSkuSearchOpen,
   },
   ref,
 ) {
  const { skus, fetchSKUs, categories, subcategories } = useSKUs();
  const { toast } = useToast();
  const { user } = useAuth();

   const searchInputRef = useRef<HTMLInputElement | null>(null);
   const qtyInputRef = useRef<HTMLInputElement | null>(null);

   useImperativeHandle(
     ref,
     () => ({
       focusEditor: () => {
         if (draft?.sku) {
           qtyInputRef.current?.focus();
           qtyInputRef.current?.select?.();
           return;
         }

         setSkuSearchOpen(true);
         // Keep focus inside the right-side panel for keyboard flow.
         requestAnimationFrame(() => searchInputRef.current?.focus());
       },
     }),
     [draft?.sku, setSkuSearchOpen],
   );
 
   const handleAddClick = () => {
     if (draft?.sku && draft.purchase_qty > 0 && draft.purchase_price > 0) {
       onAddToTable();
     }
   };
 
   const calculatedMRP = draft?.purchase_price
     ? applyMarginIfEnabled(draft.purchase_price, marginEnabled, marginRetail, draft.mrp)
     : 0;
 
   const lineTotal = draft
     ? calculateLineTotal(draft.purchase_price, draft.purchase_qty, draft.discount_type, draft.discount_value)
     : 0;
 
  const handleCreateSKU = async (draft: Partial<SKU>): Promise<SKU | null> => {
    try {
      // Capture the intended purchase quantity from the form
      const intendedPurchaseQty = draft.price_type === 'per_metre' 
        ? (draft.length_metres || 1) 
        : (draft.quantity || 1);
      
      // Generate SKU code
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const sku_code = `SKU-${timestamp}${random}`;

      // Insert into database
      const { data, error } = await supabase
        .from('skus')
        .insert({
          sku_code,
          name: draft.name!,
          barcode: draft.barcode || null,
          category_id: draft.category_id || null,
          subcategory_id: draft.subcategory_id || null,
          description: draft.description || null,
          hsn_code: (draft as any).hsn_code ?? null,
          gst_rate: (draft as any).gst_rate ?? 0,
          price_type: draft.price_type || 'fixed',
           purchase_fixed_price: (draft as any).purchase_fixed_price ?? null,
           purchase_rate: (draft as any).purchase_rate ?? null,
          fixed_price: draft.price_type === 'fixed' ? (draft.fixed_price || null) : null,
          rate: draft.price_type === 'per_metre' ? (draft.rate || null) : null,
          quantity: draft.price_type === 'fixed' ? 0 : null,
          length_metres: draft.price_type === 'per_metre' ? 0 : null,
          low_stock_threshold: draft.low_stock_threshold || 5,
          created_by: user?.id,
          updated_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'SKU Created',
        description: `${draft.name} created successfully`,
      });

      // Refresh SKU list
      await fetchSKUs();

      // Attach the intended purchase quantity to the SKU object
      const skuWithPurchaseQty = { 
        ...(data as SKU), 
        _intendedPurchaseQty: intendedPurchaseQty 
      };
      return skuWithPurchaseQty as any;
    } catch (error: any) {
      console.error('Error creating SKU:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create SKU',
        variant: 'destructive',
      });
      return null;
    }
  };

   return (
     <>
       <Card>
         <CardHeader className="pb-3">
           <CardTitle className="text-base">Product Information</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
           {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                   ref={searchInputRef}
                  placeholder="Search / select product"
                  value={draft?.sku?.name || ''}
                   onClick={() => setSkuSearchOpen(true)}
                  readOnly
                  className="pl-10 cursor-pointer"
                />
              </div>
              <ShortcutHint label="Search items" keys="Ctrl/Cmd K">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSkuSearchOpen(true)}
                  aria-label="Scan / search"
                >
                  <Barcode className="w-4 h-4" />
                </Button>
              </ShortcutHint>
            </div>
 
           {draft?.sku && (
             <>
               {/* Purchase Details */}
                <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                   <Label className="text-xs">Purchase Qty *</Label>
                   <Input
                      ref={qtyInputRef}
                     type="number"
                     min={1}
                     value={draft.purchase_qty}
                     onChange={(e) => onDraftChange('purchase_qty', parseFloat(e.target.value) || 1)}
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs">Unit *</Label>
                   <Select value={draft.unit} onValueChange={(v) => onDraftChange('unit', v)}>
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="unit">Unit</SelectItem>
                       <SelectItem value="metre">Metre</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs">Purchase Price</Label>
                   <Input
                     type="number"
                     step="0.01"
                     value={draft.purchase_price}
                     onChange={(e) => onDraftChange('purchase_price', parseFloat(e.target.value) || 0)}
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs">Taxable Amt</Label>
                   <Input type="number" disabled value={draft.taxable_amount.toFixed(2)} />
                 </div>
               </div>
 
               {/* Stock & Alt Unit */}
               <div className="flex items-center gap-4 text-sm text-muted-foreground">
                 <span>Stock: {draft.stock_current || 0}</span>
                 <span>Alt Unit: 1</span>
               </div>
 
               {/* Discount Structure */}
               <div className="space-y-2">
                 <Label className="text-xs">Disc. Type</Label>
                 <Select
                   value={draft.discount_type || 'none'}
                   onValueChange={(v) => onDraftChange('discount_type', v === 'none' ? null : v)}
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="none">No Discount</SelectItem>
                     <SelectItem value="percent_per_unit">% (Percentage)</SelectItem>
                     <SelectItem value="amount_per_unit">₹/unit</SelectItem>
                     <SelectItem value="total_amount">Total Amount</SelectItem>
                   </SelectContent>
                 </Select>
 
                <div className="grid grid-cols-3 gap-2">
                   <div>
                     <Label className="text-xs">(% Per Unit)</Label>
                     <div className="flex items-center gap-1">
                       <Input
                         type="number"
                         step="0.01"
                         disabled={draft.discount_type !== 'percent_per_unit'}
                         value={draft.discount_type === 'percent_per_unit' ? draft.discount_value : 0}
                         onChange={(e) => onDraftChange('discount_value', parseFloat(e.target.value) || 0)}
                       />
                       <span className="text-xs">%</span>
                     </div>
                   </div>
                   <div>
                     <Label className="text-xs">(Amt Per Unit)</Label>
                     <Input
                       type="number"
                       step="0.01"
                       disabled={draft.discount_type !== 'amount_per_unit'}
                       value={draft.discount_type === 'amount_per_unit' ? draft.discount_value : 0}
                       onChange={(e) => onDraftChange('discount_value', parseFloat(e.target.value) || 0)}
                     />
                   </div>
                   <div>
                     <Label className="text-xs">(Total Disc Amt)</Label>
                     <div className="flex items-center gap-1">
                       <Input
                         type="number"
                         step="0.01"
                         disabled={draft.discount_type !== 'total_amount'}
                         value={draft.discount_type === 'total_amount' ? draft.discount_value : 0}
                         onChange={(e) => onDraftChange('discount_value', parseFloat(e.target.value) || 0)}
                       />
                       <Checkbox disabled={draft.discount_type !== 'total_amount'} />
                     </div>
                   </div>
                 </div>
               </div>
 
               {/* MRP & Total */}
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                   <Label className="text-xs">MRP</Label>
                   <Input
                     type="number"
                     step="0.01"
                     disabled={marginEnabled}
                     value={calculatedMRP}
                     onChange={(e) => onDraftChange('mrp', parseFloat(e.target.value) || 0)}
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-xs">Total Amount</Label>
                   <Input
                     type="number"
                     disabled
                     value={lineTotal.toFixed(2)}
                     className="font-semibold"
                   />
                 </div>
               </div>
 
               {/* Add Button */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleAddClick}
                    disabled={!draft.sku || draft.purchase_qty <= 0 || draft.purchase_price <= 0}
                  >
                   <Plus className="w-4 h-4 mr-2" />
                   Add to Cart
                 </Button>
                  <Button variant="outline" size="icon" onClick={onClear} aria-label="Clear selection">
                    <X className="w-4 h-4" />
                 </Button>
               </div>
             </>
           )}
         </CardContent>
       </Card>
 
       <SKUSearchDialog
          open={skuSearchOpen}
          onClose={() => setSkuSearchOpen(false)}
         skus={skus}
         onSelect={(sku) => {
           onDraftChange('sku', sku);
            setSkuSearchOpen(false);
         }}
         onScanRequest={() => {
            setSkuSearchOpen(false);
         }}
         mode="purchase"
          onCreateSku={handleCreateSKU}
          categories={categories}
          subcategories={subcategories}
       />
     </>
   );
  });