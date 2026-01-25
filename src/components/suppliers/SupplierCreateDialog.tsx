import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import type { Supplier } from '@/hooks/useSuppliers';

interface SupplierCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: Partial<Supplier>) => Promise<Supplier | null>;
  onCreated?: (supplier: Supplier) => void;
}

export function SupplierCreateDialog({
  open,
  onClose,
  onCreate,
  onCreated,
}: SupplierCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Supplier</DialogTitle>
        </DialogHeader>

        <SupplierForm
          onCancel={onClose}
          onSubmit={async (data) => {
            const created = await onCreate(data);
            if (created) {
              onCreated?.(created);
              onClose();
            }
            return created;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
