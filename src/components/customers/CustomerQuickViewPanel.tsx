import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, FileText, Loader2, Undo2, Wallet } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomerPaymentDialog } from '@/components/customers/CustomerPaymentDialog';
import { CustomerAdvanceRefundDialog } from '@/components/customers/CustomerAdvanceRefundDialog';
import { supabase } from '@/integrations/supabase/client';

import type { Customer } from '@/hooks/useCustomers';

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

const PAGE_SIZE = 10;

interface CustomerQuickViewPanelProps {
  customer: Customer | null;
  onRefreshCustomerList: () => void;
}

export function CustomerQuickViewPanel({ customer, onRefreshCustomerList }: CustomerQuickViewPanelProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showReceivePayment, setShowReceivePayment] = useState(false);
  const [showAdvanceRefund, setShowAdvanceRefund] = useState(false);

  useEffect(() => {
    if (!customer?.id) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('customer_ledger')
          .select(
            'id, created_at, entry_type, reference_id, reference_label, debit_amount, credit_amount, running_balance'
          )
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(0, PAGE_SIZE - 1);

        if (error) throw error;
        if (!cancelled) setRows((data || []) as LedgerRow[]);
      } catch (e) {
        console.error('Failed to load quick ledger preview:', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [customer?.id]);

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

  const handlePaymentSuccess = async () => {
    onRefreshCustomerList();
    // reload preview list
    if (customer?.id) {
      const { data } = await supabase
        .from('customer_ledger')
        .select(
          'id, created_at, entry_type, reference_id, reference_label, debit_amount, credit_amount, running_balance'
        )
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      setRows((data || []) as LedgerRow[]);
    }
  };

  if (!customer) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">Select a customer to see quick ledger view.</div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="font-semibold truncate">{customer.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {customer.phone || 'No phone'}
            {customer.city ? ` • ${customer.city}` : ''}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {Number(customer.advance_balance || 0) > 0 && (
              <Badge variant="secondary">Advance ₹{Number(customer.advance_balance || 0).toFixed(0)}</Badge>
            )}
            {Number(customer.outstanding_balance || 0) > 0 && (
              <Badge variant="destructive">Due ₹{Number(customer.outstanding_balance || 0).toFixed(0)}</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => setShowReceivePayment(true)}
            disabled={customer.is_deleted}
            title={customer.is_deleted ? 'Customer is archived' : 'Receive payment'}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Receive Payment
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowAdvanceRefund(true)}
            disabled={customer.is_deleted || Number(customer.advance_balance || 0) <= 0}
            title={
              customer.is_deleted
                ? 'Customer is archived'
                : Number(customer.advance_balance || 0) <= 0
                  ? 'No advance to refund'
                  : 'Refund advance'
            }
          >
            Refund Advance
          </Button>
          <Button variant="outline" onClick={() => navigate(`/customers/${customer.id}/ledger`)}>
            <FileText className="w-4 h-4 mr-2" />
            Full Ledger
          </Button>
        </div>
      </div>

      <div className="text-sm font-medium mb-2">Recent ledger (last {PAGE_SIZE})</div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6">No ledger entries found.</div>
      ) : (
        <ScrollArea className="h-[60vh]">
          <div className="space-y-2 pr-4">
            {rows.map((row) => {
              const debit = Number(row.debit_amount || 0);
              const credit = Number(row.credit_amount || 0);
              return (
                <button
                  key={row.id}
                  type="button"
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    if (!row.reference_id) return;
                    if (row.entry_type === 'sale' || row.entry_type === 'return') {
                      navigate(`/billing?invoiceId=${row.reference_id}`);
                      return;
                    }
                    if (row.entry_type === 'payment') {
                      navigate(`/customers/${customer.id}/ledger?paymentId=${row.reference_id}`);
                    }
                  }}
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
          </div>
        </ScrollArea>
      )}

      <CustomerPaymentDialog
        open={showReceivePayment}
        onClose={() => setShowReceivePayment(false)}
        customer={customer}
        onSuccess={handlePaymentSuccess}
      />

      <CustomerAdvanceRefundDialog
        open={showAdvanceRefund}
        onClose={() => setShowAdvanceRefund(false)}
        customer={customer}
        onSuccess={handlePaymentSuccess}
      />
    </Card>
  );
}
