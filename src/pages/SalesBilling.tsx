import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Plus,
  QrCode,
  Trash2,
  Receipt,
  History,
  CheckCircle2,
  Package,
  TrendingUp,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { BillItemRow } from '@/components/billing/BillItemRow';
import { SKUSearchDialog } from '@/components/billing/SKUSearchDialog';
import { PaymentDialog } from '@/components/billing/PaymentDialog';
import { InvoiceCard } from '@/components/billing/InvoiceCard';
import { InvoiceViewDialog } from '@/components/billing/InvoiceViewDialog';
import { ReturnInvoiceDialog } from '@/components/billing/ReturnInvoiceDialog';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useBilling, type PaymentMethod, type Invoice } from '@/hooks/useBilling';
import { useSKUs } from '@/hooks/useSKUs';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useCustomers } from '@/hooks/useCustomers';
import { supabase } from '@/integrations/supabase/client';

export default function SalesBilling() {
  const {
    invoices,
    cartItems,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    calculateTotals,
    createAndCompleteBill,
    cancelInvoice,
    fetchInvoices,
  } = useBilling();
  const { customers } = useCustomers();
  const { skus, findByBarcode } = useSKUs();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();

  const [showSearch, setShowSearch] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [returningInvoice, setReturningInvoice] = useState<Invoice | null>(null);

  const totals = calculateTotals();

  // Deep link support: /sales?invoiceId=XXX opens invoice details
  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    if (!invoiceId) return;

    let cancelled = false;

    const openInvoice = async () => {
      const existing = invoices.find((i) => i.id === invoiceId);
      if (existing) {
        if (!cancelled) setViewingInvoice(existing);
        return;
      }

      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('id', invoiceId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load invoice deep link:', error);
        return;
      }
      if (!data) return;

      if (!cancelled) setViewingInvoice(data as Invoice);
    };

    void openInvoice();

    return () => {
      cancelled = true;
    };
  }, [searchParams, invoices]);

  const salesInvoices = invoices.filter((i) => i.invoice_type === 'sale');
  const returnInvoices = invoices.filter((i) => i.invoice_type === 'return');

  const handleScan = async (code: string) => {
    setShowScanner(false);
    const sku = await findByBarcode(code);

    if (sku) {
      addToCart(sku);
      toast({ title: 'Added to Sale', description: sku.name });
    } else {
      toast({
        title: 'Not Found',
        description: 'No SKU with this barcode',
        variant: 'destructive',
      });
    }
  };

  const handleSalesPaymentConfirm = async (
    paymentMethod: PaymentMethod,
    customerName?: string,
    customerPhone?: string,
    customerId?: string,
    amountPaid?: number
  ) => {
    if (!hasPermission('sales_bill')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to create sales bills',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await createAndCompleteBill(
        customerName,
        customerPhone,
        paymentMethod,
        customerId,
        amountPaid
      );
      if (result) {
        setShowPayment(false);
        toast({
          title: '✅ Sale Created!',
          description: `Invoice ${result.invoice_number} - ₹${totals.totalAmount.toFixed(2)}`,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSale = async (invoiceId: string) => {
    if (confirm('Are you sure you want to cancel this invoice? Stock will be adjusted.')) {
      await cancelInvoice(invoiceId);
    }
  };

  return (
    <AppLayout>
      <Tabs defaultValue="new-sale" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Sales
          </h1>
          <TabsList>
            <TabsTrigger value="new-sale" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              New Sale
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="new-sale" className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={() => setShowSearch(true)} className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
            <Button variant="outline" onClick={() => setShowScanner(true)}>
              <QrCode className="w-4 h-4 mr-2" />
              Scan
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Cart ({cartItems.length} items)
              </h2>
              {cartItems.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={clearCart}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Your cart is empty</p>
                <p className="text-sm">Add items by searching or scanning</p>
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
                        isPurchase={false}
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

                <Button size="lg" className="w-full" onClick={() => setShowPayment(true)}>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Proceed to Payment
                </Button>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Tabs defaultValue="sales" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sales" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Sales ({salesInvoices.length})
              </TabsTrigger>
              <TabsTrigger value="returns" className="gap-2">
                <Receipt className="w-4 h-4" />
                Returns ({returnInvoices.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <div className="space-y-3">
                {salesInvoices.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-lg text-muted-foreground">No sales invoices yet</p>
                    <p className="text-sm text-muted-foreground">Create your first sale to see it here</p>
                  </Card>
                ) : (
                  <AnimatePresence>
                    {salesInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        onCancel={handleCancelSale}
                        onReturn={setReturningInvoice}
                        onViewDetails={setViewingInvoice}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </TabsContent>

            <TabsContent value="returns">
              <div className="space-y-3">
                {returnInvoices.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-lg text-muted-foreground">No returns yet</p>
                    <p className="text-sm text-muted-foreground">Returns will appear here when processed</p>
                  </Card>
                ) : (
                  <AnimatePresence>
                    {returnInvoices.map((invoice) => (
                      <InvoiceCard key={invoice.id} invoice={invoice} onViewDetails={setViewingInvoice} />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SKUSearchDialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        skus={skus}
        onSelect={addToCart}
        onScanRequest={() => {
          setShowSearch(false);
          setShowScanner(true);
        }}
        mode="sale"
      />

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      <PaymentDialog
        customers={customers}
        open={showPayment}
        onClose={() => setShowPayment(false)}
        totalAmount={totals.totalAmount}
        onConfirm={handleSalesPaymentConfirm}
        isProcessing={isProcessing}
      />

      <InvoiceViewDialog
        open={!!viewingInvoice}
        onClose={() => {
          setViewingInvoice(null);
          const next = new URLSearchParams(searchParams);
          next.delete('invoiceId');
          setSearchParams(next, { replace: true });
        }}
        invoice={viewingInvoice}
      />

      <ReturnInvoiceDialog
        open={!!returningInvoice}
        onClose={() => setReturningInvoice(null)}
        invoice={returningInvoice}
        onReturnComplete={fetchInvoices}
      />
    </AppLayout>
  );
}
