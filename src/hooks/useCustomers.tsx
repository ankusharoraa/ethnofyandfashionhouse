import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export interface Customer {
  id: string;
  name: string;
  name_hindi: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  total_purchases: number;
  outstanding_balance: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
       .eq('is_deleted', false)
        .order('name');

      if (error) {
        console.error('Error fetching customers:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch customers',
          variant: 'destructive',
        });
        return;
      }

      setCustomers(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  const createCustomer = async (customer: Partial<Customer>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: customer.name!,
        name_hindi: customer.name_hindi,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        notes: customer.notes,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create customer',
        variant: 'destructive',
      });
      return null;
    }

    setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    toast({
      title: 'Success',
      description: 'Customer created successfully',
    });
    return data;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update customer',
        variant: 'destructive',
      });
      return null;
    }

    setCustomers((prev) => prev.map((c) => (c.id === id ? data : c)));
    toast({
      title: 'Success',
      description: 'Customer updated successfully',
    });
    return data;
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete customer',
        variant: 'destructive',
      });
      return false;
    }

    setCustomers((prev) => prev.filter((c) => c.id !== id));
    toast({
      title: 'Deleted',
      description: 'Customer deleted successfully',
    });
    return true;
  };

  const findByPhone = async (phone: string) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error finding customer by phone:', error);
      return null;
    }

    return data as Customer;
  };

  const searchCustomers = (query: string) => {
    if (!query) return customers;
    const q = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.city?.toLowerCase().includes(q)
    );
  };

  const updateBalance = async (id: string, amount: number, isPayment = false) => {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return null;

    const updates = isPayment
      ? { outstanding_balance: customer.outstanding_balance - amount }
      : {
          total_purchases: customer.total_purchases + amount,
          outstanding_balance: customer.outstanding_balance + amount,
        };

    return updateCustomer(id, updates);
  };

 const archiveCustomer = async (id: string) => {
   const { data, error } = await supabase.rpc('soft_delete_customer', {
     p_customer_id: id,
   }) as { data: { success: boolean; error?: string } | null; error: any };

   if (error) {
     console.error('Error archiving customer:', error);
     toast({
       title: 'Error',
       description: error.message || 'Failed to archive customer',
       variant: 'destructive',
     });
     return false;
   }

   if (!data || !data.success) {
     toast({
       title: 'Cannot Archive',
       description: data?.error || 'Customer cannot be archived',
       variant: 'destructive',
     });
     return false;
   }

   // Refresh the list to hide the archived customer
   await fetchCustomers();
   toast({
     title: 'Archived',
     description: 'Customer archived successfully',
   });
   return true;
 };

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  return {
    customers,
    isLoading,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
   archiveCustomer,
    findByPhone,
    searchCustomers,
    updateBalance,
  };
}
