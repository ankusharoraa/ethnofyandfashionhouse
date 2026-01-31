 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Button } from '@/components/ui/button';
 import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import type { PurchaseTableItem } from '@/types/purchase';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useState } from 'react';
import { ShortcutHint } from '@/components/ui/shortcut-hint';
 
 interface PurchaseProductTableProps {
   items: PurchaseTableItem[];
   selectedIndex: number | null;
   onSelectRow: (index: number) => void;
   onDeleteRow: (index: number) => void;
 }
 
 export function PurchaseProductTable({
   items,
   selectedIndex,
   onSelectRow,
   onDeleteRow,
 }: PurchaseProductTableProps) {
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');

   if (items.length === 0) {
     return (
       <div className="flex-1 flex items-center justify-center p-8">
         <div className="text-center text-muted-foreground">
           <p className="text-lg font-medium mb-2">No products added yet</p>
           <p className="text-sm">Search and add products using the form on the right</p>
         </div>
       </div>
     );
   }
    
    const cellY = density === 'compact' ? 'py-1 text-xs' : 'py-3 text-sm';

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
          <div className="text-sm text-muted-foreground">
            Items: <span className="text-foreground font-medium">{items.length}</span>
          </div>
          <ToggleGroup
            type="single"
            value={density}
            onValueChange={(v) => v && setDensity(v as any)}
            className="justify-end"
          >
            <ToggleGroupItem value="compact" aria-label="Compact density">Compact</ToggleGroupItem>
            <ToggleGroupItem value="comfortable" aria-label="Comfortable density">Comfort</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
           <TableRow>
             <TableHead className="w-12">#</TableHead>
             <TableHead>Product Name</TableHead>
             <TableHead className="text-right">Purchase Qty</TableHead>
             <TableHead className="text-right">Purchase Price</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">GST%</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
              <TableHead className="text-right">Unit</TableHead>
             <TableHead className="w-12"></TableHead>
           </TableRow>
         </TableHeader>
         <TableBody>
           {items.map((item, index) => (
             <TableRow
               key={item.id}
                data-row-index={index}
               className={cn(
                   "cursor-pointer transition-colors group",
                   density === 'compact' ? 'text-xs' : 'text-sm',
                   selectedIndex === index && "bg-muted"
                )}
               onClick={() => onSelectRow(index)}
             >
                <TableCell className={cn('font-medium', cellY)}>{index + 1}</TableCell>
               <TableCell>
                 <div className="font-medium">{item.product_name}</div>
                 <div className="text-xs text-muted-foreground">{item.sku_code}</div>
               </TableCell>
                <TableCell className={cn('text-right tabular-nums', cellY)}>{item.purchase_qty}</TableCell>
                <TableCell className={cn('text-right tabular-nums', cellY)}>₹{item.purchase_price.toFixed(2)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', cellY)}>₹{item.taxable_amount.toFixed(2)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', cellY)}>{Number(item.gst_rate ?? 0).toFixed(0)}%</TableCell>
                <TableCell className={cn('text-right font-semibold tabular-nums', cellY)}>₹{item.total_amount.toFixed(2)}</TableCell>
                <TableCell className={cn('text-right', cellY)}>{item.alt_unit}</TableCell>
               <TableCell>
                  <ShortcutHint label="Remove item" keys="Del">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRow(index);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive opacity-60 group-hover:opacity-100" />
                    </Button>
                  </ShortcutHint>
               </TableCell>
             </TableRow>
           ))}
         </TableBody>
          </Table>
        </ScrollArea>
      </div>
   );
 }