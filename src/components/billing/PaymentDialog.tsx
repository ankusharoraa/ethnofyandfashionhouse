import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  Receipt,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomerSearchCombobox } from './CustomerSearchCombobox';
import { PaymentBreakdown } from '@/components/billing/PaymentBreakdown';
import type { PaymentMethod } from '@/hooks/useBilling';
import type { Customer } from '@/hooks/useCustomers';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  customers: Customer[];
  mode?: 'sale' | 'purchase';
  onConfirm: (args: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    cash: number;
    upi: number;
    card: number;
    advanceUsed: number;
    credit: number;
    confirmOverpay: boolean;
  }) => void;
  isProcessing: boolean;
}

export function PaymentDialog({
  open,
  onClose,
  totalAmount,
  customers,
  mode,
  onConfirm,
  isProcessing,
}: PaymentDialogProps) {
  const isSale = mode === 'sale';
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [upiAmount, setUpiAmount] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [advanceUsed, setAdvanceUsed] = useState<string>('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCustomerId('');
      setSelectedCustomer(null);
      const full = totalAmount.toString();
      setCashAmount(full);
      setUpiAmount('');
      setCardAmount('');
      setCreditAmount('');
      setAdvanceUsed('');
    }
  }, [open, totalAmount]);

  const handleCustomerSelect = (customerId: string, customer: Customer | null) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomer(customer);
  };

  const customerAdvance = (selectedCustomer as any)?.advance_balance ?? 0;
  const canUseAdvance = !isSale && !!selectedCustomer && customerAdvance > 0;

  const cash = parseFloat(cashAmount) || 0;
  const upi = parseFloat(upiAmount) || 0;
  const card = parseFloat(cardAmount) || 0;
  const credit = parseFloat(creditAmount) || 0;
  const advUsed = parseFloat(advanceUsed) || 0;

  const basePaid = cash + upi + card;
  const remainingBeforeAdvance = Math.max(0, totalAmount - basePaid);
  const autoAdvanceUsed = isSale
    ? Math.min(Math.max(0, customerAdvance), remainingBeforeAdvance)
    : 0;

  const effectiveAdvanceUsed = isSale ? autoAdvanceUsed : advUsed;

  const moneyTotal = basePaid + effectiveAdvanceUsed;
  const allocTotal = moneyTotal + credit;
  const remainingPayable = Math.max(0, totalAmount - allocTotal);
  const overpay = Math.max(0, moneyTotal - totalAmount);

  const creditDisabled = (credit > 0 || remainingPayable > 0) && !selectedCustomer;
  const overpayDisabled = overpay > 0 && !selectedCustomer;

  const walkInPartialDisabled = !selectedCustomer && remainingPayable > 0;

  const effectiveCredit = useMemo(() => {
    if (!selectedCustomer) return credit;
    // Backend auto-credits any remaining payable for customers.
    return Math.max(credit, remainingPayable);
  }, [credit, remainingPayable, selectedCustomer]);

  const existingDue = selectedCustomer?.outstanding_balance ?? 0;
  const existingAdvance = customerAdvance;
  const displayExistingDue = Math.round(existingDue);
  const displayExistingAdvance = Math.max(0, Math.round(existingAdvance));
  const dueFromThisBill = selectedCustomer ? Math.max(0, effectiveCredit) : 0;
  const newDueAfterBill = existingDue + dueFromThisBill;
  const advanceUsedOnThisBill = isSale ? effectiveAdvanceUsed : (canUseAdvance ? advUsed : 0);
  const overpayToAdvance = isSale ? overpay : 0;
  const newAdvanceAfterBill = existingAdvance - advanceUsedOnThisBill + overpayToAdvance;

  const handleConfirm = () => {
    if (creditDisabled || overpayDisabled || walkInPartialDisabled) return;
    const confirmOverpay = overpay > 0 ? window.confirm(`Extra ₹${overpay.toFixed(0)} will be added to customer advance. Continue?`) : true;
    if (!confirmOverpay) return;

    onConfirm({
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone || undefined,
      cash,
      upi,
      card,
      advanceUsed: effectiveAdvanceUsed,
      credit: effectiveCredit,
      confirmOverpay,
    });
  };

  const handleUseMaxAdvance = () => {
    if (!canUseAdvance) return;
    const base = cash + upi + card + credit;
    const remainingBeforeAdvance = Math.max(0, totalAmount - base);
    const toUse = Math.min(customerAdvance, remainingBeforeAdvance);
    setAdvanceUsed(toUse > 0 ? toUse.toString() : '');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-xl p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4 text-primary" />
            Checkout
          </DialogTitle>
          <DialogDescription className="sr-only">
            Complete payment for your purchase
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] px-4">
          <div className="space-y-3 pb-4">
          {/* Customer Balance Info - Show before bill */}
          {selectedCustomer && (
            <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{selectedCustomer.name}</span>
              </div>
               {displayExistingDue > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Existing Due</span>
                   <span className="font-semibold">₹{displayExistingDue}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Advance balance</span>
                <span className="font-semibold">₹{displayExistingAdvance}</span>
              </div>
            </div>
          )}

          {/* Total - Compact */}
          <div className="text-center py-2 bg-primary/10 rounded-lg">
            <p className="text-2xl font-bold text-primary">₹{totalAmount.toFixed(0)}</p>
          </div>

          <PaymentBreakdown
            billTotal={totalAmount}
            customerAdvance={customerAdvance}
            amountPaid={basePaid}
            advanceUsed={effectiveAdvanceUsed}
            showCustomerAdvance={!!selectedCustomer}
            advanceLabel={isSale ? 'Advance auto-applied' : 'Advance used'}
          />

          {selectedCustomer && (
            <div className="bg-muted/60 rounded-md p-2 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Existing due</span>
                <span>₹{displayExistingDue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due from this bill</span>
                <span>₹{Math.round(dueFromThisBill)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total due after this bill</span>
                <span>₹{Math.round(newDueAfterBill)}</span>
              </div>

              <div className="h-px bg-border my-1" />

              <div className="flex justify-between">
                <span className="text-muted-foreground">Existing advance</span>
                <span>₹{displayExistingAdvance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Advance used on this bill</span>
                <span>-₹{advanceUsedOnThisBill.toFixed(0)}</span>
              </div>
              {overpayToAdvance > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extra added to advance</span>
                  <span>+₹{overpayToAdvance.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Advance after this bill</span>
                <span>₹{newAdvanceAfterBill.toFixed(0)}</span>
              </div>
            </div>
          )}

          {/* Split payment fields */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs flex items-center gap-1"><Banknote className="w-3 h-3" /> Cash</Label>
                <Input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="mt-1 h-8 text-sm"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Smartphone className="w-3 h-3" /> UPI</Label>
                <Input
                  type="number"
                  value={upiAmount}
                  onChange={(e) => setUpiAmount(e.target.value)}
                  className="mt-1 h-8 text-sm"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><CreditCard className="w-3 h-3" /> Card</Label>
                <Input
                  type="number"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(e.target.value)}
                  className="mt-1 h-8 text-sm"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Credit</Label>
                <Input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="mt-1 h-8 text-sm"
                  min={0}
                  disabled={!selectedCustomer}
                />
                {!selectedCustomer && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Select customer to use credit</p>
                )}
              </div>
            </div>

            {!isSale && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col flex-1">
                  <Label className="text-xs">Advance Used</Label>
                  <Input
                    type="number"
                    value={advanceUsed}
                    onChange={(e) => setAdvanceUsed(e.target.value)}
                    className="mt-1 h-8 text-sm"
                    min={0}
                    disabled={!canUseAdvance}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-5 h-7 px-2 text-xs"
                  disabled={!canUseAdvance}
                  onClick={handleUseMaxAdvance}
                >
                  Use max
                </Button>
              </div>
              {canUseAdvance && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Available advance: ₹{customerAdvance.toFixed(0)}
                </p>
              )}
            </div>
            )}

            <div className="text-xs bg-muted/50 rounded-md p-2 space-y-1">
              <div className="flex justify-between">
                <span>Total entered</span>
                <span className="font-medium">₹{allocTotal.toFixed(0)}</span>
              </div>

              {isSale && effectiveAdvanceUsed > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Advance auto-applied</span>
                  <span>₹{effectiveAdvanceUsed.toFixed(0)}</span>
                </div>
              )}

              {remainingPayable > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Remaining payable</span>
                  <span>₹{remainingPayable.toFixed(0)}</span>
                </div>
              )}
              {selectedCustomer && remainingPayable > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Will become credit</span>
                  <span>₹{remainingPayable.toFixed(0)}</span>
                </div>
              )}
              {overpay > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Overpayment → advance</span>
                  <span>₹{overpay.toFixed(0)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer selection (required for credit / advance / overpay) */}
          <div>
            <div>
              <Label className="text-xs">
                Customer
              </Label>
              <div className="mt-1">
                <CustomerSearchCombobox
                  customers={customers}
                  selectedCustomerId={selectedCustomerId}
                  onSelect={handleCustomerSelect}
                />
              </div>
            </div>
          </div>

          {/* Credit Summary - Compact */}
          {selectedCustomer && (credit > 0 || remainingPayable > 0) && (
            <div className="text-xs bg-orange-50 border border-orange-200 rounded-md p-2 space-y-1 dark:bg-orange-950/20 dark:border-orange-800">
              <div className="flex justify-between">
                <span>Current Due</span>
                <span>₹{selectedCustomer.outstanding_balance.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-orange-700 dark:text-orange-400">
                <span>+ This Bill</span>
                <span>₹{Math.max(0, effectiveCredit).toFixed(0)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-orange-300 dark:border-orange-700 font-semibold">
                <span>New Balance</span>
                <span>₹{(selectedCustomer.outstanding_balance + Math.max(0, effectiveCredit)).toFixed(0)}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {creditDisabled && (
            <p className="text-xs text-destructive">
              Credit requires selecting a customer
            </p>
          )}

          {overpayDisabled && (
            <p className="text-xs text-destructive">
              Overpayment requires selecting a customer
            </p>
          )}

          {walkInPartialDisabled && (
            <p className="text-xs text-destructive">
              Walk-in customers must pay the full amount (no credit).
            </p>
          )}
        </div>

        </ScrollArea>

        <DialogFooter className="px-4 pb-4 pt-2 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isProcessing || creditDisabled || overpayDisabled || walkInPartialDisabled}
          >
            {isProcessing ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
