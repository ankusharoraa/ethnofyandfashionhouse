import { motion } from 'framer-motion';
import { User, Phone, MapPin, IndianRupee, Trash2, Edit, Wallet, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Customer } from '@/hooks/useCustomers';

interface CustomerCardProps {
  customer: Customer;
  onSelect?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  onReceivePayment?: (customer: Customer) => void;
  onViewLedger?: (customer: Customer) => void;
}

export function CustomerCard({ customer, onSelect, onEdit, onDelete, onReceivePayment, onViewLedger }: CustomerCardProps) {
  const hasBalance = customer.outstanding_balance > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card
        className="p-4"
        onClick={() => onSelect?.(customer)}
        role={onSelect ? 'button' : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Name */}
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-primary shrink-0" />
              <h3 className="font-semibold truncate">{customer.name}</h3>
              {customer.name_hindi && (
                <span className="text-sm text-muted-foreground hindi truncate">
                  ({customer.name_hindi})
                </span>
              )}
            </div>

            {/* Contact Info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {customer.phone}
                </span>
              )}
              {customer.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {customer.city}
                </span>
              )}
            </div>

            {/* Purchase Info */}
            <div className="flex items-center gap-3 mt-3">
              <Badge variant="outline" className="text-xs">
                <IndianRupee className="w-3 h-3 mr-1" />
                Total: ₹{customer.total_purchases.toFixed(0)}
              </Badge>
              {hasBalance && (
                <Badge variant="destructive" className="text-xs">
                  Due ₹{customer.outstanding_balance.toFixed(0)}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            {onViewLedger && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewLedger(customer);
                }}
                title="View Ledger"
              >
                <FileText className="w-4 h-4" />
              </Button>
            )}
            {hasBalance && onReceivePayment && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => {
                  e.stopPropagation();
                  onReceivePayment(customer);
                }}
                title="Receive Payment"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Wallet className="w-4 h-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(customer);
                }}
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(customer);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
