import { motion } from 'framer-motion';
import { Building2, Phone, MapPin, IndianRupee, Edit, Trash2, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Supplier } from '@/hooks/useSuppliers';

interface SupplierCardProps {
  supplier: Supplier;
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (id: string) => void;
  onPayment?: (supplier: Supplier) => void;
  onViewHistory?: (supplier: Supplier) => void;
}

export function SupplierCard({ supplier, onEdit, onDelete, onPayment, onViewHistory }: SupplierCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{supplier.name}</h3>
              {supplier.name_hindi && (
                <p className="text-sm text-muted-foreground">{supplier.name_hindi}</p>
              )}
            </div>
          </div>
          {supplier.outstanding_balance > 0 && (
            <Badge variant="destructive" className="gap-1">
              <IndianRupee className="w-3 h-3" />
              {supplier.outstanding_balance.toFixed(0)} Due
            </Badge>
          )}
        </div>

        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          {supplier.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>{supplier.phone}</span>
            </div>
          )}
          {supplier.city && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{supplier.city}</span>
            </div>
          )}
          {supplier.gstin && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="font-mono text-xs">{supplier.gstin}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs border-t pt-3">
          <div>
            <span className="text-muted-foreground">Total Purchases: </span>
            <span className="font-semibold">₹{supplier.total_purchases.toFixed(0)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Paid: </span>
            <span className="font-semibold text-green-600">₹{supplier.total_paid.toFixed(0)}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {onPayment && supplier.outstanding_balance > 0 && (
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => onPayment(supplier)}
            >
              <CreditCard className="w-4 h-4 mr-1" />
              Pay
            </Button>
          )}
          {onViewHistory && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewHistory(supplier)}
            >
              History
            </Button>
          )}
          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(supplier)}
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(supplier.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
