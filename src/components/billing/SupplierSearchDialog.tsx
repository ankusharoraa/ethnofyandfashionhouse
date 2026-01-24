import { useState, useMemo } from 'react';
import { Search, Plus, User, Phone, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Supplier } from '@/hooks/useSuppliers';

interface SupplierSearchDialogProps {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onSelect: (supplier: Supplier) => void;
  onCreateNew?: () => void;
}

export function SupplierSearchDialog({
  open,
  onClose,
  suppliers,
  onSelect,
  onCreateNew,
}: SupplierSearchDialogProps) {
  const [search, setSearch] = useState('');

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    
    const lowerSearch = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerSearch) ||
        s.name_hindi?.toLowerCase().includes(lowerSearch) ||
        s.phone?.includes(search) ||
        s.gstin?.toLowerCase().includes(lowerSearch)
    );
  }, [suppliers, search]);

  const handleSelect = (supplier: Supplier) => {
    onSelect(supplier);
    setSearch('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Select Supplier
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[300px] -mx-6 px-6">
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No suppliers found</p>
              {onCreateNew && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={onCreateNew}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add New Supplier
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSuppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  className="w-full p-3 text-left rounded-lg border hover:bg-accent transition-colors"
                  onClick={() => handleSelect(supplier)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{supplier.name}</p>
                      {supplier.name_hindi && (
                        <p className="text-sm text-muted-foreground truncate">
                          {supplier.name_hindi}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {supplier.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {supplier.phone}
                          </span>
                        )}
                        {supplier.gstin && (
                          <span className="truncate">GSTIN: {supplier.gstin}</span>
                        )}
                      </div>
                    </div>
                    {supplier.outstanding_balance > 0 && (
                      <span className="text-sm text-destructive font-medium whitespace-nowrap">
                        ₹{supplier.outstanding_balance.toFixed(0)} due
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {onCreateNew && filteredSuppliers.length > 0 && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={onCreateNew}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Supplier
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}