import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Banknote, Smartphone, Clock, Receipt, CheckCircle2 } from 'lucide-react';
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

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (paymentMethod: PaymentMethod, customerName?: string, customerPhone?: string) => void;
  isProcessing: boolean;
}

const paymentMethods: { method: PaymentMethod; label: string; icon: typeof CreditCard; color: string }[] = [
  { method: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-600' },
  { method: 'upi', label: 'UPI', icon: Smartphone, color: 'text-purple-600' },
  { method: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600' },
  { method: 'credit', label: 'Credit', icon: Clock, color: 'text-orange-600' },
];

export function PaymentDialog({
  open,
  onClose,
  totalAmount,
  onConfirm,
  isProcessing,
}: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const handleConfirm = () => {
    onConfirm(
      selectedMethod,
      customerName || undefined,
      customerPhone || undefined
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Complete Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total Amount */}
          <div className="text-center py-4 bg-primary/10 rounded-xl">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-3xl font-bold text-primary">₹{totalAmount.toFixed(2)}</p>
          </div>

          {/* Customer Info (Optional) */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="customerName">Customer Name (Optional)</Label>
              <Input
                id="customerName"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="customerPhone">Phone (Optional)</Label>
              <Input
                id="customerPhone"
                placeholder="Enter phone number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                type="tel"
              />
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map(({ method, label, icon: Icon, color }) => (
                <motion.button
                  key={method}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedMethod(method)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    selectedMethod === method
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${color}`} />
                  <span className="font-medium">{label}</span>
                  {selectedMethod === method && (
                    <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"
                />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
