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
  balance: number;
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

  useEffect(() => {
    if (open && customer) {
      fetchLedgerData();
    }
  }, [open, customer]);

  const fetchLedgerData = async () => {
    setIsLoading(true);
    try {
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
        .select('id, payment_date, amount, payment_method, notes')
        .eq('customer_id', customer.id)
        .order('payment_date', { ascending: true });

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
          debit: inv.pending_amount || 0, // Only pending amount is "owed"
          credit: 0,
          balance: 0,
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
        });
      }
    });

    // Add payments (credits - customer paid us)
    payments.forEach((pmt) => {
      entries.push({
        id: pmt.id,
        date: pmt.payment_date,
        type: 'payment',
        reference: pmt.notes || `${pmt.payment_method.toUpperCase()} Payment`,
        debit: 0,
        credit: pmt.amount,
        balance: 0,
      });
    });

    // Sort by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    entries.forEach((entry) => {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    });

    return entries;
  }, [invoices, payments]);

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
        return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30';
      case 'return':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30';
      case 'payment':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30';
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
            {customer.name} • Outstanding: ₹{customer.outstanding_balance.toFixed(2)}
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
                      <p className="text-sm font-medium text-orange-600">+₹{entry.debit.toFixed(0)}</p>
                    )}
                    {entry.credit > 0 && (
                      <p className="text-sm font-medium text-green-600">-₹{entry.credit.toFixed(0)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Bal: ₹{entry.balance.toFixed(0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Debits (Sales)</span>
                <span className="font-medium text-orange-600">
                  ₹{totalDebits.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Total Credits (Returns + Payments)</span>
                <span className="font-medium text-green-600">
                  ₹{totalCredits.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2 pt-2 border-t border-border font-semibold">
                <span>Net Due</span>
                <span className={customer.outstanding_balance > 0 ? 'text-orange-600' : 'text-green-600'}>
                  ₹{customer.outstanding_balance.toFixed(0)}
                </span>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}