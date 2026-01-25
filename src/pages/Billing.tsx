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
  Package,
  TrendingUp,
  TrendingDown,
  Building2,
  Eye,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BillItemRow } from '@/components/billing/BillItemRow';
import { SKUSearchDialog } from '@/components/billing/SKUSearchDialog';
import { PaymentDialog } from '@/components/billing/PaymentDialog';
import { PurchasePaymentDialog } from '@/components/billing/PurchasePaymentDialog';
import { SupplierSearchDialog } from '@/components/billing/SupplierSearchDialog';
import { InvoiceCard } from '@/components/billing/InvoiceCard';
import { InvoiceViewDialog } from '@/components/billing/InvoiceViewDialog';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useBilling, type PaymentMethod, type Invoice } from '@/hooks/useBilling';
import { useSKUs } from '@/hooks/useSKUs';
import { useSuppliers, type Supplier } from '@/hooks/useSuppliers';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useCustomers, type Customer } from '@/hooks/useCustomers';

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
    createAndCompletePurchaseBill,
    cancelInvoice,
    cancelPurchaseInvoice,
  } = useBilling();
   const { customers } = useCustomers();
  const { skus, findByBarcode } = useSKUs();
  const { suppliers } = useSuppliers();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const [billType, setBillType] = useState<'sale' | 'purchase'>('sale');
  const [showSearch, setShowSearch] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showPurchasePayment, setShowPurchasePayment] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const totals = calculateTotals();

  // Filter invoices by type
  const salesInvoices = invoices.filter((i) => i.invoice_type === 'sale');
  const purchaseInvoices = invoices.filter((i) => i.invoice_type === 'purchase');

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

  const handleSalesPaymentConfirm = async (
    paymentMethod: PaymentMethod,
    customerName?: string,
    customerPhone?: string
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
      const result = await createAndCompleteBill(customerName, customerPhone, paymentMethod,paymentMethod === 'credit' ? 0 : totals.totalAmount);
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

  const handlePurchasePaymentConfirm = async (
    paymentMethod: PaymentMethod,
    amountPaid: number
  ) => {
    if (!hasPermission('purchase_bill')) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to create purchase bills',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedSupplier) {
      toast({
        title: 'Select Supplier',
        description: 'Please select a supplier first',
        variant: 'destructive',
      });
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
        toast({
          title: '✅ Purchase Bill Created!',
          description: `Invoice ${result.invoice_number} - ₹${totals.totalAmount.toFixed(2)}`,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelInvoice = async (invoiceId: string, type: 'sale' | 'purchase') => {
    if (confirm('Are you sure you want to cancel this invoice? Stock will be adjusted.')) {
      if (type === 'sale') {
        await cancelInvoice(invoiceId);
      } else {
        await cancelPurchaseInvoice(invoiceId);
      }
    }
  };

  const handleProceedToPayment = () => {
    if (billType === 'sale') {
      setShowPayment(true);
    } else {
      if (!selectedSupplier) {
        setShowSupplierSearch(true);
      } else {
        setShowPurchasePayment(true);
      }
    }
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierSearch(false);
    // Open payment dialog after selecting supplier
    setShowPurchasePayment(true);
  };

  return (
    <AppLayout>
      <Tabs defaultValue="new-bill" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
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
          {/* Bill Type Selector */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
            <Button
              variant={billType === 'sale' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setBillType('sale');
                clearCart();
                setSelectedSupplier(null);
              }}
              className="gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Sales Bill (बिक्री)
            </Button>
            <Button
              variant={billType === 'purchase' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setBillType('purchase');
                clearCart();
                setSelectedSupplier(null);
              }}
              className="gap-2"
            >
              <TrendingDown className="w-4 h-4" />
              Purchase Bill (खरीद)
            </Button>
          </div>

          {/* Supplier Selection for Purchase */}
          {billType === 'purchase' && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  {selectedSupplier ? (
                    <div>
                      <p className="font-medium">{selectedSupplier.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedSupplier.phone || selectedSupplier.gstin || 'Supplier'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No supplier selected</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSupplierSearch(true)}
                >
                  {selectedSupplier ? 'Change' : 'Select Supplier'}
                </Button>
              </div>
            </Card>
          )}

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
                <Package className="w-4 h-4" />
                {billType === 'sale' ? 'Cart' : 'Purchase Items'} ({cartItems.length} items)
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
                <p className="text-lg">
                  {billType === 'sale' ? 'Your cart is empty' : 'No items added'}
                </p>
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
                        isPurchase={billType === 'purchase'}
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
                  onClick={handleProceedToPayment}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {billType === 'sale' ? 'Proceed to Payment' : 'Complete Purchase'}
                </Button>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Tabs defaultValue="sales" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sales" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Sales ({salesInvoices.length})
              </TabsTrigger>
              <TabsTrigger value="purchases" className="gap-2">
                <TrendingDown className="w-4 h-4" />
                Purchases ({purchaseInvoices.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <div className="space-y-3">
                {salesInvoices.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-lg text-muted-foreground">No sales invoices yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first sales bill to see it here
                    </p>
                  </Card>
                ) : (
                  <AnimatePresence>
                    {salesInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        onCancel={(id) => handleCancelInvoice(id, 'sale')}
                        onViewDetails={setViewingInvoice}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </TabsContent>

            <TabsContent value="purchases">
              <div className="space-y-3">
                {purchaseInvoices.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <p className="text-lg text-muted-foreground">No purchase invoices yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first purchase bill to see it here
                    </p>
                  </Card>
                ) : (
                  <AnimatePresence>
                    {purchaseInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        onCancel={(id) => handleCancelInvoice(id, 'purchase')}
                        onViewDetails={setViewingInvoice}
                      />
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
      />

      <SupplierSearchDialog
        open={showSupplierSearch}
        onClose={() => setShowSupplierSearch(false)}
        suppliers={suppliers}
        onSelect={handleSelectSupplier}
      />

      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <PaymentDialog
        customers={customers}             
        selectedCustomer={selectedCustomer} 
        onCustomerSelect={setSelectedCustomer}
        open={showPayment}
        onClose={() => setShowPayment(false)}
        totalAmount={totals.totalAmount}
        onConfirm={handleSalesPaymentConfirm}
        isProcessing={isProcessing}
      />

      <PurchasePaymentDialog
        open={showPurchasePayment}
        onClose={() => setShowPurchasePayment(false)}
        totalAmount={totals.totalAmount}
        supplier={selectedSupplier}
        onConfirm={handlePurchasePaymentConfirm}
        isProcessing={isProcessing}
      />

      <InvoiceViewDialog
        open={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        invoice={viewingInvoice}
      />
    </AppLayout>
  );
}