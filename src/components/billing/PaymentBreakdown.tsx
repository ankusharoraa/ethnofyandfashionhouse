import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface PaymentBreakdownProps {
  billTotal: number;
  customerAdvance: number;
  /** Amount entered via cash/upi/card (exclude advance/credit). */
  amountPaid: number;
  /** Explicit advance used (manual or auto) */
  advanceUsed: number;
  showCustomerAdvance: boolean;
  advanceLabel?: string;
}

export function PaymentBreakdown({
  billTotal,
  customerAdvance,
  amountPaid,
  advanceUsed: advanceUsedProp,
  showCustomerAdvance,
  advanceLabel,
}: PaymentBreakdownProps) {
  const advanceAvailable = Math.max(0, customerAdvance);
  const advanceUsed = showCustomerAdvance
    ? Math.min(advanceAvailable, Math.max(0, advanceUsedProp))
    : 0;
  const remainingPayable = Math.max(0, billTotal - advanceUsed);
  const remainingAdvance = showCustomerAdvance
    ? Math.max(0, advanceAvailable - advanceUsed)
    : 0;

  const pendingAfterPayment = Math.max(
    0,
    remainingPayable - Math.max(0, amountPaid),
  );

  return (
    <Card className="p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Bill amount</span>
        <span className="text-sm font-semibold">₹{billTotal.toFixed(0)}</span>
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground">
          {advanceLabel ?? 'Advance used'}
        </span>
        <span className="text-sm font-semibold">₹{advanceUsed.toFixed(0)}</span>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">Remaining payable</span>
        <span className="text-sm font-semibold">₹{remainingPayable.toFixed(0)}</span>
      </div>

      {showCustomerAdvance && remainingAdvance > 0 && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">Remaining advance</span>
          <Badge variant="secondary" className="text-xs">
            Advance ₹{remainingAdvance.toFixed(0)}
          </Badge>
        </div>
      )}

      {pendingAfterPayment > 0 && (
        <div className="mt-2">
          <Badge variant="destructive" className="text-xs">
            Due ₹{pendingAfterPayment.toFixed(0)}
          </Badge>
        </div>
      )}
    </Card>
  );
}
