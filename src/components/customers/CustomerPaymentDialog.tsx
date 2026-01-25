import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Banknote, Smartphone, CreditCard, Wallet } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/hooks/useCustomers';
import type { PaymentMethod } from '@/hooks/useBilling';

interface CustomerPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  // Accept either a full Customer (from useCustomers) or a minimal shape (e.g. from ledger page)
  customer: Pick<Customer, 'id' | 'name' | 'outstanding_balance'>;
  onSuccess: () => void;
}

const paymentMethods: { method: Exclude<PaymentMethod, 'credit'>; label: string; icon: typeof Banknote }[] = [
  { method: 'cash', label: 'Cash', icon: Banknote },
  { method: 'upi', label: 'UPI', icon: Smartphone },
  { method: 'card', label: 'Card', icon: CreditCard },
];

export function CustomerPaymentDialog({
  open,
  onClose,
  customer,
  onSuccess,
}: CustomerPaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<Exclude<PaymentMethod, 'credit'>>('cash');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setAmount('');
      setSelectedMethod('cash');
      setNotes('');
    }
  }, [open]);

  const handleConfirm = async () => {
    const paymentAmount = parseFloat(amount);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid payment amount',
        variant: 'destructive',
      });
      return;
    }

    if (paymentAmount > customer.outstanding_balance) {
      toast({
        title: 'Amount Too High',
        description: 'Payment cannot exceed outstanding balance',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc('record_customer_payment', {
        p_customer_id: customer.id,
        p_amount: paymentAmount,
        p_payment_method: selectedMethod,
        p_notes: notes || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      toast({
        title: 'Payment Received',
        description: `₹${paymentAmount.toFixed(2)} payment recorded for ${customer.name}`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Failed',
        description: error.message || 'Could not record payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const balanceAfter = customer.outstanding_balance - (parseFloat(amount) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Receive Payment
          </DialogTitle>
          <DialogDescription>
            {customer.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Balance */}
          <div className="text-center py-3 bg-destructive/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            <p className="text-2xl font-bold text-destructive">
              ₹{customer.outstanding_balance.toFixed(2)}
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <Label>Payment Amount</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setAmount(customer.outstanding_balance.toString())}
              >
                Full Amount
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setAmount((customer.outstanding_balance / 2).toFixed(2))}
              >
                Half
              </Button>
            </div>
          </div>

          {/* Balance After */}
          {parseFloat(amount) > 0 && (
            <div className="text-sm bg-muted/50 rounded-md p-2 flex justify-between">
              <span className="text-muted-foreground">Balance After</span>
              <span className={balanceAfter <= 0 ? 'text-green-600 font-medium' : 'font-medium'}>
                ₹{Math.max(0, balanceAfter).toFixed(2)}
              </span>
            </div>
          )}

          {/* Payment Method */}
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map(({ method, label, icon: Icon }) => (
              <motion.button
                key={method}
                type="button"
                onClick={() => setSelectedMethod(method)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors text-xs ${
                  selectedMethod === method
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-5 h-5" />
                {label}
              </motion.button>
            ))}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment reference..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !amount}>
            {isProcessing ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
