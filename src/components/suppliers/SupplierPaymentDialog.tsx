import { useState } from 'react';
import { IndianRupee, Banknote, CreditCard, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Supplier } from '@/hooks/useSuppliers';
import type { PaymentMethod } from '@/hooks/useBilling';

interface SupplierPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onConfirm: (amount: number, method: PaymentMethod, notes?: string) => Promise<void>;
  isProcessing?: boolean;
}

const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <Banknote className="w-5 h-5" /> },
  { value: 'upi', label: 'UPI', icon: <Smartphone className="w-5 h-5" /> },
  { value: 'card', label: 'Card', icon: <CreditCard className="w-5 h-5" /> },
];

export function SupplierPaymentDialog({
  open,
  onClose,
  supplier,
  onConfirm,
  isProcessing,
}: SupplierPaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) return;
    
    await onConfirm(paymentAmount, method, notes || undefined);
    setAmount('');
    setNotes('');
    setMethod('cash');
  };

  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="w-5 h-5" />
            Pay to {supplier.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-destructive/10 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Outstanding Balance</p>
            <p className="text-2xl font-bold text-destructive">
              ₹{supplier.outstanding_balance.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount *</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="pl-10 text-lg"
                min="0"
                step="0.01"
                max={supplier.outstanding_balance}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount(supplier.outstanding_balance.toString())}
              >
                Full Amount
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount((supplier.outstanding_balance / 2).toFixed(2))}
              >
                Half
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((pm) => (
                <Button
                  key={pm.value}
                  type="button"
                  variant={method === pm.value ? 'default' : 'outline'}
                  className={cn(
                    'flex flex-col items-center gap-1 h-auto py-3',
                    method === pm.value && 'ring-2 ring-primary'
                  )}
                  onClick={() => setMethod(pm.value)}
                >
                  {pm.icon}
                  <span className="text-xs">{pm.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment notes..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isProcessing || !amount || parseFloat(amount) <= 0}
            >
              {isProcessing ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
