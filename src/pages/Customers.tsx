import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CustomerCard } from '@/components/customers/CustomerCard';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { CustomerPaymentDialog } from '@/components/customers/CustomerPaymentDialog';
import { CustomerQuickViewPanel } from '@/components/customers/CustomerQuickViewPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { useAuth } from '@/hooks/useAuth';

export default function Customers() {
  const { isOwner } = useAuth();
  const navigate = useNavigate();
 const { customers, isLoading, createCustomer, updateCustomer, archiveCustomer, fetchCustomers } = useCustomers();
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.city?.toLowerCase().includes(q)
    );
  }, [customers, search]);

 const handleArchive = async (customer: Customer) => {
   if (
     confirm(
       `Archive customer "${customer.name}"?\n\n` +
         `This will hide the customer from your list. ` +
         `Note: Customers with outstanding dues, advance balance, or transaction history cannot be archived.`
     )
   ) {
     await archiveCustomer(customer.id);
   }
 };

  const handlePaymentSuccess = () => {
    fetchCustomers(); // Refresh customer list to update balances
  };

  const handleViewLedger = (customer: Customer) => {
    navigate(`/customers/${customer.id}/ledger`);
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="text-lg text-muted-foreground">
            {search ? 'No customers found' : 'No customers yet'}
          </p>
          <p className="text-sm text-muted-foreground">
            {search ? 'Try a different search term' : 'Add your first customer to get started'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_420px]">
          <div className="grid gap-3">
            <AnimatePresence>
              {filtered.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onSelect={setSelectedCustomer}
                  onEdit={setEditingCustomer}
                  onDelete={isOwner ? handleArchive : undefined}
                  onReceivePayment={setPaymentCustomer}
                  onViewLedger={handleViewLedger}
                />
              ))}
            </AnimatePresence>
          </div>

          <div className="md:sticky md:top-20 h-fit">
            <CustomerQuickViewPanel
              customer={selectedCustomer}
              onRefreshCustomerList={fetchCustomers}
            />
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <CustomerForm
        open={showForm || !!editingCustomer}
        onClose={() => {
          setShowForm(false);
          setEditingCustomer(null);
        }}
        onSubmit={
          editingCustomer
            ? (data) => updateCustomer(editingCustomer.id, data)
            : createCustomer
        }
        customer={editingCustomer}
      />

      {/* Payment Dialog */}
      {paymentCustomer && (
        <CustomerPaymentDialog
          open={!!paymentCustomer}
          onClose={() => setPaymentCustomer(null)}
          customer={paymentCustomer}
          onSuccess={handlePaymentSuccess}
        />
      )}

    </AppLayout>
  );
}
