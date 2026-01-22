import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Plus,
  QrCode,
  Trash2,
  Receipt,
  History,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BillItemRow } from '@/components/billing/BillItemRow';
import { SKUSearchDialog } from '@/components/billing/SKUSearchDialog';
import { PaymentDialog } from '@/components/billing/PaymentDialog';
import { InvoiceCard } from '@/components/billing/InvoiceCard';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBilling, type PaymentMethod } from '@/hooks/useBilling';
import { useSKUs } from '@/hooks/useSKUs';
import { useToast } from '@/hooks/use-toast';

export default function Billing() {
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
  } = useBilling();
  const { skus, findByBarcode } = useSKUs();
  const { toast } = useToast();

  const [showSearch, setShowSearch] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const totals = calculateTotals();

  const handleScan = async (code: string) => {
    setShowScanner(false);
    const sku = await findByBarcode(code);
    
    if (sku) {
      addToCart(sku);
      toast({
        title: 'Added to Bill',
        description: sku.name,
      });
    } else {
      toast({
        title: 'Not Found',
        description: 'No SKU with this barcode',
        variant: 'destructive',
      });
    }
  };

  const handlePaymentConfirm = async (
    paymentMethod: PaymentMethod,
    customerName?: string,
    customerPhone?: string
  ) => {
    setIsProcessing(true);
    try {
      const result = await createAndCompleteBill(customerName, customerPhone, paymentMethod);
      if (result) {
        setShowPayment(false);
        toast({
          title: '✅ Bill Created!',
          description: `Invoice ${result.invoice_number} - ₹${totals.totalAmount.toFixed(2)}`,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    if (confirm('Are you sure you want to cancel this invoice? Stock will be restored.')) {
      await cancelInvoice(invoiceId);
    }
  };

  return (
    <AppLayout>
      <Tabs defaultValue="new-bill" className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Billing</h1>
          <TabsList>
            <TabsTrigger value="new-bill" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              New Bill
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* New Bill Tab */}
        <TabsContent value="new-bill" className="space-y-4">
          {/* Add Item Buttons */}
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

          {/* Cart Items */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
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
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Totals & Checkout */}
          {cartItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
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

                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setShowPayment(true)}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Proceed to Payment
                </Button>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <Card className="p-12 text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-lg text-muted-foreground">No invoices yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first bill to see it here
                </p>
              </Card>
            ) : (
              <AnimatePresence>
                {invoices.map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onCancel={handleCancelInvoice}
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
        skus={skus}
        onSelect={addToCart}
        onScanRequest={() => {
          setShowSearch(false);
          setShowScanner(true);
        }}
      />

      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <PaymentDialog
        open={showPayment}
        onClose={() => setShowPayment(false)}
        totalAmount={totals.totalAmount}
        onConfirm={handlePaymentConfirm}
        isProcessing={isProcessing}
      />
    </AppLayout>
  );
}
