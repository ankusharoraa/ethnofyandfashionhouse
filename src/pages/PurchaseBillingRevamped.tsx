 import { useRef, useState, useCallback, useEffect } from 'react';
 import { AppLayout } from '@/components/layout/AppLayout';
 import { Card } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
  import { useToast } from '@/hooks/use-toast';
 import { useSuppliers } from '@/hooks/useSuppliers';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
 import { PurchaseHeader } from '@/components/purchase/PurchaseHeader';
 import { PurchaseProductTable } from '@/components/purchase/PurchaseProductTable';
import { PurchaseEntryForm, type PurchaseEntryFormHandle } from '@/components/purchase/PurchaseEntryForm';
 import { PurchaseSummaryCard } from '@/components/purchase/PurchaseSummaryCard';
 import type { PurchaseTableItem, PurchaseItemDraft, DiscountType, PurchaseType } from '@/types/purchase';
 import type { Supplier } from '@/hooks/useSuppliers';
 import { calculateBillTotals, calculateLineDiscount, calculateLineTotal, applyMarginIfEnabled } from '@/lib/purchaseCalculations';
import { allocateProportionalDiscount, calcInclusiveLine, normalizeState, splitGst, clampGstRate } from '@/lib/gst';
 import { useLocation, useNavigate } from 'react-router-dom';
 import { useShopSettings } from '@/hooks/useShopSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
 
 export default function PurchaseBillingRevamped() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
   const { suppliers } = useSuppliers();
  const { user } = useAuth();
   const { settings: shopSettings } = useShopSettings();
 
   // Supplier state
   const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
   const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
   const [supplierInvoiceDate, setSupplierInvoiceDate] = useState<Date>(new Date());
  const [supplierGstin, setSupplierGstin] = useState('');
 
   // Margin state
   const [marginEnabled, setMarginEnabled] = useState(false);
   const [marginRetail, setMarginRetail] = useState(0);
   const [marginWholesale, setMarginWholesale] = useState(0);
 
   // Table state
   const [tableItems, setTableItems] = useState<PurchaseTableItem[]>([]);
   const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

    // Dialog state
    const [skuSearchOpen, setSkuSearchOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

    const entryFormRef = useRef<PurchaseEntryFormHandle | null>(null);

    const barcodePrefill = new URLSearchParams(location.search).get('barcode') || undefined;
 
   // Draft item state
   const [draft, setDraft] = useState<PurchaseItemDraft | null>(null);
 
   // Bill totals state
   const [billDiscount, setBillDiscount] = useState(0);
   const [roundOff, setRoundOff] = useState(0);
   const [purchaseType, setPurchaseType] = useState<PurchaseType>('credit');
   const [amountPaid, setAmountPaid] = useState(0);
   const [bankAccount, setBankAccount] = useState('');
 
   // Invoice number (mock for now)
   const [invoiceNumber] = useState(`PGST-${Date.now()}-2024/25`);
 
  // Handle GSTIN search
  const handleGstinSearch = useCallback((gstin: string) => {
    if (!gstin.trim()) return;

    const supplier = suppliers.find(
      (s) => s.gstin?.toUpperCase() === gstin.toUpperCase()
    );

    if (supplier) {
      setSelectedSupplier(supplier);
      setSupplierGstin(supplier.gstin || '');
      toast({
        title: 'Supplier Found',
        description: `${supplier.name} selected`,
      });
    } else {
      toast({
        title: 'Not Found',
        description: 'No supplier found with this GSTIN',
        variant: 'destructive',
      });
    }
  }, [suppliers, toast]);

  // Update GSTIN when supplier changes
  useEffect(() => {
    if (selectedSupplier) {
      setSupplierGstin(selectedSupplier.gstin || '');
    }
  }, [selectedSupplier]);

   // Initialize draft when SKU is selected
   const handleDraftChange = useCallback((field: string, value: any) => {
     setDraft((prev) => {
       if (field === 'sku') {
         // Initialize new draft with SKU
         const sku = value;
          const gstRate = clampGstRate(Number((sku as any).gst_rate ?? 0));
           const initialPurchaseUnit = sku.price_type === 'per_metre'
             ? ((sku as any).purchase_rate ?? 0)
             : ((sku as any).purchase_fixed_price ?? 0);
           const initialLineGross = Number(initialPurchaseUnit || 0) * 1;
          const { taxableValue } = calcInclusiveLine({ grossAmount: initialLineGross, gstRate });

           const stockCurrent = sku.price_type === 'per_metre'
             ? Number(sku.length_metres ?? 0)
             : Number(sku.quantity ?? 0);

           const mrpDefault = sku.price_type === 'per_metre'
             ? Number(sku.rate ?? 0)
             : Number(sku.fixed_price ?? 0);

          return {
           sku,
           purchase_qty: 1,
           unit: sku.price_type === 'per_metre' ? 'metre' : 'unit',
            // IMPORTANT: purchase_price defaults to COST price
            purchase_price: Number(initialPurchaseUnit || 0),
           discount_type: null,
           discount_value: 0,
            // MRP defaults to SELLING price
            mrp: Number(mrpDefault || 0),
            stock_current: stockCurrent,
            taxable_amount: taxableValue,
         };
       }
 
       if (!prev) return null;
 
       const updated = { ...prev, [field]: value };
 
       // Auto-calculate MRP when purchase price changes and margin is enabled
       if (field === 'purchase_price' && marginEnabled) {
         updated.mrp = applyMarginIfEnabled(value, marginEnabled, marginRetail);
       }
 
        // Update taxable amount (inclusive GST) whenever amounts change.
        const sku = updated.sku;
        const gstRate = clampGstRate(Number((sku as any)?.gst_rate ?? 0));
        const grossLine = calculateLineTotal(
          Number(updated.purchase_price || 0),
          Number(updated.purchase_qty || 0),
          updated.discount_type,
          Number(updated.discount_value || 0)
        );
        const { taxableValue } = calcInclusiveLine({ grossAmount: grossLine, gstRate });
        updated.taxable_amount = taxableValue;

        return updated;
     });
   }, [marginEnabled, marginRetail]);
 
   // Add to table
   const handleAddToTable = useCallback(() => {
     if (!draft?.sku || draft.purchase_qty <= 0 || draft.purchase_price <= 0) {
       toast({
         title: 'Validation Error',
         description: 'Please fill all required fields',
         variant: 'destructive',
       });
       return;
     }
 
     const calculatedDiscount = calculateLineDiscount(
       draft.purchase_price,
       draft.purchase_qty,
       draft.discount_type,
       draft.discount_value
     );
 
     const lineTotal = calculateLineTotal(
       draft.purchase_price,
       draft.purchase_qty,
       draft.discount_type,
       draft.discount_value
     );
 
     const newItem: PurchaseTableItem = {
       id: `temp-${Date.now()}-${Math.random()}`,
       sku_id: draft.sku.id,
       sku_code: draft.sku.sku_code,
       product_name: draft.sku.name,
       purchase_qty: draft.purchase_qty,
       purchase_price: draft.purchase_price,
        hsn_code: (draft.sku as any).hsn_code ?? null,
        gst_rate: Number((draft.sku as any).gst_rate ?? 0),
       discount_type: draft.discount_type,
       discount_value: draft.discount_value,
       calculated_discount: calculatedDiscount,
       total_amount: lineTotal,
       alt_unit: draft.unit,
       mrp: draft.mrp,
       taxable_amount: draft.taxable_amount,
     };
 
     // Check if item already exists in table
     const existingIndex = tableItems.findIndex((item) => item.sku_id === draft.sku.id);
 
     if (existingIndex >= 0) {
       // Update existing item
       setTableItems((prev) => {
         const updated = [...prev];
         updated[existingIndex] = newItem;
         return updated;
       });
       toast({
         title: 'Product Updated',
         description: 'Product quantity and price updated in the table',
       });
     } else {
       // Add new item
       setTableItems((prev) => [...prev, newItem]);
       toast({
         title: 'Product Added',
         description: 'Product added to purchase list',
       });
     }
 
     // Clear draft
     setDraft(null);
     setSelectedRowIndex(null);
   }, [draft, tableItems, toast]);
 
   // Select row for editing
   const handleSelectRow = useCallback((index: number) => {
     const item = tableItems[index];
     setSelectedRowIndex(index);
 
     // Load item into draft for editing
     setDraft({
       sku: { id: item.sku_id, sku_code: item.sku_code, name: item.product_name } as any,
       purchase_qty: item.purchase_qty,
       unit: item.alt_unit,
       purchase_price: item.purchase_price,
       discount_type: item.discount_type,
       discount_value: item.discount_value,
       mrp: item.mrp,
       stock_current: 0,
       taxable_amount: item.taxable_amount,
     });
   }, [tableItems]);

    const requestDelete = useCallback((index: number) => {
      setPendingDeleteIndex(index);
      setConfirmDeleteOpen(true);
    }, []);
 
   // Delete row
    const handleDeleteRow = useCallback((index: number) => {
     setTableItems((prev) => prev.filter((_, i) => i !== index));
     if (selectedRowIndex === index) {
       setDraft(null);
       setSelectedRowIndex(null);
     }
     toast({
       title: 'Product Removed',
       description: 'Product removed from purchase list',
     });
   }, [selectedRowIndex, toast]);

    // Listen for the global command palette's "Add item" action
    useEffect(() => {
      const onOpenSkuSearch = () => setSkuSearchOpen(true);
      window.addEventListener('app:open-sku-search', onOpenSkuSearch as any);
      return () => window.removeEventListener('app:open-sku-search', onOpenSkuSearch as any);
    }, []);

    // Keyboard shortcuts (only when not typing / no dialog open)
    useEffect(() => {
      const isTextEditingTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (target.isContentEditable) return true;
        const role = target.getAttribute('role');
        return role === 'textbox';
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (skuSearchOpen || confirmDeleteOpen) return;
        if (isTextEditingTarget(e.target)) return;
        if (tableItems.length === 0) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = selectedRowIndex === null ? 0 : Math.min(tableItems.length - 1, selectedRowIndex + 1);
          handleSelectRow(next);
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = selectedRowIndex === null ? tableItems.length - 1 : Math.max(0, selectedRowIndex - 1);
          handleSelectRow(prev);
          return;
        }

        if (e.key === 'Enter') {
          if (selectedRowIndex === null) return;
          e.preventDefault();
          entryFormRef.current?.focusEditor();
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedRowIndex === null) return;
          e.preventDefault();
          requestDelete(selectedRowIndex);
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [confirmDeleteOpen, handleSelectRow, requestDelete, selectedRowIndex, skuSearchOpen, tableItems.length]);

    // Keep selected row visible
    useEffect(() => {
      if (selectedRowIndex === null) return;
      const el = document.querySelector<HTMLElement>(`[data-row-index="${selectedRowIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }, [selectedRowIndex]);
 
   // Calculate totals
   const billTotals = calculateBillTotals(tableItems, billDiscount, roundOff, 0);

  const shopState = normalizeState(shopSettings?.state ?? null);
  const supplierState = normalizeState((selectedSupplier as any)?.state ?? null);
  const isInterState = !!shopState && !!supplierState && shopState !== supplierState;

  const lineGross = tableItems.map((i) => i.total_amount);
  const allocations = allocateProportionalDiscount(lineGross, billDiscount);

  const purchaseTax = tableItems.reduce(
    (acc, item, idx) => {
      const discountedGross = Math.max(0, item.total_amount - (allocations[idx] ?? 0));
      const gstRate = clampGstRate(Number(item.gst_rate ?? 0));
      const { taxableValue, gstAmount } = calcInclusiveLine({ grossAmount: discountedGross, gstRate });
      const split = splitGst(isInterState, gstAmount);
      acc.taxableSubtotal += taxableValue;
      acc.taxAmount += gstAmount;
      acc.cgst += split.cgst;
      acc.sgst += split.sgst;
      acc.igst += split.igst;
      return acc;
    },
    { taxableSubtotal: 0, taxAmount: 0, cgst: 0, sgst: 0, igst: 0 }
  );

   const handlePrintBarcodesFromPurchase = useCallback(() => {
     if (tableItems.length === 0) {
       toast({
         title: 'No items',
         description: 'Add products to the purchase before printing barcodes',
         variant: 'destructive',
       });
       return;
     }

     const skuIds = Array.from(new Set(tableItems.map((i) => i.sku_id)));
     const params = new URLSearchParams();
     params.set('skuIds', skuIds.join(','));
     navigate(`/barcode-printing?${params.toString()}`);
   }, [navigate, tableItems, toast]);
 
   // Reset form
   const handleReset = useCallback(() => {
     setTableItems([]);
     setDraft(null);
     setSelectedRowIndex(null);
     setBillDiscount(0);
     setRoundOff(0);
     setAmountPaid(0);
     toast({
       title: 'Form Reset',
       description: 'All fields have been cleared',
     });
   }, [toast]);
 
   // Save purchase
   const handleSave = useCallback(async () => {
     // Validation
     if (!selectedSupplier) {
       toast({
         title: 'Validation Error',
         description: 'Please select a supplier',
         variant: 'destructive',
       });
       return;
     }
 
     if (tableItems.length === 0) {
       toast({
         title: 'Validation Error',
         description: 'Please add at least one product',
         variant: 'destructive',
       });
       return;
     }
 
     if (purchaseType === 'cash' && amountPaid !== billTotals.finalAmount) {
       toast({
         title: 'Validation Error',
         description: 'For cash purchases, amount paid must equal total amount',
         variant: 'destructive',
       });
       return;
     }
 
     if (purchaseType === 'partial' && (amountPaid <= 0 || amountPaid >= billTotals.finalAmount)) {
       toast({
         title: 'Validation Error',
         description: 'For partial payment, amount paid must be between 0 and total amount',
         variant: 'destructive',
       });
       return;
     }
 
     try {
      // Generate invoice number
      const { data: invNumber, error: invError } = await supabase.rpc('generate_invoice_number');
      if (invError) throw invError;
      
      // Create invoice
      const paymentMethod = purchaseType === 'credit' ? 'credit' : 'cash';
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          invoice_number: invNumber,
          invoice_type: 'purchase',
          supplier_id: selectedSupplier.id,
          supplier_name: selectedSupplier.name,
          supplier_invoice_no: supplierInvoiceNo || null,
          supplier_invoice_date: supplierInvoiceDate ? supplierInvoiceDate.toISOString().split('T')[0] : null,
           subtotal: purchaseTax.taxableSubtotal,
          discount_amount: billTotals.billDiscount,
           tax_amount: purchaseTax.taxAmount,
           cgst_amount: purchaseTax.cgst,
           sgst_amount: purchaseTax.sgst,
           igst_amount: purchaseTax.igst,
           gst_pricing_mode: 'inclusive',
           place_of_supply_state: supplierState,
           supplier_gstin: selectedSupplier.gstin || null,
          round_off_amount: billTotals.roundOffAmount,
          total_amount: billTotals.finalAmount,
          amount_paid: purchaseType === 'credit' ? 0 : amountPaid,
          pending_amount: billTotals.finalAmount - (purchaseType === 'credit' ? 0 : amountPaid),
          payment_method: paymentMethod,
          status: 'draft',
          created_by: user?.id,
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items with discount data
      const allocationsForInsert = allocateProportionalDiscount(tableItems.map((i) => i.total_amount), billDiscount);
      const itemsToInsert = tableItems.map((item, idx) => {
        const discountedGross = Math.max(0, item.total_amount - (allocationsForInsert[idx] ?? 0));
        const gstRate = clampGstRate(Number(item.gst_rate ?? 0));
        const { taxableValue, gstAmount } = calcInclusiveLine({ grossAmount: discountedGross, gstRate });
        const split = splitGst(isInterState, gstAmount);
        return {
          invoice_id: invoice.id,
          sku_id: item.sku_id,
          sku_code: item.sku_code,
          sku_name: item.product_name,
          price_type: (item.alt_unit === 'metre' ? 'per_metre' : 'fixed') as 'fixed' | 'per_metre',
          rate: item.alt_unit === 'metre' ? item.purchase_price : null,
          quantity: item.alt_unit === 'unit' ? item.purchase_qty : null,
          length_metres: item.alt_unit === 'metre' ? item.purchase_qty : null,
          unit_price: item.purchase_price,
          line_total: item.total_amount,
          mrp: item.mrp,
          discount_type: item.discount_type,
          discount_percent: item.discount_type === 'percent_per_unit' ? item.discount_value : 0,
          discount_amount_per_unit: item.discount_type === 'amount_per_unit' ? item.discount_value : 0,
          discount_total_amount: item.discount_type === 'total_amount' ? item.discount_value : 0,
          calculated_discount: item.calculated_discount,
          hsn_code: item.hsn_code ?? null,
          gst_rate: gstRate,
          taxable_value: taxableValue,
          cgst_amount: split.cgst,
          sgst_amount: split.sgst,
          igst_amount: split.igst,
        };
      });

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback invoice
        await supabase.from('invoices').delete().eq('id', invoice.id);
        throw itemsError;
      }
       
      // Complete purchase invoice (updates inventory)
      const { data: result, error: completeError } = await supabase.rpc('complete_purchase_invoice', {
        p_invoice_id: invoice.id,
        p_payment_method: paymentMethod,
        p_amount_paid: purchaseType === 'credit' ? 0 : amountPaid,
      });

      if (completeError) throw completeError;
      const purchaseResult = result as any;
      if (!purchaseResult?.success) throw new Error(purchaseResult?.error || 'Failed to complete purchase');
 
       toast({
         title: 'Purchase Saved',
        description: 'Purchase invoice created and inventory updated successfully',
       });
 
      // Reset form
      handleReset();
     } catch (error: any) {
      console.error('Error saving purchase:', error);
       toast({
         title: 'Error',
         description: error.message || 'Failed to save purchase',
         variant: 'destructive',
       });
     }
   }, [
     selectedSupplier,
     tableItems,
     purchaseType,
     amountPaid,
     billTotals,
     billDiscount,
     supplierInvoiceNo,
    supplierInvoiceDate,
    user,
    handleReset,
     toast,
   ]);
 
   return (
     <AppLayout>
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove item?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the selected item from the purchase list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDeleteIndex(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingDeleteIndex === null) return;
                  handleDeleteRow(pendingDeleteIndex);
                  setPendingDeleteIndex(null);
                  setConfirmDeleteOpen(false);
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

       <div className="flex flex-col h-[calc(100vh-4rem)]">
         {/* Header */}
         <PurchaseHeader
           supplier={selectedSupplier}
           invoiceNumber={invoiceNumber}
           supplierInvoiceNo={supplierInvoiceNo}
           supplierInvoiceDate={supplierInvoiceDate}
          supplierGstin={supplierGstin}
           marginEnabled={marginEnabled}
           marginRetail={marginRetail}
           marginWholesale={marginWholesale}
           onSupplierChange={setSelectedSupplier}
           onInvoiceInfoChange={(field, value) => {
             if (field === 'supplierInvoiceNo') setSupplierInvoiceNo(value);
             else if (field === 'supplierInvoiceDate') setSupplierInvoiceDate(value);
            else if (field === 'supplierGstin') setSupplierGstin(value);
           }}
          onGstinSearch={handleGstinSearch}
           onMarginChange={(field, value) => {
             if (field === 'enabled') setMarginEnabled(value);
             else if (field === 'retail') setMarginRetail(value);
             else if (field === 'wholesale') setMarginWholesale(value);
           }}
         />
 
         {/* Main Content */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
           {/* Left: Product Table */}
           <Card className="flex-1 flex flex-col min-w-0">
             <PurchaseProductTable
               items={tableItems}
               selectedIndex={selectedRowIndex}
               onSelectRow={handleSelectRow}
                onDeleteRow={requestDelete}
             />
 
             {/* Bottom Actions */}
             <div className="p-4 border-t flex gap-2">
               <Button variant="outline" size="sm" disabled>
                 Product Setting
               </Button>
               <Button variant="destructive" size="sm" onClick={handleReset}>
                 Reset
               </Button>
               <Button variant="outline" size="sm" disabled>
                 Import Excel
               </Button>
             </div>
           </Card>
 
           {/* Right: Entry Form & Summary */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4 lg:sticky lg:top-4 self-start">
             <PurchaseEntryForm
                ref={entryFormRef}
               draft={draft}
               marginEnabled={marginEnabled}
               marginRetail={marginRetail}
               marginWholesale={marginWholesale}
                skuSearchOpen={skuSearchOpen}
                setSkuSearchOpen={setSkuSearchOpen}
                 initialBarcode={barcodePrefill}
               onDraftChange={handleDraftChange}
               onAddToTable={handleAddToTable}
               onClear={() => {
                 setDraft(null);
                 setSelectedRowIndex(null);
               }}
             />
 
             <PurchaseSummaryCard
                subtotal={purchaseTax.taxableSubtotal}
               billDiscount={billDiscount}
               roundOff={roundOff}
                cgstAmount={purchaseTax.cgst}
                sgstAmount={purchaseTax.sgst}
                igstAmount={purchaseTax.igst}
                taxAmount={purchaseTax.taxAmount}
               totalAmount={billTotals.finalAmount}
               purchaseType={purchaseType}
               amountPaid={amountPaid}
               balance={selectedSupplier ? selectedSupplier.outstanding_balance : 0}
               supplierLastPrice={0}
               productLastPrice={0}
               onDiscountChange={setBillDiscount}
               onRoundOffChange={setRoundOff}
               onPurchaseTypeChange={setPurchaseType}
               onAmountPaidChange={setAmountPaid}
               onBankAccountChange={setBankAccount}
                onPrintBarcodes={handlePrintBarcodesFromPurchase}
               onPrint={() => {
                 toast({ title: 'Coming Soon', description: 'Print preview will be available soon' });
               }}
               onSave={handleSave}
               bankAccount={bankAccount}
             />
           </div>
         </div>
       </div>
     </AppLayout>
   );
 }