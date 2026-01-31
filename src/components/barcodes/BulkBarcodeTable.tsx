 import { useState } from 'react';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
 import { AlertCircle, ArrowUpDown } from 'lucide-react';
 import { Button } from '@/components/ui/button';
import type { SKU } from '@/hooks/useSKUs';
 
 type SortField = 'code' | 'name' | 'barcode' | 'qty';
 type SortDirection = 'asc' | 'desc';

interface BulkBarcodeTableProps {
  skus: SKU[];
  selectedProducts: Map<string, number>;
  onToggleProduct: (skuId: string) => void;
  onUpdateCopyCount: (skuId: string, copies: number) => void;
  isLoading?: boolean;
}

export function BulkBarcodeTable({
  skus,
  selectedProducts,
  onToggleProduct,
  onUpdateCopyCount,
  isLoading,
}: BulkBarcodeTableProps) {
   const [sortField, setSortField] = useState<SortField>('code');
   const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
   
   const handleSort = (field: SortField) => {
     if (sortField === field) {
       setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
     } else {
       setSortField(field);
       setSortDirection('asc');
     }
   };
   
   const sortedSKUs = [...skus].sort((a, b) => {
     let compareValue = 0;
     
     switch (sortField) {
       case 'code':
         compareValue = a.sku_code.localeCompare(b.sku_code);
         break;
       case 'name':
         compareValue = a.name.localeCompare(b.name);
         break;
       case 'barcode':
         compareValue = (a.barcode || '').localeCompare(b.barcode || '');
         break;
       case 'qty':
         const qtyA = a.price_type === 'per_metre' ? a.length_metres || 0 : a.quantity || 0;
         const qtyB = b.price_type === 'per_metre' ? b.length_metres || 0 : b.quantity || 0;
         compareValue = qtyA - qtyB;
         break;
     }
     
     return sortDirection === 'asc' ? compareValue : -compareValue;
   });
   
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (skus.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No products found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                 <TableHead>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => handleSort('code')}
                     className="hover:bg-transparent p-0 h-auto font-semibold"
                   >
                     Product Code
                     <ArrowUpDown className="ml-2 h-3 w-3" />
                   </Button>
                 </TableHead>
                 <TableHead>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => handleSort('name')}
                     className="hover:bg-transparent p-0 h-auto font-semibold"
                   >
                     Product Name
                     <ArrowUpDown className="ml-2 h-3 w-3" />
                   </Button>
                 </TableHead>
                <TableHead>Category</TableHead>
                 <TableHead>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => handleSort('barcode')}
                     className="hover:bg-transparent p-0 h-auto font-semibold"
                   >
                     Barcode
                     <ArrowUpDown className="ml-2 h-3 w-3" />
                   </Button>
                 </TableHead>
                 <TableHead className="text-right">
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => handleSort('qty')}
                     className="hover:bg-transparent p-0 h-auto font-semibold"
                   >
                     Available Qty
                     <ArrowUpDown className="ml-2 h-3 w-3" />
                   </Button>
                 </TableHead>
                <TableHead className="text-center w-32">No(s) of Copy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {sortedSKUs.map((sku) => {
                const isSelected = selectedProducts.has(sku.id);
                const copyCount = selectedProducts.get(sku.id) || 1;
                const hasBarcode = !!sku.barcode;

                return (
                  <TableRow
                    key={sku.id}
                    className={isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleProduct(sku.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{sku.sku_code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {sku.name}
                        {!hasBarcode && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            No Barcode
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sku.category_id || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {sku.barcode || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {sku.price_type === 'per_metre' 
                        ? `${sku.length_metres || 0}m`
                        : `${sku.quantity || 0} pcs`
                      }
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max="999"
                        value={isSelected ? copyCount : 0}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          if (value > 0 && !isSelected) {
                            onToggleProduct(sku.id);
                          }
                          onUpdateCopyCount(sku.id, value);
                        }}
                        className="w-20 text-center"
                        disabled={!hasBarcode}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}