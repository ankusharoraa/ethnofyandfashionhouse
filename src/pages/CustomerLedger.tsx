import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, FileText, ArrowUpRight, ArrowDownLeft, Undo2, Loader2, Wallet } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { CustomerPaymentDialog } from '@/components/customers/CustomerPaymentDialog';
import { CustomerAdvanceRefundDialog } from '@/components/customers/CustomerAdvanceRefundDialog';
import { fetchCustomerLedgerFallback } from '@/lib/customer-ledger-fallback';

type LedgerEntryType = 'sale' | 'return' | 'payment' | 'adjustment';

type LedgerRow = {
  id: string;
  created_at: string;
  entry_type: LedgerEntryType;
  reference_id: string | null;
  reference_label: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  outstanding_balance: number;
};

type PaymentRow = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  invoice_id: string | null;
};

type InvoicePaymentSplitRow = {
  invoice_id: string;
  amount: number;
  payment_method: string;
};

type PaymentDetailsState =
  | {
      kind: 'customer_payment';
      payment: PaymentRow;
      split?: InvoicePaymentSplitRow[];
    }
  | {
      kind: 'invoice_payment';
      invoice: {
        id: string;
        created_at: string;
        invoice_number: string;
        amount_paid: number;
        advance_applied: number;
        pending_amount: number;
        total_amount: number;
      };
      split?: InvoicePaymentSplitRow[];
    };

const PAGE_SIZE = 50;

export default function CustomerLedger() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsState | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const [showReceivePayment, setShowReceivePayment] = useState(false);
  const [showAdvanceRefund, setShowAdvanceRefund] = useState(false);

  const paymentId = searchParams.get('paymentId');

  useEffect(() => {
    if (!customerId) return;
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    if (!paymentId) {
      setPaymentDetails(null);
      return;
    }
    void loadPayment(paymentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  const loadInitial = async () => {
    setIsLoading(true);
    try {
      const { data: cust, error: custErr } = await supabase
        .from('customers')
        .select('id, name, phone, city, outstanding_balance')
        .eq('id', customerId)
        .maybeSingle();

      if (custErr) throw custErr;
      if (!cust) {
        setCustomer(null);
        setLedgerRows([]);
        setHasMore(false);
        return;
      }

      setCustomer(cust as CustomerRow);
      // Load first page of ledger rows
      const { rows, hasMore: more } = await fetchLedgerPage(0);
      setLedgerRows(rows);
      setHasMore(more);
      setPage(0);
    } catch (e) {
      console.error('Failed to load customer ledger page:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Refresh balances + ledger
    await loadInitial();
  };

  const fetchLedgerPage = async (pageIndex: number) => {
    if (!customerId) {
      return { rows: [] as LedgerRow[], hasMore: false };
    }

    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('customer_ledger')
      .select(
        'id, created_at, entry_type, reference_id, reference_label, debit_amount, credit_amount, running_balance',
        { count: 'exact' },
      )
      .eq('customer_id', customerId)
      // Show latest entries first to match quick ledger
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Failed to load customer ledger rows:', error);
      return { rows: [] as LedgerRow[], hasMore: false };
    }

    // If the ledger table is not populated yet, fall back to invoices + payments so
    // the user still sees their transaction history.
    if ((data || []).length === 0 && pageIndex === 0) {
      const fallback = await fetchCustomerLedgerFallback({
        customerId,
        limit: PAGE_SIZE,
      });

      return {
        rows: (fallback as unknown as LedgerRow[]),
        hasMore: false,
      };
    }

    const rows = (data || []) as LedgerRow[];
    const total = typeof count === 'number' ? count : rows.length;
    const hasMore = to + 1 < total;

    return {
      rows,
      hasMore,
    };
  };

  const loadMore = async () => {
    const nextPage = page + 1;
    const { rows, hasMore: more } = await fetchLedgerPage(nextPage);
    setLedgerRows((prev) => [...prev, ...rows]);
    setHasMore(more);
    setPage(nextPage);
  };

  const loadPayment = async (id: string) => {
    setIsPaymentLoading(true);
    try {
      // 1) Try a direct customer payment (manual receive payment)
      const { data, error } = await supabase
        .from('customer_payments')
        .select('id, payment_date, amount, payment_method, notes, invoice_id')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const payment = data as PaymentRow;

        // Optional split breakdown if this payment is tied to an invoice
        let split: InvoicePaymentSplitRow[] | undefined;
        if (payment.invoice_id) {
          const { data: splitRows } = await supabase
            .from('invoice_payments')
            .select('invoice_id, amount, payment_method')
            .eq('invoice_id', payment.invoice_id);
          split = (splitRows || []) as InvoicePaymentSplitRow[];
        }

        setPaymentDetails({ kind: 'customer_payment', payment, split });
        return;
      }

      // 2) Otherwise, this ledger “payment” may reference an invoice id (split checkout payments)
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('id, created_at, invoice_number, amount_paid, advance_applied, pending_amount, total_amount')
        .eq('id', id)
        .maybeSingle();

      if (invErr) throw invErr;
      if (!inv) {
        setPaymentDetails(null);
        return;
      }

      const { data: splitRows } = await supabase
        .from('invoice_payments')
        .select('invoice_id, amount, payment_method')
        .eq('invoice_id', inv.id);

      setPaymentDetails({
        kind: 'invoice_payment',
        invoice: {
          id: inv.id,
          created_at: inv.created_at,
          invoice_number: inv.invoice_number,
          amount_paid: Number(inv.amount_paid ?? 0),
          advance_applied: Number(inv.advance_applied ?? 0),
          pending_amount: Number(inv.pending_amount ?? 0),
          total_amount: Number(inv.total_amount ?? 0),
        },
        split: (splitRows || []) as InvoicePaymentSplitRow[],
      });
    } catch (e) {
      console.error('Failed to load payment details:', e);
      setPaymentDetails(null);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const title = customer ? `${customer.name} • Ledger` : 'Customer Ledger';

  const headerBadges = useMemo(() => {
    if (!customer) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {Number(customer.outstanding_balance || 0) > 0 && (
          <Badge variant="destructive">Due ₹{Number(customer.outstanding_balance || 0).toFixed(0)}</Badge>
        )}
      </div>
    );
  }, [customer]);

  const getEntryIcon = (type: LedgerEntryType) => {
    switch (type) {
      case 'sale':
        return <ArrowUpRight className="w-4 h-4" />;
      case 'return':
        return <Undo2 className="w-4 h-4" />;
      case 'payment':
        return <ArrowDownLeft className="w-4 h-4" />;
      case 'adjustment':
        return <Undo2 className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: LedgerEntryType) => {
    switch (type) {
      case 'sale':
        return 'Sale';
      case 'return':
        return 'Return';
      case 'payment':
        return 'Payment';
      case 'adjustment':
        return 'Adjustment';
    }
  };

  const handleEntryClick = (row: LedgerRow) => {
    if (row.entry_type === 'sale' || row.entry_type === 'return') {
      if (!row.reference_id) return;
      navigate(`/billing?invoiceId=${row.reference_id}`);
      return;
    }

    if (row.entry_type === 'payment') {
      if (!row.reference_id) return;
      const next = new URLSearchParams(searchParams);
      next.set('paymentId', row.reference_id);
      setSearchParams(next, { replace: true });
    }
  };

  const closePaymentDialog = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('paymentId');
    setSearchParams(next, { replace: true });
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/customers')} title="Back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {title}
            </h1>
          </div>
          {customer && (
            <p className="text-sm text-muted-foreground">
              {customer.phone || 'No phone'} {customer.city ? `• ${customer.city}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {headerBadges}
          {customer && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowReceivePayment(true)}
                title="Receive payment"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Receive Payment
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAdvanceRefund(true)}
                disabled
                title="Feature not yet implemented"
              >
                Refund Advance
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !customer ? (
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="text-lg text-muted-foreground">Customer not found</p>
        </Card>
      ) : (
        <Card className="p-4">
		  <ScrollArea className="h-[70vh]">
		    <div className="space-y-2 pr-4">
		      {ledgerRows.map((row) => {
		        const debit = Number(row.debit_amount || 0);
		        const credit = Number(row.credit_amount || 0);
		        return (
		          <button
		            key={row.id}
		            type="button"
		            onClick={() => handleEntryClick(row)}
		            className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
		          >
		            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-foreground">
		              {getEntryIcon(row.entry_type)}
		            </div>

		            <div className="flex-1 min-w-0">
		              <div className="flex items-center gap-2">
		                <p className="text-sm font-medium truncate">
		                  {row.reference_label || `${getTypeLabel(row.entry_type)} #${row.reference_id?.slice(0, 8) || ''}`}
		                </p>
		                <Badge variant="outline" className="text-xs">
		                  {getTypeLabel(row.entry_type)}
		                </Badge>
		              </div>
		              <p className="text-xs text-muted-foreground">
		                {format(new Date(row.created_at), 'dd MMM yyyy, hh:mm a')}
		              </p>
		            </div>

		            <div className="text-right">
		              {debit > 0 && <p className="text-sm font-medium">+₹{debit.toFixed(0)}</p>}
		              {credit > 0 && <p className="text-sm font-medium">-₹{credit.toFixed(0)}</p>}
		              <p className="text-xs text-muted-foreground">Net: ₹{Number(row.running_balance || 0).toFixed(0)}</p>
		            </div>
		          </button>
		        );
		      })}

		      {ledgerRows.length === 0 && (
		        <div className="text-center py-12 text-muted-foreground">
		          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
		          <p>No ledger entries found</p>
		        </div>
		      )}

		      {hasMore && (
		        <div className="pt-2">
		          <Button variant="outline" className="w-full" onClick={loadMore}>
		            Load more
		          </Button>
		        </div>
		      )}
		    </div>
		  </ScrollArea>
        </Card>
      )}

      <Dialog open={!!paymentId} onOpenChange={(o) => !o && closePaymentDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
            <DialogDescription>Payment details</DialogDescription>
          </DialogHeader>

          {isPaymentLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !paymentDetails ? (
            <div className="text-sm text-muted-foreground">Payment not found</div>
          ) : (
            <div className="space-y-2 text-sm">
              {paymentDetails.kind === 'customer_payment' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(new Date(paymentDetails.payment.payment_date), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span>₹{Number(paymentDetails.payment.amount || 0).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="uppercase">{paymentDetails.payment.payment_method}</span>
                  </div>

                  {Array.isArray(paymentDetails.split) && paymentDetails.split.length > 0 && (
                    <div className="pt-2">
                      <div className="text-muted-foreground mb-1">Split</div>
                      <div className="space-y-1">
                        {paymentDetails.split
                          .filter((r) => Number(r.amount) > 0)
                          .map((r, idx) => (
                            <div key={`split-${idx}`} className="flex justify-between">
                              <span className="uppercase">{r.payment_method}</span>
                              <span>₹{Number(r.amount).toFixed(0)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {paymentDetails.payment.notes && (
                    <div className="pt-2">
                      <div className="text-muted-foreground">Notes</div>
                      <div>{paymentDetails.payment.notes}</div>
                    </div>
                  )}

                  {paymentDetails.payment.invoice_id && (
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => navigate(`/billing?invoiceId=${paymentDetails.payment.invoice_id}`)}
                    >
                      View related invoice
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice</span>
                    <span className="font-medium">{paymentDetails.invoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(new Date(paymentDetails.invoice.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>

                  {Array.isArray(paymentDetails.split) && paymentDetails.split.length > 0 && (
                    <div className="pt-2">
                      <div className="text-muted-foreground mb-1">Split</div>
                      <div className="space-y-1">
                        {paymentDetails.split
                          .filter((r) => Number(r.amount) > 0)
                          .map((r, idx) => (
                            <div key={`inv-split-${idx}`} className="flex justify-between">
                              <span className="uppercase">{r.payment_method}</span>
                              <span>₹{Number(r.amount).toFixed(0)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid (cash/upi/card)</span>
                      <span>₹{Number(paymentDetails.invoice.amount_paid).toFixed(0)}</span>
                    </div>
                    {Number(paymentDetails.invoice.advance_applied) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Advance used</span>
                        <span>₹{Number(paymentDetails.invoice.advance_applied).toFixed(0)}</span>
                      </div>
                    )}
                    {Number(paymentDetails.invoice.pending_amount) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due created</span>
                        <span>₹{Number(paymentDetails.invoice.pending_amount).toFixed(0)}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => navigate(`/billing?invoiceId=${paymentDetails.invoice.id}`)}
                  >
                    View related invoice
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {customer && (
        <CustomerPaymentDialog
          open={showReceivePayment}
          onClose={() => setShowReceivePayment(false)}
          customer={customer}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {customer && (
        <CustomerAdvanceRefundDialog
          open={showAdvanceRefund}
          onClose={() => setShowAdvanceRefund(false)}
          customer={customer}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </AppLayout>
  );
}
