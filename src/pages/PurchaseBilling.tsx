import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import {
  Plus,
  QrCode,
  Trash2,
  Receipt,
  History,
  CheckCircle2,
  Package,
  TrendingDown,
  Building2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { BillItemRow } from '@/components/billing/BillItemRow';
import { SKUSearchDialog } from '@/components/billing/SKUSearchDialog';
import { PurchasePaymentDialog } from '@/components/billing/PurchasePaymentDialog';
import { SupplierSearchDialog } from '@/components/billing/SupplierSearchDialog';
import { SupplierCreateDialog } from '@/components/suppliers/SupplierCreateDialog';
import { InvoiceCard } from '@/components/billing/InvoiceCard';
import { InvoiceViewDialog } from '@/components/billing/InvoiceViewDialog';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { useBilling, type PaymentMethod, type Invoice } from '@/hooks/useBilling';
import { useSKUs } from '@/hooks/useSKUs';
import { useSuppliers, type Supplier } from '@/hooks/useSuppliers';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';

export default function PurchaseBilling() {
  const {
    invoices,
    cartItems,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    calculateTotals,
    createAndCompletePurchaseBill,
    cancelPurchaseInvoice,
  } = useBilling();
  const { variantSkus, baseSkus, findByBarcode, createSKU, fetchSKUs } = useSKUs();
  const { suppliers, createSupplier, fetchSuppliers } = useSuppliers();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [showSearch, setShowSearch] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showSupplierCreate, setShowSupplierCreate] = useState(false);
  const [showPurchasePayment, setShowPurchasePayment] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [pendingPurchaseCheckout, setPendingPurchaseCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const [filterBySupplierHistory, setFilterBySupplierHistory] = useState(true);
  const [supplierSkuIds, setSupplierSkuIds] = useState<Set<string> | null>(null);
  const [supplierSkuLoading, setSupplierSkuLoading] = useState(false);

  const totals = calculateTotals();

  const generateSkuCode = (name: string) => {
    const prefix = (name.trim().slice(0, 2) || 'SK').toUpperCase().replace(/[^A-Z0-9]/g, 'S');
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${rand}`;
  };

  const handleCreateSkuForPurchase = async (draft: {
    base_name: string;
    color: string;
    price_type: 'fixed' | 'per_metre';
    purchase_fixed_price?: number | null;
    purchase_rate?: number | null;
    fixed_price?: number | null;
    rate?: number | null;
  }) => {
    const baseName = draft.base_name.trim();
    const color = draft.color.trim();
    if (!baseName || !color) return null;

    const existingBase = baseSkus.find((s) => s.name.trim().toLowerCase() === baseName.toLowerCase());

    const { data: barcode, error } = await supabase.rpc('generate_unique_barcode', { p_prefix: 'BC' });
    if (error) {
      console.error('Failed to generate barcode:', error);
      toast({ title: 'Error', description: 'Failed to generate barcode', variant: 'destructive' });
      return null;
    }

    const base =
      existingBase ||
      (await createSKU({
        sku_code: generateSkuCode(baseName),
        barcode: null,
        name: baseName,
        price_type: draft.price_type,
        fixed_price: draft.price_type === 'fixed' ? (draft.fixed_price ?? 0) : null,
        rate: draft.price_type === 'per_metre' ? (draft.rate ?? 0) : null,
        purchase_fixed_price: draft.price_type === 'fixed' ? (draft.purchase_fixed_price ?? 0) : null,
        purchase_rate: draft.price_type === 'per_metre' ? (draft.purchase_rate ?? 0) : null,
        quantity: 0,
        length_metres: 0,
        low_stock_threshold: 5,
      }));

    if (!base) return null;

    const existingVariant = variantSkus.find(
      (s) => s.parent_sku_id === base.id && (s.color ?? '').trim().toLowerCase() === color.toLowerCase()
    );
    if (existingVariant) return existingVariant;

    const variant = await createSKU({
      sku_code: generateSkuCode(`${baseName}-${color}`),
      barcode,
      name: baseName,
      parent_sku_id: base.id,
      base_name: baseName,
      color,
      quantity: 0,
      length_metres: 0,
      low_stock_threshold: 5,
    });

    return (variant as any) || null;
  };

  const purchaseInvoices = invoices.filter((i) => i.invoice_type === 'purchase');

  useEffect(() => {
    const load = async () => {
      if (!filterBySupplierHistory || !selectedSupplier) {
        setSupplierSkuIds(null);
        return;
      }

      setSupplierSkuLoading(true);
      try {
        const { data: invData, error: invErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('invoice_type', 'purchase')
          .eq('supplier_id', selectedSupplier.id)
          .order('created_at', { ascending: false })
          .limit(500);

        if (invErr) {
          console.error('Failed to load supplier purchase invoices:', invErr);
          setSupplierSkuIds(null);
          return;
        }

        const invoiceIds = (invData ?? []).map((r) => r.id);
        if (invoiceIds.length === 0) {
          setSupplierSkuIds(new Set());
          return;
        }

        const { data: itemData, error: itemErr } = await supabase
          .from('invoice_items')
          .select('sku_id')
          .in('invoice_id', invoiceIds)
          .limit(1000);

        if (itemErr) {
          console.error('Failed to load supplier purchase items:', itemErr);
          setSupplierSkuIds(null);
          return;
        }

        const set = new Set<string>();
        (itemData ?? []).forEach((r) => set.add(r.sku_id));
        setSupplierSkuIds(set);
      } finally {
        setSupplierSkuLoading(false);
      }
    };

    void load();
  }, [filterBySupplierHistory, selectedSupplier]);

  const skusForPicker = useMemo(() => {
    const list = variantSkus;
    if (!filterBySupplierHistory) return list;
    if (!selectedSupplier) return list;
    if (!supplierSkuIds) return list;
    return list.filter((s) => supplierSkuIds.has(s.id));
  }, [filterBySupplierHistory, selectedSupplier, supplierSkuIds, variantSkus]);

  const handleScan = async (code: string) => {
    setShowScanner(false);
    const sku = await findByBarcode(code);

    if (sku) {
      addToCart(sku);
      // Default purchase entry: cost from purchase_* and sell from selling price
      setTimeout(() => {
        const cost = sku.price_type === 'per_metre' ? (sku.purchase_rate ?? 0) : (sku.purchase_fixed_price ?? 0);
        const sell = sku.price_type === 'per_metre' ? (sku.rate ?? 0) : (sku.fixed_price ?? 0);
        if (sku.price_type === 'per_metre') {
          updateCartItem(sku.id, { rate: cost, unit_price: cost, sell_price: sell });
        } else {
          updateCartItem(sku.id, { unit_price: cost, sell_price: sell });
        }
      }, 0);
      toast({ title: 'Added to Purchase', description: sku.name });
    } else {
      toast({
        title: 'Not Found',
        description: 'No SKU with this barcode',
        variant: 'destructive',
      });
    }
  };

  const handlePurchasePaymentConfirm = async (paymentMethod: PaymentMethod, amountPaid: number) => {
    if (!hasPermission('purchase_bill')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to create purchase bills',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedSupplier) {
      toast({ title: 'Select Supplier', description: 'Please select a supplier first', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await createAndCompletePurchaseBill(
        selectedSupplier.id,
        selectedSupplier.name,
        paymentMethod,
        amountPaid
      );
      if (result) {
        setShowPurchasePayment(false);
        setSelectedSupplier(null);
        clearCart();
        // Reflect stock-in immediately in the inventory UI
        void fetchSKUs();
        toast({
          title: '✅ Purchase Recorded!',
          description: `Invoice ${result.invoice_number} - ₹${totals.totalAmount.toFixed(2)}`,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelPurchase = async (invoiceId: string) => {
    if (confirm('Are you sure you want to cancel this invoice? Stock will be adjusted.')) {
      await cancelPurchaseInvoice(invoiceId);
    }
  };

  const handleRecordPurchaseClick = () => {
    // Client-side validation (numeric fields are safe, but we still validate for data integrity)
    const itemSchema = z.object({
      price_type: z.enum(['fixed', 'per_metre']),
      quantity: z.number().finite().nonnegative(),
      length_metres: z.number().finite().nonnegative(),
      unit_price: z.number().finite().nonnegative(),
      rate: z.number().finite().nullable(),
      sell_price: z.number().finite().nullable().optional(),
    });

    const res = z
      .array(itemSchema)
      .min(1, { message: 'Add at least one item' })
      .safeParse(cartItems);

    if (!res.success) {
      toast({
        title: 'Invalid purchase',
        description: res.error.issues[0]?.message || 'Please check your entries',
        variant: 'destructive',
      });
      return;
    }

    // Require positive quantity/length, a positive cost, and a positive selling price
    for (const item of cartItems) {
      if (item.price_type === 'fixed') {
        if ((item.quantity ?? 0) <= 0) {
          toast({ title: 'Invalid quantity', description: 'Quantity must be at least 1', variant: 'destructive' });
          return;
        }
        if ((item.unit_price ?? 0) <= 0) {
          toast({ title: 'Invalid cost', description: 'Cost (₹/pc) must be greater than 0', variant: 'destructive' });
          return;
        }
        if (((item.sell_price ?? 0) as number) <= 0) {
          toast({ title: 'Invalid selling price', description: 'Selling price (₹/pc) must be greater than 0', variant: 'destructive' });
          return;
        }
      } else {
        if ((item.length_metres ?? 0) <= 0) {
          toast({ title: 'Invalid length', description: 'Length must be greater than 0', variant: 'destructive' });
          return;
        }
        const rate = item.rate ?? item.unit_price;
        if ((rate ?? 0) <= 0) {
          toast({ title: 'Invalid rate', description: 'Rate (₹/m) must be greater than 0', variant: 'destructive' });
          return;
        }
        if (((item.sell_price ?? 0) as number) <= 0) {
          toast({ title: 'Invalid selling price', description: 'Selling price (₹/m) must be greater than 0', variant: 'destructive' });
          return;
        }
      }
    }

    if (!selectedSupplier) {
      setPendingPurchaseCheckout(true);
      setShowSupplierSearch(true);
      return;
    }
    setShowPurchasePayment(true);
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierSearch(false);
    if (pendingPurchaseCheckout) {
      setPendingPurchaseCheckout(false);
      setShowPurchasePayment(true);
    }
  };

  const canCreateSupplierHere = suppliers.length === 0;

  return (
    <AppLayout>
      <Tabs defaultValue="new-purchase" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-primary" />
            Purchases / Stock In
          </h1>
          <TabsList>
            <TabsTrigger value="new-purchase" className="gap-2">
              <Package className="w-4 h-4" />
              New Purchase
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="new-purchase" className="space-y-4">
          {/* Supplier */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
                {selectedSupplier ? (
                  <div className="min-w-0">
                    <p className="font-medium truncate">{selectedSupplier.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedSupplier.phone || selectedSupplier.gstin || 'Supplier'}
                    </p>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="text-muted-foreground">No supplier selected</p>
                    <p className="text-xs text-muted-foreground">Supplier is required to record purchase</p>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (canCreateSupplierHere) {
                    setShowSupplierCreate(true);
                    return;
                  }
                  setShowSupplierSearch(true);
                }}
              >
                {selectedSupplier ? 'Change' : canCreateSupplierHere ? 'Add Supplier' : 'Select Supplier'}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="filterBySupplier"
                  checked={filterBySupplierHistory}
                  onCheckedChange={setFilterBySupplierHistory}
                  disabled={!selectedSupplier}
                />
                <Label htmlFor="filterBySupplier" className={!selectedSupplier ? 'text-muted-foreground' : ''}>
                  Show items previously purchased from this supplier
                </Label>
              </div>
              {supplierSkuLoading && (
                <span className="text-xs text-muted-foreground">Loading…</span>
              )}
            </div>
          </Card>

           {/* Add Item Buttons */}
           <div className="grid grid-cols-2 gap-3">
             <Button onClick={() => setShowSearch(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Purchased Item
            </Button>
             <Button variant="outline" onClick={() => setShowScanner(true)}>
              <QrCode className="w-4 h-4 mr-2" />
              Scan
            </Button>
          </div>

          {/* Items */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Purchased Items ({cartItems.length} items)
              </h2>
              {cartItems.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    clearCart();
                    toast({ title: 'Cleared', description: 'Purchase items cleared' });
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No items added</p>
                <p className="text-sm">Add purchased items by searching or scanning</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  <AnimatePresence>
                    {cartItems.map((item) => (
                      <BillItemRow
                        key={item.sku_id}
                        item={item}
                        onUpdate={updateCartItem}
                        onRemove={removeFromCart}
                        isPurchase
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </Card>

          {cartItems.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-₹{totals.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>₹{totals.taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">₹{totals.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <Button size="lg" className="w-full" onClick={handleRecordPurchaseClick}>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Record Purchase
                </Button>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-3">
            {purchaseInvoices.length === 0 ? (
              <Card className="p-12 text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-lg text-muted-foreground">No purchase invoices yet</p>
                <p className="text-sm text-muted-foreground">Record your first purchase to see it here</p>
              </Card>
            ) : (
              <AnimatePresence>
                {purchaseInvoices.map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onCancel={handleCancelPurchase}
                    onViewDetails={setViewingInvoice}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SKUSearchDialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        skus={skusForPicker}
        onSelect={(sku) => {
          addToCart(sku);
          setTimeout(() => {
            const cost = sku.price_type === 'per_metre' ? (sku.purchase_rate ?? 0) : (sku.purchase_fixed_price ?? 0);
            const sell = sku.price_type === 'per_metre' ? (sku.rate ?? 0) : (sku.fixed_price ?? 0);
            if (sku.price_type === 'per_metre') {
              updateCartItem(sku.id, { rate: cost, unit_price: cost, sell_price: sell });
            } else {
              updateCartItem(sku.id, { unit_price: cost, sell_price: sell });
            }
          }, 0);
        }}
        onScanRequest={() => {
          setShowSearch(false);
          setShowScanner(true);
        }}
        mode="purchase"
        onCreateSku={handleCreateSkuForPurchase}
      />

      <SupplierSearchDialog
        open={showSupplierSearch}
        onClose={() => {
          setShowSupplierSearch(false);
          setPendingPurchaseCheckout(false);
        }}
        suppliers={suppliers}
        onSelect={handleSelectSupplier}
        onCreateNew={canCreateSupplierHere ? () => {
          setShowSupplierSearch(false);
          setShowSupplierCreate(true);
        } : undefined}
      />

      <SupplierCreateDialog
        open={showSupplierCreate}
        onClose={() => setShowSupplierCreate(false)}
        onCreate={async (data) => {
          const created = await createSupplier(data);
          // Keep list fresh either way
          void fetchSuppliers();
          return created as Supplier | null;
        }}
        onCreated={(created) => {
          setSelectedSupplier(created);
          if (pendingPurchaseCheckout) {
            setPendingPurchaseCheckout(false);
            setShowPurchasePayment(true);
          }
        }}
      />

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      <PurchasePaymentDialog
        open={showPurchasePayment}
        onClose={() => setShowPurchasePayment(false)}
        totalAmount={totals.totalAmount}
        supplier={selectedSupplier}
        onConfirm={handlePurchasePaymentConfirm}
        isProcessing={isProcessing}
      />

      <InvoiceViewDialog open={!!viewingInvoice} onClose={() => setViewingInvoice(null)} invoice={viewingInvoice} />
    </AppLayout>
  );
}
