import { useState, useEffect } from 'react';
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
  DialogDescription,
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
    customerId?: string
  ) => void;
  isProcessing: boolean;
}

const paymentMethods: { method: PaymentMethod; label: string; icon: typeof Banknote; color: string }[] = [
  { method: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-600' },
  { method: 'upi', label: 'UPI', icon: Smartphone, color: 'text-purple-600' },
  { method: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600' },
  { method: 'credit', label: 'Credit', icon: Clock, color: 'text-orange-600' },
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
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMethod('cash');
      setSelectedCustomerId('');
      setSelectedCustomer(null);
      setCustomerName('');
      setCustomerPhone('');
    }
  }, [open]);

  const handleCustomerSelect = (customerId: string, customer: Customer | null) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomer(customer);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone || '');
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  const isCredit = selectedMethod === 'credit';
  const creditDisabled = isCredit && !selectedCustomer;

  const handleConfirm = () => {
    if (creditDisabled) return;

    onConfirm(
      selectedMethod,
      customerName || selectedCustomer?.name,
      customerPhone || selectedCustomer?.phone || undefined,
      selectedCustomer?.id
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Complete Payment
          </DialogTitle>
          <DialogDescription>
            Select payment method and customer details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total */}
          <div className="text-center py-4 bg-primary/10 rounded-xl">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-3xl font-bold text-primary">
              ₹{totalAmount.toFixed(2)}
            </p>
          </div>

          {/* Customer Search Combobox */}
          <div className="space-y-2">
            <Label>Select Customer</Label>
            <CustomerSearchCombobox
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              onSelect={handleCustomerSelect}
            />
          </div>

          {/* Credit info */}
          {isCredit && selectedCustomer && (
            <div className="text-sm bg-orange-50 border border-orange-200 rounded-md p-3 space-y-2 dark:bg-orange-950/20 dark:border-orange-800">
              <div className="flex justify-between">
                <span>Current Outstanding</span>
                <span className="font-semibold">
                  ₹{selectedCustomer.outstanding_balance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-orange-700 dark:text-orange-400">
                <span>New Pending (This Bill)</span>
                <span className="font-semibold">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-orange-300 dark:border-orange-700 font-bold text-orange-800 dark:text-orange-300">
                <span>Total After This Bill</span>
                <span>
                  ₹{(selectedCustomer.outstanding_balance + totalAmount).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Customer fields */}
          <div className="space-y-3">
            <div>
              <Label>Customer Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter name or select above"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="grid grid-cols-2 gap-3">
            {paymentMethods.map(({ method, label, icon: Icon, color }) => (
              <motion.button
                key={method}
                type="button"
                onClick={() => setSelectedMethod(method)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                  selectedMethod === method
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className={`w-5 h-5 ${color}`} />
                {label}
                {selectedMethod === method && (
                  <CheckCircle2 className="w-4 h-4 ml-auto text-primary" />
                )}
              </motion.button>
            ))}
          </div>

          {creditDisabled && (
            <p className="text-sm text-destructive">
              Credit is allowed only for existing customers. Please select a customer above.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || creditDisabled}
          >
            {isProcessing ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
