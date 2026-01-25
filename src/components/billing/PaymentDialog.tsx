import { useState } from 'react';
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
import type { PaymentMethod } from '@/hooks/useBilling';
import type { Customer } from '@/hooks/useCustomers';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  customers: Customer[]; // ✅ passed in, NO fetching here
  onConfirm: (
    paymentMethod: PaymentMethod,
    customerName?: string,
    customerPhone?: string,
    customerId?: string
  ) => void;
  isProcessing: boolean;
}

const paymentMethods = [
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
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

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
        </DialogHeader>

        <div className="space-y-6">
          {/* Total */}
          <div className="text-center py-4 bg-primary/10 rounded-xl">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-3xl font-bold text-primary">
              ₹{totalAmount.toFixed(2)}
            </p>
          </div>

          {/* Customer Dropdown */}
          <div>
            <Label>Select Customer</Label>
            <select
              className="w-full border rounded-md p-2 mt-1"
              value={selectedCustomerId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedCustomerId(id);
                const c = customers.find(x => x.id === id);
                setCustomerName(c?.name || '');
                setCustomerPhone(c?.phone || '');
              }}
            >
              <option value="">Walk-in Customer</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Credit info */}
          {isCredit && selectedCustomer && (
            <div className="text-sm bg-orange-50 border border-orange-200 rounded-md p-3">
              <div className="flex justify-between">
                <span>Current Pending</span>
                <span className="font-semibold">
                  ₹{selectedCustomer.outstanding_balance.toFixed(2)}
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
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
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
                className={`flex items-center gap-3 p-4 rounded-xl border-2 ${
                  selectedMethod === method
                    ? 'border-primary'
                    : 'border-border'
                }`}
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
              Credit is allowed only for existing customers.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || creditDisabled}
          >
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
