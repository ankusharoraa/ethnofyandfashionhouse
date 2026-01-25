import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Banknote, CreditCard, Smartphone, Undo2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/hooks/useCustomers';
import type { PaymentMethod } from '@/hooks/useBilling';

interface CustomerAdvanceRefundDialogProps {
  open: boolean;
  onClose: () => void;
  customer: Pick<Customer, 'id' | 'name' | 'advance_balance'>;
  onSuccess: () => void;
}

const refundMethods: { method: Exclude<PaymentMethod, 'credit'>; label: string; icon: typeof Banknote }[] = [
  { method: 'cash', label: 'Cash', icon: Banknote },
  { method: 'upi', label: 'UPI', icon: Smartphone },
  { method: 'card', label: 'Card', icon: CreditCard },
];

export function CustomerAdvanceRefundDialog({
  open,
  onClose,
  customer,
  onSuccess,
}: CustomerAdvanceRefundDialogProps) {
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
    const refundAmount = parseFloat(amount);

    if (isNaN(refundAmount) || refundAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid refund amount',
        variant: 'destructive',
      });
      return;
    }

    if (refundAmount > Number(customer.advance_balance || 0)) {
      toast({
        title: 'Amount Too High',
        description: 'Refund cannot exceed advance balance',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('refund_customer_advance', {
        p_customer_id: customer.id,
        p_amount: refundAmount,
        p_refund_method: selectedMethod,
        p_notes: notes || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'Refund failed');

      toast({
        title: 'Advance Refunded',
        description: `₹${refundAmount.toFixed(2)} refunded for ${customer.name}`,
      });

      onSuccess();
      onClose();
    } catch (e: any) {
      console.error('Advance refund error:', e);
      toast({
        title: 'Refund Failed',
        description: e.message || 'Could not refund advance',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const after = Number(customer.advance_balance || 0) - (parseFloat(amount) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-primary" />
            Refund Advance
          </DialogTitle>
          <DialogDescription>{customer.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center py-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Advance Balance</p>
            <p className="text-2xl font-bold">₹{Number(customer.advance_balance || 0).toFixed(2)}</p>
          </div>

          <div>
            <Label>Refund Amount</Label>
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
                onClick={() => setAmount(String(customer.advance_balance || 0))}
              >
                Full Advance
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setAmount((Number(customer.advance_balance || 0) / 2).toFixed(2))}
              >
                Half
              </Button>
            </div>
          </div>

          {parseFloat(amount) > 0 && (
            <div className="text-sm bg-muted/50 rounded-md p-2 flex justify-between">
              <span className="text-muted-foreground">Advance After</span>
              <span className="font-medium">₹{Math.max(0, after).toFixed(2)}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {refundMethods.map(({ method, label, icon: Icon }) => (
              <motion.button
                key={method}
                type="button"
                onClick={() => setSelectedMethod(method)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors text-xs ${
                  selectedMethod === method ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-5 h-5" />
                {label}
              </motion.button>
            ))}
          </div>

          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Refund reference..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !amount}>
            {isProcessing ? 'Processing...' : 'Confirm Refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
