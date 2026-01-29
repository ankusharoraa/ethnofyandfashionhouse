 import { Card, CardContent } from '@/components/ui/card';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Button } from '@/components/ui/button';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Separator } from '@/components/ui/separator';
 import type { PurchaseType } from '@/types/purchase';
 
 interface PurchaseSummaryCardProps {
   subtotal: number;
   billDiscount: number;
   roundOff: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxAmount?: number;
   totalAmount: number;
   purchaseType: PurchaseType;
   amountPaid: number;
   balance: number;
   supplierLastPrice: number;
   productLastPrice: number;
   onDiscountChange: (value: number) => void;
   onRoundOffChange: (value: number) => void;
   onPurchaseTypeChange: (type: PurchaseType) => void;
   onAmountPaidChange: (value: number) => void;
   onBankAccountChange: (value: string) => void;
   onPrintBarcodes: () => void;
   onPrint: () => void;
   onSave: () => void;
   bankAccount: string;
 }
 
 export function PurchaseSummaryCard({
   subtotal,
   billDiscount,
   roundOff,
  cgstAmount = 0,
  sgstAmount = 0,
  igstAmount = 0,
  taxAmount = 0,
   totalAmount,
   purchaseType,
   amountPaid,
   balance,
   supplierLastPrice,
   productLastPrice,
   onDiscountChange,
   onRoundOffChange,
   onPurchaseTypeChange,
   onAmountPaidChange,
   onBankAccountChange,
   onPrintBarcodes,
   onPrint,
   onSave,
   bankAccount,
 }: PurchaseSummaryCardProps) {
   return (
     <Card>
       <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between font-semibold">
            <span>Taxable Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>

         <div className="flex justify-between items-center text-sm">
           <Label>Bill Discount:</Label>
           <Input
             type="number"
             step="0.01"
             className="w-32 text-right"
             value={billDiscount}
             onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
           />
         </div>

          {(cgstAmount > 0 || sgstAmount > 0 || igstAmount > 0) && (
            <div className="space-y-1 text-sm">
              {cgstAmount > 0 && (
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span>₹{cgstAmount.toFixed(2)}</span>
                </div>
              )}
              {sgstAmount > 0 && (
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span>₹{sgstAmount.toFixed(2)}</span>
                </div>
              )}
              {igstAmount > 0 && (
                <div className="flex justify-between">
                  <span>IGST:</span>
                  <span>₹{igstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <span>Total GST:</span>
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
 
         <div className="flex justify-between font-semibold">
           <span>Total Bill Amt:</span>
           <span>₹{totalAmount.toFixed(2)}</span>
         </div>
 
         <div className="flex justify-between items-center text-sm">
           <Label>Round Off:</Label>
           <Input
             type="number"
             step="0.01"
             className="w-32 text-right"
             value={roundOff}
             onChange={(e) => onRoundOffChange(parseFloat(e.target.value) || 0)}
           />
         </div>
 
         <div className="flex justify-between items-center text-sm">
           <Label>Purchase Type:</Label>
           <Select value={purchaseType} onValueChange={onPurchaseTypeChange}>
             <SelectTrigger className="w-32">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="cash">Cash</SelectItem>
               <SelectItem value="credit">Credit</SelectItem>
               <SelectItem value="partial">Partial</SelectItem>
             </SelectContent>
           </Select>
         </div>
 
         <div className="flex justify-between items-center text-sm">
           <Label>Bank A/c:</Label>
           <Input
             className="w-48"
             value={bankAccount}
             onChange={(e) => onBankAccountChange(e.target.value)}
             placeholder="Bank account"
           />
         </div>
 
          <div className="flex justify-between items-center bg-muted/40 p-2 rounded">
            <Label className="font-semibold">Total Paid:</Label>
           <Input
             type="number"
             step="0.01"
             className="w-32 text-right"
             value={amountPaid}
             onChange={(e) => onAmountPaidChange(parseFloat(e.target.value) || 0)}
             disabled={purchaseType === 'credit'}
           />
         </div>
 
         <div className="flex justify-between font-semibold text-primary">
           <span>Balance:</span>
           <span>₹{balance.toFixed(2)}</span>
         </div>
 
         <Separator />
 
         <div className="space-y-1 text-xs text-muted-foreground">
           <div className="flex justify-between">
             <span>Supplier's Last Purchase Price:</span>
             <span>₹{supplierLastPrice.toFixed(2)}</span>
           </div>
           <div className="flex justify-between">
             <span>Product's Last Purchase Price:</span>
             <span>₹{productLastPrice.toFixed(2)}</span>
           </div>
         </div>
 
         <div className="grid grid-cols-3 gap-2 pt-2">
           <Button variant="outline" size="sm" onClick={onPrintBarcodes}>
             Print Barcode
           </Button>
           <Button variant="outline" size="sm" onClick={onPrint}>
             Print
           </Button>
            <Button size="sm" onClick={onSave}>
             Save
           </Button>
         </div>
       </CardContent>
     </Card>
   );
 }