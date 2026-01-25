import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerSearchCombobox } from './CustomerSearchCombobox';
import type { PaymentMethod } from '@/hooks/useBilling';
import type { Customer } from '@/hooks/useCustomers';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  customers: Customer[];
  onConfirm: (
    paymentMethod: PaymentMethod,
    customerName?: string,
    customerPhone?: string,
    customerId?: string,
    amountPaid?: number
  ) => void;
  isProcessing: boolean;
}

const paymentMethods: { method: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { method: 'cash', label: 'Cash', icon: Banknote },
  { method: 'upi', label: 'UPI', icon: Smartphone },
  { method: 'card', label: 'Card', icon: CreditCard },
  { method: 'credit', label: 'Credit', icon: Clock },
];

export function PaymentDialog({
  open,
  onClose,
  totalAmount,
  customers,
  onConfirm,
  isProcessing,
}: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [isPartialPayment, setIsPartialPayment] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMethod('cash');
      setSelectedCustomerId('');
      setSelectedCustomer(null);
      setAmountPaid(totalAmount.toString());
      setIsPartialPayment(false);
    }
  }, [open, totalAmount]);

  const handleCustomerSelect = (customerId: string, customer: Customer | null) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomer(customer);
  };

  // Calculate amounts
  const parsedPaid = parseFloat(amountPaid) || 0;
  const pendingAmount = Math.max(0, totalAmount - parsedPaid);
  const isCredit = selectedMethod === 'credit';
  const hasCredit = isCredit || pendingAmount > 0;
  const creditDisabled = hasCredit && !selectedCustomer;

  // For full credit, amount paid is 0
  const effectivePaid = isCredit ? 0 : parsedPaid;
  const effectivePending = isCredit ? totalAmount : pendingAmount;

  const handleConfirm = () => {
    if (creditDisabled) return;

    // Determine payment method - if partial payment, still use selected method but pass amount
    const method = isCredit ? 'credit' : selectedMethod;
    
    onConfirm(
      method,
      selectedCustomer?.name,
      selectedCustomer?.phone || undefined,
      selectedCustomer?.id,
      isCredit ? 0 : parsedPaid
    );
  };

  const handleAmountChange = (value: string) => {
    setAmountPaid(value);
    const numValue = parseFloat(value) || 0;
    setIsPartialPayment(numValue > 0 && numValue < totalAmount);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[360px] p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4 text-primary" />
            Checkout
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Total - Compact */}
          <div className="text-center py-2 bg-primary/10 rounded-lg">
            <p className="text-2xl font-bold text-primary">₹{totalAmount.toFixed(0)}</p>
          </div>

          {/* Payment Methods - Compact Icons */}
          <div className="grid grid-cols-4 gap-1.5">
            {paymentMethods.map(({ method, label, icon: Icon }) => (
              <motion.button
                key={method}
                type="button"
                onClick={() => setSelectedMethod(method)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors text-xs ${
                  selectedMethod === method
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px]">{label}</span>
              </motion.button>
            ))}
          </div>

          {/* Amount Paid - Only for non-credit */}
          {!isCredit && (
            <div>
              <Label className="text-xs">Amount Paying</Label>
              <div className="relative mt-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="pl-6 h-9"
                />
              </div>
              {pendingAmount > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  ₹{pendingAmount.toFixed(0)} will be added to credit
                </p>
              )}
            </div>
          )}

          {/* Customer - Required for credit/partial */}
          {(hasCredit || true) && (
            <div>
              <Label className="text-xs">
                Customer {hasCredit && <span className="text-destructive">*</span>}
              </Label>
              <div className="mt-1">
                <CustomerSearchCombobox
                  customers={customers}
                  selectedCustomerId={selectedCustomerId}
                  onSelect={handleCustomerSelect}
                />
              </div>
            </div>
          )}

          {/* Credit Summary - Compact */}
          {hasCredit && selectedCustomer && (
            <div className="text-xs bg-orange-50 border border-orange-200 rounded-md p-2 space-y-1 dark:bg-orange-950/20 dark:border-orange-800">
              <div className="flex justify-between">
                <span>Current Due</span>
                <span>₹{selectedCustomer.outstanding_balance.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-orange-700 dark:text-orange-400">
                <span>+ This Bill</span>
                <span>₹{effectivePending.toFixed(0)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-orange-300 dark:border-orange-700 font-semibold">
                <span>New Balance</span>
                <span>₹{(selectedCustomer.outstanding_balance + effectivePending).toFixed(0)}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {creditDisabled && (
            <p className="text-xs text-destructive">
              Credit requires selecting a customer
            </p>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isProcessing || creditDisabled}
          >
            {isProcessing ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
