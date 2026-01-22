import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Receipt, User, Phone, CreditCard, Banknote, Smartphone, Clock, XCircle, CheckCircle2, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Invoice } from '@/hooks/useBilling';

interface InvoiceCardProps {
  invoice: Invoice;
  onCancel?: (id: string) => void;
  onViewDetails?: (invoice: Invoice) => void;
}

const paymentIcons = {
  cash: Banknote,
  upi: Smartphone,
  card: CreditCard,
  credit: Clock,
};

const statusConfig = {
  draft: { color: 'bg-yellow-100 text-yellow-800', icon: FileText },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

export function InvoiceCard({ invoice, onCancel, onViewDetails }: InvoiceCardProps) {
  const PaymentIcon = paymentIcons[invoice.payment_method];
  const status = statusConfig[invoice.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Invoice Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="font-mono font-semibold">{invoice.invoice_number}</span>
              <Badge className={`${status.color} flex items-center gap-1`}>
                <StatusIcon className="w-3 h-3" />
                {invoice.status}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mb-2">
              {format(new Date(invoice.created_at), 'dd MMM yyyy, hh:mm a')}
            </p>

            {(invoice.customer_name || invoice.customer_phone) && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {invoice.customer_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {invoice.customer_name}
                  </span>
                )}
                {invoice.customer_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {invoice.customer_phone}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 text-sm">
              <PaymentIcon className="w-4 h-4 text-muted-foreground" />
              <span className="capitalize">{invoice.payment_method}</span>
              <span className="text-muted-foreground">•</span>
              <span>{invoice.invoice_items?.length || 0} items</span>
            </div>
          </div>

          {/* Amount & Actions */}
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">₹{invoice.total_amount.toFixed(2)}</p>
            
            <div className="flex gap-2 mt-2">
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails(invoice)}
                >
                  View
                </Button>
              )}
              {onCancel && invoice.status !== 'cancelled' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onCancel(invoice.id)}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
