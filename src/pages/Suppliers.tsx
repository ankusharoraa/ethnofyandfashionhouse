import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Building2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SupplierCard } from '@/components/suppliers/SupplierCard';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import { SupplierPaymentDialog } from '@/components/suppliers/SupplierPaymentDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useSuppliers, type Supplier } from '@/hooks/useSuppliers';
import { useAuth } from '@/hooks/useAuth';
import type { PaymentMethod } from '@/hooks/useBilling';

export default function Suppliers() {
  const { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier, recordPayment, searchSuppliers } = useSuppliers();
  const { isOwner } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredSuppliers = searchSuppliers(searchQuery);

  const handleSubmit = async (data: Partial<Supplier>) => {
    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, data);
    } else {
      await createSupplier(data);
    }
    setShowForm(false);
    setEditingSupplier(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this supplier?')) {
      await deleteSupplier(id);
    }
  };

  const handlePayment = async (amount: number, method: PaymentMethod, notes?: string) => {
    if (!payingSupplier) return;
    setIsProcessing(true);
    try {
      await recordPayment(payingSupplier.id, amount, method, notes);
      setPayingSupplier(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <Button onClick={() => { setEditingSupplier(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Supplier
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <AnimatePresence mode="wait">
          {showForm ? (
            <SupplierForm
              key="form"
              supplier={editingSupplier}
              onSubmit={handleSubmit}
              onCancel={() => { setShowForm(false); setEditingSupplier(null); }}
            />
          ) : (
            <motion.div key="list" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSuppliers.length === 0 ? (
                <Card className="col-span-full p-12 text-center">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="text-lg text-muted-foreground">No suppliers found</p>
                </Card>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onEdit={(s) => { setEditingSupplier(s); setShowForm(true); }}
                    onDelete={isOwner ? handleDelete : undefined}
                    onPayment={setPayingSupplier}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SupplierPaymentDialog
        open={!!payingSupplier}
        onClose={() => setPayingSupplier(null)}
        supplier={payingSupplier}
        onConfirm={handlePayment}
        isProcessing={isProcessing}
      />
    </AppLayout>
  );
}
