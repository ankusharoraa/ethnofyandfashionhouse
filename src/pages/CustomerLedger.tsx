import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, FileText, ArrowUpRight, ArrowDownLeft, Undo2, Loader2 } from 'lucide-react';

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

type LedgerEntryType = 'sale' | 'return' | 'payment';

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
  advance_balance: number;
  is_deleted: boolean;
};

type PaymentRow = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  invoice_id: string | null;
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

  const [paymentDetails, setPaymentDetails] = useState<PaymentRow | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

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
        .select('id, name, phone, city, outstanding_balance, advance_balance, is_deleted')
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

  const fetchLedgerPage = async (pageIndex: number) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('customer_ledger')
      .select(
        'id, created_at, entry_type, reference_id, reference_label, debit_amount, credit_amount, running_balance'
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const rows = (data || []) as LedgerRow[];
    return {
      rows,
      hasMore: rows.length === PAGE_SIZE,
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
      const { data, error } = await supabase
        .from('customer_payments')
        .select('id, payment_date, amount, payment_method, notes, invoice_id')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setPaymentDetails((data as PaymentRow) || null);
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
        <Badge variant="outline">Due: ₹{Number(customer.outstanding_balance || 0).toFixed(0)}</Badge>
        <Badge variant="outline">Advance: ₹{Number(customer.advance_balance || 0).toFixed(0)}</Badge>
        {customer.is_deleted && <Badge variant="destructive">Archived</Badge>}
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

        {headerBadges}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{format(new Date(paymentDetails.payment_date), 'dd MMM yyyy, hh:mm a')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span>₹{Number(paymentDetails.amount || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="uppercase">{paymentDetails.payment_method}</span>
              </div>
              {paymentDetails.notes && (
                <div className="pt-2">
                  <div className="text-muted-foreground">Notes</div>
                  <div>{paymentDetails.notes}</div>
                </div>
              )}

              {paymentDetails.invoice_id && (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => navigate(`/billing?invoiceId=${paymentDetails.invoice_id}`)}
                >
                  View related invoice
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
