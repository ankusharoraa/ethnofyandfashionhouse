import { useMemo, useState } from 'react';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type RefundMethod = 'cash' | 'upi' | 'card';

const schema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['cash', 'upi', 'card']),
  notes: z.string().max(200).optional(),
});

interface ReturnRefundDialogProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  amount: number;
  defaultNotes: string;
  onRefunded: () => void;
}

export function ReturnRefundDialog({
  open,
  onClose,
  customerId,
  amount,
  defaultNotes,
  onRefunded,
}: ReturnRefundDialogProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [method, setMethod] = useState<RefundMethod>('cash');
  const [notes, setNotes] = useState(defaultNotes);

  const amountFixed = useMemo(() => Number(amount || 0), [amount]);

  const handleConfirm = async () => {
    const parsed = schema.safeParse({
      customerId,
      amount: amountFixed,
      method,
      notes: notes?.trim() ? notes.trim() : undefined,
    });

    if (!parsed.success) {
      toast({
        title: 'Error',
        description: 'Invalid refund details',
        variant: 'destructive',
      });
      return;
    }

    // Note: Advance refund functionality not yet implemented
    toast({
      title: 'Feature Not Available',
      description: 'Advance refunds are not yet implemented',
      variant: 'destructive',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Refund excess amount</DialogTitle>
          <DialogDescription>
            This return created extra credit. Choose how you refunded it to the customer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm text-muted-foreground">Refund amount</span>
            <span className="text-base font-semibold">₹{amountFixed.toFixed(0)}</span>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Refund method</Label>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as RefundMethod)} className="grid grid-cols-3 gap-2">
              <Label className="flex items-center gap-2 rounded-md border border-border p-2 text-sm cursor-pointer">
                <RadioGroupItem value="cash" /> Cash
              </Label>
              <Label className="flex items-center gap-2 rounded-md border border-border p-2 text-sm cursor-pointer">
                <RadioGroupItem value="upi" /> UPI
              </Label>
              <Label className="flex items-center gap-2 rounded-md border border-border p-2 text-sm cursor-pointer">
                <RadioGroupItem value="card" /> Card
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="h-20 resize-none" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Skip
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? 'Processing…' : 'Confirm refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
