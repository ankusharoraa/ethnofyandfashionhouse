import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { FileText, ArrowUpRight, ArrowDownLeft, Loader2, Undo2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Customer } from '@/hooks/useCustomers';

interface LedgerEntry {
  id: string;
  date: string;
  type: 'sale' | 'return' | 'payment';
  reference: string;
  debit: number;
  credit: number;
  balance: number; // outstanding due running balance (never negative)
  advance_balance: number; // running advance balance
  invoice_id?: string | null;
  payment_received?: number;
  applied_to_due?: number;
  advance_created?: number;
  split_payments?: Array<{ method: string; amount: number }>;
}

interface CustomerLedgerDialogProps {
  open: boolean;
  onClose: () => void;
  customer: Customer;
}

export function CustomerLedgerDialog({
  open,
  onClose,
  customer,
}: CustomerLedgerDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [balances, setBalances] = useState<{ outstanding: number; advance: number } | null>(null);
  const [invoicePaymentsByInvoiceId, setInvoicePaymentsByInvoiceId] = useState<
    Record<string, Array<{ method: string; amount: number }>>
  >({});

  useEffect(() => {
    if (open && customer) {
      fetchLedgerData();
    }
  }, [open, customer]);

  const fetchLedgerData = async () => {
    setIsLoading(true);
    try {
      // Fetch latest balances (customer prop may not include advance_balance)
      const { data: customerRow, error: customerErr } = await supabase
        .from('customers')
        .select('outstanding_balance')
        .eq('id', customer.id)
        .maybeSingle();

      if (customerErr) {
        console.error('Error fetching customer balances:', customerErr);
      }

      if (customerRow) {
        setBalances({
          outstanding: Number(customerRow.outstanding_balance ?? customer.outstanding_balance ?? 0),
          advance: 0, // Advance payments not yet implemented
        });
      } else {
        setBalances({
          outstanding: Number(customer.outstanding_balance ?? 0),
          advance: 0,
        });
      }

      // Fetch all invoices for this customer (sales and returns)
       const { data: invoiceData } = await supabase
        .from('invoices')
         .select('id, invoice_number, invoice_type, created_at, total_amount, pending_amount, status')
        .eq('customer_id', customer.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      // Fetch payments for this customer
      const { data: paymentData } = await supabase
        .from('customer_payments')
        .select('id, payment_date, amount, payment_method, notes, invoice_id')
        .eq('customer_id', customer.id)
        .order('payment_date', { ascending: true });

      // Fetch split payment breakdowns (cash/upi/card rows) for completed invoices
      const invoiceIds = (invoiceData || []).map((inv) => inv.id).filter(Boolean);
      if (invoiceIds.length > 0) {
        const { data: invoicePayments } = await supabase
          .from('invoice_payments')
          .select('invoice_id, amount, payment_method')
          .in('invoice_id', invoiceIds);

        const grouped: Record<string, Array<{ method: string; amount: number }>> = {};
        (invoicePayments || []).forEach((row: any) => {
          const invoiceId = row.invoice_id as string | null;
          if (!invoiceId) return;
          (grouped[invoiceId] ||= []).push({
            method: String(row.payment_method ?? 'payment'),
            amount: Number(row.amount ?? 0),
          });
        });
        setInvoicePaymentsByInvoiceId(grouped);
      } else {
        setInvoicePaymentsByInvoiceId({});
      }

      setInvoices(invoiceData || []);
      setPayments(paymentData || []);
    } catch (error) {
      console.error('Error fetching ledger:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const ledgerEntries = useMemo(() => {
    const entries: LedgerEntry[] = [];

    // Add invoices (sales = debit, returns = credit)
     invoices.forEach((inv) => {
      if (inv.invoice_type === 'sale') {
        entries.push({
          id: inv.id,
          date: inv.created_at,
          type: 'sale',
          reference: inv.invoice_number,
            // Use total_amount as debit to show the full obligation created by this sale
            debit: Number(inv.total_amount || 0),
          credit: 0,
          balance: 0,
          advance_balance: 0,
        });
      } else if (inv.invoice_type === 'return') {
        // Returns reduce outstanding balance
        entries.push({
          id: inv.id,
          date: inv.created_at,
          type: 'return',
          reference: inv.invoice_number,
          debit: 0,
          credit: Math.abs(inv.total_amount), // Return amounts are stored as negative
          balance: 0,
          advance_balance: 0,
        });
      }
    });

    // Add payments (credits - customer paid us)
    payments.forEach((pmt) => {
      const invoiceId = pmt.invoice_id ?? null;
      const split = invoiceId ? invoicePaymentsByInvoiceId[invoiceId] : undefined;
      entries.push({
        id: pmt.id,
        date: pmt.payment_date,
        type: 'payment',
        reference:
          pmt.notes || `${String(pmt.payment_method ?? 'payment').toUpperCase()} Payment`,
        debit: 0,
        credit: pmt.amount,
        balance: 0,
        advance_balance: 0,
        invoice_id: invoiceId,
        payment_received: pmt.amount,
        split_payments: split,
      });
    });

    // Sort by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balances:
    // - balance: outstanding due (clamped to >= 0)
    // - advance_balance: customer advance/credit held by shop (>= 0)
    let due = 0;
    let advance = 0;
    entries.forEach((entry) => {
      if (entry.type === 'sale') {
        // Pending amount increases due
        due += entry.debit;
      } else if (entry.type === 'return') {
        const credit = entry.credit;
        const applied = Math.min(credit, due);
        const toAdvance = Math.max(0, credit - applied);
        due -= applied;
        advance += toAdvance;
      } else if (entry.type === 'payment') {
        const paid = entry.credit;
        const applied = Math.min(paid, due);
        const toAdvance = Math.max(0, paid - applied);
        due -= applied;
        advance += toAdvance;

        entry.applied_to_due = applied;
        entry.advance_created = toAdvance;
      }

      entry.balance = Math.max(0, due);
      entry.advance_balance = Math.max(0, advance);
    });

    return entries;
  }, [invoices, payments, invoicePaymentsByInvoiceId]);

  const totalDebits = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);

  const getEntryIcon = (type: LedgerEntry['type']) => {
    switch (type) {
      case 'sale':
        return <ArrowUpRight className="w-4 h-4" />;
      case 'return':
        return <Undo2 className="w-4 h-4" />;
      case 'payment':
        return <ArrowDownLeft className="w-4 h-4" />;
    }
  };

  const getEntryStyle = (type: LedgerEntry['type']) => {
    switch (type) {
      case 'sale':
        return 'bg-muted text-foreground';
      case 'return':
        return 'bg-muted text-foreground';
      case 'payment':
        return 'bg-muted text-foreground';
    }
  };

  const getTypeLabel = (type: LedgerEntry['type']) => {
    switch (type) {
      case 'sale':
        return 'Sale';
      case 'return':
        return 'Return';
      case 'payment':
        return 'Payment';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Customer Ledger
          </DialogTitle>
          <DialogDescription>
            {customer.name} • Outstanding: ₹{(balances?.outstanding ?? customer.outstanding_balance).toFixed(2)} • Advance Balance: ₹{(balances?.advance ?? 0).toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No transactions found</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] -mx-6 px-6">
            <div className="space-y-2">
              {ledgerEntries.map((entry) => (
                <div
                  key={`${entry.type}-${entry.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  {/* Icon */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${getEntryStyle(entry.type)}`}
                  >
                    {getEntryIcon(entry.type)}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{entry.reference}</p>
                      <Badge variant="outline" className="text-xs">
                        {getTypeLabel(entry.type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.date), 'dd MMM yyyy, hh:mm a')}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    {entry.debit > 0 && (
                      <p className="text-sm font-medium">+₹{entry.debit.toFixed(0)}</p>
                    )}
                    {entry.credit > 0 && (
                      <p className="text-sm font-medium">-₹{entry.credit.toFixed(0)}</p>
                    )}

                    {/* Payment split */}
                    {entry.type === 'payment' && (
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {Array.isArray(entry.split_payments) && entry.split_payments.length > 0 && (
                          <div className="space-y-0.5">
                            {entry.split_payments
                              .filter((sp) => Number(sp.amount) > 0)
                              .map((sp, idx) => (
                                <div key={`${entry.id}-sp-${idx}`} className="flex justify-between gap-2">
                                  <span>{sp.method.toUpperCase()}</span>
                                  <span>₹{Number(sp.amount).toFixed(0)}</span>
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="flex justify-between gap-2">
                          <span>Payment Received</span>
                          <span>₹{(entry.payment_received ?? entry.credit).toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span>Applied to Due</span>
                          <span>₹{(entry.applied_to_due ?? 0).toFixed(0)}</span>
                        </div>
                        {(entry.advance_created ?? 0) > 0 && (
                          <div className="flex justify-between gap-2">
                            <span>Advance Created</span>
                            <span>₹{(entry.advance_created ?? 0).toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Due: ₹{entry.balance.toFixed(0)} • Adv: ₹{entry.advance_balance.toFixed(0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Debits (Sales)</span>
                <span className="font-medium">₹{totalDebits.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Total Credits (Returns + Payments)</span>
                <span className="font-medium">₹{totalCredits.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm mt-2 pt-2 border-t border-border font-semibold">
                <span>Net Due</span>
                <span>₹{(balances?.outstanding ?? customer.outstanding_balance).toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1 font-semibold">
                <span>Advance Balance</span>
                <span>₹{(balances?.advance ?? 0).toFixed(0)}</span>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}