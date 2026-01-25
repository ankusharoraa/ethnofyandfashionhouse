import { useState, useEffect } from 'react';
import { Undo2, Package, Loader2, AlertCircle, Minus, Plus } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Invoice } from '@/hooks/useBilling';
import { ReturnRefundDialog } from '@/components/billing/ReturnRefundDialog';

interface ReturnableItem {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  price_type: 'per_metre' | 'fixed';
  rate: number | null;
  unit_price: number;
  original_quantity: number;
  original_length: number;
  returned_quantity: number;
  returned_length: number;
  returnable_quantity: number;
  returnable_length: number;
  line_total: number;
  // UI state
  selected: boolean;
  return_quantity: number;
  return_length: number;
}

interface ReturnInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onReturnComplete: () => void;
}

export function ReturnInvoiceDialog({
  open,
  onClose,
  invoice,
  onReturnComplete,
}: ReturnInvoiceDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [items, setItems] = useState<ReturnableItem[]>([]);
  const [notes, setNotes] = useState('');
  const [refundInfo, setRefundInfo] = useState<null | {
    customerId: string;
    amount: number;
    defaultNotes: string;
  }>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && invoice) {
      fetchReturnableItems();
    }
  }, [open, invoice]);

  const fetchReturnableItems = async () => {
    if (!invoice) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_returnable_items', {
        p_invoice_id: invoice.id,
      });

      if (error) throw error;

      const returnableItems: ReturnableItem[] = (data || []).map((item: any) => ({
        ...item,
        selected: false,
        return_quantity: 0,
        return_length: 0,
      }));

      setItems(returnableItems);
    } catch (error) {
      console.error('Error fetching returnable items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load returnable items',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (skuId: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.sku_id !== skuId) return item;
        const newSelected = !item.selected;
        return {
          ...item,
          selected: newSelected,
          return_quantity: newSelected ? item.returnable_quantity : 0,
          return_length: newSelected ? item.returnable_length : 0,
        };
      })
    );
  };

  const updateReturnQuantity = (skuId: string, value: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.sku_id !== skuId) return item;
        const clampedValue = Math.max(0, Math.min(value, item.returnable_quantity));
        return {
          ...item,
          return_quantity: clampedValue,
          selected: clampedValue > 0,
        };
      })
    );
  };

  const updateReturnLength = (skuId: string, value: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.sku_id !== skuId) return item;
        const clampedValue = Math.max(0, Math.min(value, item.returnable_length));
        return {
          ...item,
          return_length: clampedValue,
          selected: clampedValue > 0,
        };
      })
    );
  };

  const calculateReturnTotal = () => {
    return items
      .filter(item => item.selected)
      .reduce((total, item) => {
        if (item.price_type === 'per_metre') {
          return total + item.return_length * (item.rate || 0);
        }
        return total + item.return_quantity * item.unit_price;
      }, 0);
  };

  const handleConfirmReturn = async () => {
    if (!invoice) return;

    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select at least one item to return',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const returnItems = selectedItems.map(item => ({
        sku_id: item.sku_id,
        quantity: item.return_quantity,
        length_metres: item.return_length,
        line_total:
          item.price_type === 'per_metre'
            ? item.return_length * (item.rate || 0)
            : item.return_quantity * item.unit_price,
      }));

      const { data, error } = await supabase.rpc('process_invoice_return', {
        p_parent_invoice_id: invoice.id,
        p_return_items: returnItems,
        p_notes: notes || null,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        return_invoice_number?: string;
        return_amount?: number;
        applied_to_due?: number;
        to_advance?: number;
      };

      if (!result.success) {
        throw new Error(result.error || 'Return failed');
      }

      toast({
        title: '✅ Return Processed',
        description: `${result.return_invoice_number} - ₹${result.return_amount?.toFixed(2)}`,
      });

      const excess = Number(result.to_advance || 0);
      if (invoice.customer_id && excess > 0 && result.return_invoice_number) {
        // Auto-refund the excess (instead of leaving it as Advance) – ask method each time
        setRefundInfo({
          customerId: invoice.customer_id,
          amount: excess,
          defaultNotes: `Refund for return ${result.return_invoice_number}`,
        });
      } else {
        onReturnComplete();
        onClose();
      }
    } catch (error: any) {
      console.error('Error processing return:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process return',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!invoice) return null;

  const returnTotal = calculateReturnTotal();
  const hasSelectedItems = items.some(item => item.selected);
  const alreadyReturned = invoice.returned_amount || 0;
  const remainingReturnable = invoice.total_amount - alreadyReturned;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setRefundInfo(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-orange-500" />
            Return Invoice
          </DialogTitle>
          <DialogDescription>
            {invoice.invoice_number} • {invoice.customer_name || 'Walk-in Customer'}
          </DialogDescription>
        </DialogHeader>

        {/* Invoice Summary */}
        <div className="grid grid-cols-3 gap-2 text-sm bg-muted/50 rounded-lg p-3">
          <div>
            <p className="text-muted-foreground">Original</p>
            <p className="font-semibold">₹{invoice.total_amount.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Already Returned</p>
            <p className="font-semibold text-orange-600">₹{alreadyReturned.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Returnable</p>
            <p className="font-semibold text-green-600">₹{remainingReturnable.toFixed(0)}</p>
          </div>
        </div>

        {/* Items List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No returnable items</p>
            <p className="text-sm">This invoice has been fully returned</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[300px] -mx-6 px-6">
            <div className="space-y-2">
              {items.map(item => (
                <div
                  key={item.sku_id}
                  className={`p-3 rounded-lg border transition-colors ${
                    item.selected
                      ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/20'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleItem(item.sku_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm truncate">{item.sku_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.sku_code} • ₹{item.unit_price}/
                        {item.price_type === 'per_metre' ? 'm' : 'unit'}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Original: {item.price_type === 'per_metre' 
                          ? `${item.original_length}m` 
                          : `${item.original_quantity} pcs`}
                        {(item.returned_quantity > 0 || item.returned_length > 0) && (
                          <span className="text-orange-600 ml-2">
                            (Returned: {item.price_type === 'per_metre' 
                              ? `${item.returned_length}m` 
                              : `${item.returned_quantity} pcs`})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.selected && (
                    <div className="mt-3 flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Return:</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            item.price_type === 'per_metre'
                              ? updateReturnLength(item.sku_id, item.return_length - 0.5)
                              : updateReturnQuantity(item.sku_id, item.return_quantity - 1)
                          }
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          step={item.price_type === 'per_metre' ? '0.1' : '1'}
                          min={0}
                          max={
                            item.price_type === 'per_metre'
                              ? item.returnable_length
                              : item.returnable_quantity
                          }
                          value={
                            item.price_type === 'per_metre'
                              ? item.return_length
                              : item.return_quantity
                          }
                          onChange={e =>
                            item.price_type === 'per_metre'
                              ? updateReturnLength(item.sku_id, parseFloat(e.target.value) || 0)
                              : updateReturnQuantity(item.sku_id, parseInt(e.target.value) || 0)
                          }
                          className="w-16 h-7 text-center text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            item.price_type === 'per_metre'
                              ? updateReturnLength(item.sku_id, item.return_length + 0.5)
                              : updateReturnQuantity(item.sku_id, item.return_quantity + 1)
                          }
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        / {item.price_type === 'per_metre' 
                          ? `${item.returnable_length}m` 
                          : `${item.returnable_quantity}`}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        ₹{(item.price_type === 'per_metre'
                          ? item.return_length * (item.rate || 0)
                          : item.return_quantity * item.unit_price
                        ).toFixed(0)}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="return-notes" className="text-sm">
            Notes (optional)
          </Label>
          <Textarea
            id="return-notes"
            placeholder="Reason for return..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="h-16 resize-none"
          />
        </div>

        {/* Return Total */}
        {hasSelectedItems && (
          <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Return Amount</p>
            <p className="text-2xl font-bold text-orange-600">₹{returnTotal.toFixed(2)}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmReturn}
            disabled={!hasSelectedItems || isProcessing || returnTotal > remainingReturnable}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Undo2 className="w-4 h-4 mr-2" />
                Confirm Return
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {invoice.customer_id && refundInfo && (
        <ReturnRefundDialog
          open={!!refundInfo}
          onClose={() => {
            setRefundInfo(null);
            onReturnComplete();
            onClose();
          }}
          customerId={refundInfo.customerId}
          amount={refundInfo.amount}
          defaultNotes={refundInfo.defaultNotes}
          onRefunded={() => {
            onReturnComplete();
          }}
        />
      )}
    </Dialog>
  );
}