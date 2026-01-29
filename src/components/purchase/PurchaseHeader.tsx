 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Switch } from '@/components/ui/switch';
 import { Calendar } from '@/components/ui/calendar';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Search } from 'lucide-react';
 import { format } from 'date-fns';
 import { cn } from '@/lib/utils';
 import type { Supplier } from '@/hooks/useSuppliers';
 import { SupplierSearchDialog } from '@/components/billing/SupplierSearchDialog';
 import { SupplierCreateDialog } from '@/components/suppliers/SupplierCreateDialog';
 import { useSuppliers } from '@/hooks/useSuppliers';
 import { useState } from 'react';
 
 interface PurchaseHeaderProps {
   supplier: Supplier | null;
   invoiceNumber: string;
   supplierInvoiceNo: string;
   supplierInvoiceDate: Date;
  supplierGstin: string;
   marginEnabled: boolean;
   marginRetail: number;
   marginWholesale: number;
   onSupplierChange: (supplier: Supplier) => void;
   onInvoiceInfoChange: (field: string, value: any) => void;
  onGstinSearch: (gstin: string) => void;
   onMarginChange: (field: string, value: any) => void;
 }
 
 export function PurchaseHeader({
   supplier,
   invoiceNumber,
   supplierInvoiceNo,
   supplierInvoiceDate,
  supplierGstin,
   marginEnabled,
   marginRetail,
   marginWholesale,
   onSupplierChange,
   onInvoiceInfoChange,
  onGstinSearch,
   onMarginChange,
 }: PurchaseHeaderProps) {
   const [showSupplierSearch, setShowSupplierSearch] = useState(false);
   const [showSupplierCreate, setShowSupplierCreate] = useState(false);
   const { suppliers, createSupplier } = useSuppliers();
 
   return (
     <>
        <div className="bg-card border-b p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
           {/* Left: Title and Supplier */}
            <div className="lg:col-span-5 space-y-3">
             <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight">Purchase</h1>
                <span className="text-sm text-muted-foreground">#{invoiceNumber}</span>
             </div>
             
             <div className="flex flex-wrap gap-2">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setShowSupplierCreate(true)}
               >
                 <Plus className="w-4 h-4 mr-2" />
                 Add New Supplier
               </Button>
               
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setShowSupplierSearch(true)}
               >
                 {supplier ? supplier.name : 'Select Supplier'}
               </Button>
               
               {supplier && (
                 <div className="flex items-center gap-2 text-sm">
                   <span className="text-muted-foreground">Balance:</span>
                   <span className={cn(
                     "font-semibold",
                      supplier.outstanding_balance > 0 ? "text-destructive" : "text-primary"
                   )}>
                     ₹{Math.abs(supplier.outstanding_balance).toFixed(2)} {supplier.outstanding_balance > 0 ? 'Dr' : 'Cr'}
                   </span>
                 </div>
               )}
             </div>
           </div>
           
           {/* Center: Supplier Invoice Info */}
             <div className="lg:col-span-4 flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Supplier GSTIN</Label>
                <div className="flex gap-1">
                  <Input
                    className="w-40"
                    value={supplierGstin}
                    onChange={(e) => onInvoiceInfoChange('supplierGstin', e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && supplierGstin) {
                        onGstinSearch(supplierGstin);
                      }
                    }}
                    placeholder="Enter GSTIN"
                    maxLength={15}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => supplierGstin && onGstinSearch(supplierGstin)}
                    disabled={!supplierGstin}
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>

             <div className="space-y-1.5">
               <Label className="text-xs">Invoice No</Label>
               <Input
                 className="w-32"
                 value={supplierInvoiceNo}
                 onChange={(e) => onInvoiceInfoChange('supplierInvoiceNo', e.target.value)}
                 placeholder="Inv No"
               />
             </div>
             
             <div className="space-y-1.5">
               <Label className="text-xs">Date</Label>
               <Popover>
                 <PopoverTrigger asChild>
                   <Button
                     variant="outline"
                     className={cn(
                       "w-32 justify-start text-left font-normal",
                       !supplierInvoiceDate && "text-muted-foreground"
                     )}
                   >
                     <CalendarIcon className="mr-2 h-4 w-4" />
                     {supplierInvoiceDate ? format(supplierInvoiceDate, "dd/MM/yyyy") : "Pick date"}
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-auto p-0" align="end">
                   <Calendar
                     mode="single"
                     selected={supplierInvoiceDate}
                     onSelect={(date) => onInvoiceInfoChange('supplierInvoiceDate', date || new Date())}
                     initialFocus
                   />
                 </PopoverContent>
               </Popover>
             </div>
           </div>
           
           {/* Right: Margin Controls */}
            <div className="lg:col-span-3 flex gap-3 items-end justify-start lg:justify-end">
             <div className="space-y-1.5">
               <Label className="text-xs">Margin % [On/Off]</Label>
               <Switch
                 checked={marginEnabled}
                 onCheckedChange={(checked) => onMarginChange('enabled', checked)}
               />
             </div>
             
             <div className="space-y-1.5">
               <Label className="text-xs">Margin Retail %</Label>
               <Input
                 type="number"
                 step="0.01"
                 className="w-24"
                 value={marginRetail}
                 onChange={(e) => onMarginChange('retail', parseFloat(e.target.value) || 0)}
                 disabled={!marginEnabled}
               />
             </div>
             
             <div className="space-y-1.5">
               <Label className="text-xs">Margin Wholesale %</Label>
               <Input
                 type="number"
                 step="0.01"
                 className="w-24"
                 value={marginWholesale}
                 onChange={(e) => onMarginChange('wholesale', parseFloat(e.target.value) || 0)}
                 disabled={!marginEnabled}
               />
             </div>
           </div>
         </div>
       </div>
       
       <SupplierSearchDialog
         open={showSupplierSearch}
         onClose={() => setShowSupplierSearch(false)}
         suppliers={suppliers}
         onSelect={(supplier) => {
           onSupplierChange(supplier);
           setShowSupplierSearch(false);
         }}
         onCreateNew={() => {
           setShowSupplierSearch(false);
           setShowSupplierCreate(true);
         }}
       />
       
       <SupplierCreateDialog
         open={showSupplierCreate}
         onClose={() => setShowSupplierCreate(false)}
         onCreate={createSupplier}
         onCreated={(supplier) => {
           onSupplierChange(supplier);
           setShowSupplierCreate(false);
         }}
       />
     </>
   );
 }