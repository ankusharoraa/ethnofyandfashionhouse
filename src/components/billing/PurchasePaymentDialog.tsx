import { useState } from 'react';
import { Banknote, Smartphone, CreditCard, Clock, Building2 } from 'lucide-react';
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
import type { Supplier } from '@/hooks/useSuppliers';

interface PurchasePaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  supplier: Supplier | null;
  onConfirm: (paymentMethod: PaymentMethod, amountPaid: number) => void;
  isProcessing?: boolean;
}

const paymentMethods: { id: PaymentMethod; label: string; labelHindi: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', labelHindi: 'नकद', icon: Banknote },
  { id: 'upi', label: 'UPI', labelHindi: 'यूपीआई', icon: Smartphone },
  { id: 'card', label: 'Card', labelHindi: 'कार्ड', icon: CreditCard },
  { id: 'credit', label: 'Credit', labelHindi: 'उधार', icon: Clock },
];

export function PurchasePaymentDialog({
  open,
  onClose,
  totalAmount,
  supplier,
  onConfirm,
  isProcessing,
}: PurchasePaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState(totalAmount.toString());

  const handleConfirm = () => {
    const paid = parseFloat(amountPaid) || 0;
    onConfirm(paymentMethod, paid);
  };

  const paidAmount = parseFloat(amountPaid) || 0;
  const pendingAmount = totalAmount - paidAmount;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Purchase Bill</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Supplier Info */}
          {supplier && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Building2 className="w-4 h-4" />
                Supplier
              </div>
              <p className="font-medium">{supplier.name}</p>
              {supplier.phone && (
                <p className="text-sm text-muted-foreground">{supplier.phone}</p>
              )}
            </div>
          )}

          {/* Total Amount */}
          <div className="text-center p-4 rounded-lg bg-primary/10">
            <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
            <p className="text-3xl font-bold text-primary">₹{totalAmount.toFixed(2)}</p>
          </div>

          {/* Payment Method */}
          <div>
            <Label className="mb-2 block">Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(({ id, label, labelHindi, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`p-3 rounded-lg border-2 transition-all ${
                    paymentMethod === id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setPaymentMethod(id)}
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${
                    paymentMethod === id ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{labelHindi}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Amount Paid */}
          <div>
            <Label htmlFor="amountPaid">Amount Paid (भुगतान राशि)</Label>
            <Input
              id="amountPaid"
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Summary */}
          <div className="p-3 rounded-lg border space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span>₹{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="text-green-600">₹{paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Pending Amount</span>
              <span className={pendingAmount > 0 ? 'text-destructive' : 'text-green-600'}>
                ₹{pendingAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Complete Purchase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}