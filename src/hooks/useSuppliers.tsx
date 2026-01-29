import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';
import type { PaymentMethod } from './useBilling';

export interface Supplier {
  id: string;
  name: string;
  name_hindi: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state?: string | null;
  gstin: string | null;
  notes: string | null;
  total_purchases: number;
  total_paid: number;
  outstanding_balance: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  payment_date: string;
  created_by: string | null;
  created_at: string;
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch suppliers',
          variant: 'destructive',
        });
        return;
      }

      setSuppliers(data || []);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchPayments = useCallback(async (supplierId?: string) => {
    try {
      let query = supabase
        .from('supplier_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching payments:', error);
        return;
      }

      setPayments(data || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  }, []);

  const createSupplier = async (supplier: Partial<Supplier>) => {
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: supplier.name!,
        name_hindi: supplier.name_hindi,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        city: supplier.city,
        state: supplier.state ?? null,
        gstin: supplier.gstin,
        notes: supplier.notes,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier:', error);
      toast({
        title: 'Error',
        description: 'Failed to create supplier',
        variant: 'destructive',
      });
      return null;
    }

    toast({
      title: 'Success',
      description: 'Supplier created successfully',
    });

    await fetchSuppliers();
    return data;
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: 'Error',
        description: 'Failed to update supplier',
        variant: 'destructive',
      });
      return null;
    }

    toast({
      title: 'Success',
      description: 'Supplier updated successfully',
    });

    await fetchSuppliers();
    return data;
  };

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete supplier',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Deleted',
      description: 'Supplier deleted successfully',
    });

    await fetchSuppliers();
    return true;
  };

  const recordPayment = async (
    supplierId: string,
    amount: number,
    paymentMethod: PaymentMethod = 'cash',
    notes?: string
  ) => {
    const { data, error } = await supabase.rpc('record_supplier_payment', {
      p_supplier_id: supplierId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_notes: notes,
    });

    if (error) {
      console.error('Error recording payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to record payment',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; message?: string };

    if (!result.success) {
      toast({
        title: 'Error',
        description: result.error || 'Failed to record payment',
        variant: 'destructive',
      });
      return { success: false, error: result.error };
    }

    toast({
      title: 'Success',
      description: 'Payment recorded successfully',
    });

    await fetchSuppliers();
    await fetchPayments(supplierId);
    return { success: true };
  };

  const searchSuppliers = useCallback((query: string) => {
    if (!query.trim()) return suppliers;
    
    const lowerQuery = query.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.name_hindi?.toLowerCase().includes(lowerQuery) ||
        s.phone?.includes(query) ||
        s.gstin?.toLowerCase().includes(lowerQuery)
    );
  }, [suppliers]);

  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user, fetchSuppliers]);

  return {
    suppliers,
    payments,
    isLoading,
    fetchSuppliers,
    fetchPayments,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    recordPayment,
    searchSuppliers,
  };
}
