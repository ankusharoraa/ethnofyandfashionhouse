import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';
import type { SKU } from './useSKUs';

export type InvoiceStatus = 'draft' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit';
export type InvoiceType = 'sale' | 'purchase' | 'return';

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  price_type: 'per_metre' | 'fixed';
  rate: number | null;
  quantity: number;
  length_metres: number;
  unit_price: number;
  line_total: number;
  // Snapshot pricing for profit reporting
  cost_price?: number | null;
  sell_price?: number | null;
  // For UI purposes
  sku?: SKU;
  availableStock?: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  parent_invoice_id: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  pending_amount: number;
  returned_amount: number;
  payment_method: PaymentMethod;
  status: InvoiceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  invoice_items?: InvoiceItem[];
}

export function useBilling() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch all invoices
  const fetchInvoices = async (type?: InvoiceType) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          invoice_items(*)
        `)
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('invoice_type', type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching invoices:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch invoices',
          variant: 'destructive',
        });
        return;
      }

      setInvoices(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate invoice number
  const generateInvoiceNumber = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_invoice_number');
    
    if (error) {
      console.error('Error generating invoice number:', error);
      // Fallback to client-side generation
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      return `INV-${dateStr}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    }
    
    return data;
  };

  // Add item to cart
  const addToCart = useCallback((sku: SKU, quantity?: number, lengthMetres?: number) => {
    const availableStock = sku.price_type === 'per_metre' ? sku.length_metres : sku.quantity;
    
    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => item.sku_id === sku.id);
      
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...prev];
        const existing = updated[existingIndex];
        
        if (sku.price_type === 'per_metre') {
          const newLength = (existing.length_metres || 0) + (lengthMetres || 1);
          const pricePerMetre = existing.rate ?? existing.unit_price ?? 0;
          updated[existingIndex] = {
            ...existing,
            length_metres: newLength,
            line_total: pricePerMetre * newLength,
          };
        } else {
          const newQty = (existing.quantity || 0) + (quantity || 1);
          const pricePerUnit = existing.unit_price ?? 0;
          updated[existingIndex] = {
            ...existing,
            quantity: newQty,
            line_total: pricePerUnit * newQty,
          };
        }
        
        return updated;
      }
      
      // Add new item
      const unitPrice = sku.price_type === 'per_metre' ? (sku.rate || 0) : (sku.fixed_price || 0);
      const snapshotCost = sku.price_type === 'per_metre'
        ? (sku.purchase_rate ?? null)
        : (sku.purchase_fixed_price ?? null);
      // Default to a sensible non-zero quantity/length so both sales + purchase flows work smoothly.
      const qty = quantity ?? (sku.price_type === 'fixed' ? 1 : 0);
      const len = lengthMetres ?? (sku.price_type === 'per_metre' ? 1 : 0);
      
      const newItem: InvoiceItem = {
        sku_id: sku.id,
        sku_code: sku.sku_code,
        sku_name: sku.name,
        price_type: sku.price_type,
        rate: sku.rate,
        quantity: qty,
        length_metres: len,
        unit_price: unitPrice,
        line_total: sku.price_type === 'per_metre' ? unitPrice * len : unitPrice * qty,
        cost_price: snapshotCost,
        sku,
        availableStock,
      };
      
      return [...prev, newItem];
    });
  }, []);

  // Update cart item
  const updateCartItem = useCallback((skuId: string, updates: Partial<InvoiceItem>) => {
    setCartItems(prev => prev.map(item => {
      if (item.sku_id !== skuId) return item;
      
      const updated = { ...item, ...updates };
      
      // Recalculate line total
      if (updated.price_type === 'per_metre') {
        updated.line_total = (updated.rate || 0) * (updated.length_metres || 0);
      } else {
        updated.line_total = (updated.unit_price || 0) * (updated.quantity || 0);
      }
      
      return updated;
    }));
  }, []);

  // Remove item from cart
  const removeFromCart = useCallback((skuId: string) => {
    setCartItems(prev => prev.filter(item => item.sku_id !== skuId));
  }, []);

  // Clear cart
  const clearCart = useCallback(() => {
    setCartItems([]);
    setCurrentInvoice(null);
  }, []);

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.line_total, 0);
    return {
      subtotal,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: subtotal,
    };
  }, [cartItems]);

  // Create draft invoice (sales or purchase)
  const createDraftInvoice = async (
    invoiceType: InvoiceType = 'sale',
    customerName?: string,
    customerPhone?: string,
    supplierId?: string,
    supplierName?: string,
    customerId?: string
  ) => {
    // Ensure we have a valid session before inserting
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      console.error('Session error:', sessionError);
      toast({
        title: 'Session Expired',
        description: 'Please refresh the page and try again',
        variant: 'destructive',
      });
      return null;
    }
    
    const invoiceNumber = await generateInvoiceNumber();
    const totals = calculateTotals();
    
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_type: invoiceType,
        customer_id: customerId || null,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        supplier_id: supplierId || null,
        supplier_name: supplierName || null,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
        status: 'draft',
        created_by: session.user.id,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      toast({
        title: 'Error',
        description: invoiceError.code === '42501' 
          ? 'Session expired. Please refresh the page.' 
          : 'Failed to create invoice',
        variant: 'destructive',
      });
      return null;
    }

    // Insert invoice items
    const itemsToInsert = cartItems.map(item => ({
      invoice_id: invoice.id,
      sku_id: item.sku_id,
      sku_code: item.sku_code,
      sku_name: item.sku_name,
      price_type: item.price_type,
      rate: item.rate,
      quantity: item.quantity,
      length_metres: item.length_metres,
      unit_price: item.unit_price,
      line_total: item.line_total,
      cost_price: item.cost_price ?? null,
      sell_price: item.sell_price ?? null,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating invoice items:', itemsError);
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id);
      toast({
        title: 'Error',
        description: 'Failed to create invoice items',
        variant: 'destructive',
      });
      return null;
    }

    setCurrentInvoice(invoice);
    return invoice;
  };

  // Complete sales invoice (atomically deducts stock)
  const completeInvoice = async (
    invoiceId: string,
    paymentMethod: PaymentMethod = 'cash',
    customerId?: string,
    amountPaid?: number
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('complete_invoice', {
      p_invoice_id: invoiceId,
      p_payment_method: paymentMethod,
      p_amount_paid: amountPaid ?? null,
      p_customer_id: customerId || null,
    });

    if (error) {
      console.error('Error completing invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete invoice',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; message?: string };
    
    if (!result.success) {
      toast({
        title: 'Error',
        description: result.error || 'Failed to complete invoice',
        variant: 'destructive',
      });
      return { success: false, error: result.error };
    }

    toast({
      title: 'Success!',
      description: 'Bill generated and stock updated',
    });

    clearCart();
    await fetchInvoices();
    
    return { success: true };
  };

  // Complete purchase invoice (atomically adds stock)
  const completePurchaseInvoice = async (
    invoiceId: string,
    paymentMethod: PaymentMethod = 'cash',
    amountPaid: number = 0
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('complete_purchase_invoice', {
      p_invoice_id: invoiceId,
      p_payment_method: paymentMethod,
      p_amount_paid: amountPaid,
    });

    if (error) {
      console.error('Error completing purchase invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete purchase invoice',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; message?: string };
    
    if (!result.success) {
      toast({
        title: 'Error',
        description: result.error || 'Failed to complete purchase invoice',
        variant: 'destructive',
      });
      return { success: false, error: result.error };
    }

    toast({
      title: 'Success!',
      description: 'Purchase bill completed and stock updated',
    });

    clearCart();
    await fetchInvoices();
    
    return { success: true };
  };

  // Cancel sales invoice (restores stock if completed)
  const cancelInvoice = async (invoiceId: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('cancel_invoice', {
      p_invoice_id: invoiceId,
    });

    if (error) {
      console.error('Error cancelling invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel invoice',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; message?: string };
    
    if (!result.success) {
      toast({
        title: 'Error',
        description: result.error || 'Failed to cancel invoice',
        variant: 'destructive',
      });
      return { success: false, error: result.error };
    }

    toast({
      title: 'Cancelled',
      description: 'Invoice cancelled and stock restored',
    });

    await fetchInvoices();
    
    return { success: true };
  };

  // Cancel purchase invoice (restores stock if completed)
  const cancelPurchaseInvoice = async (invoiceId: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('cancel_purchase_invoice', {
      p_invoice_id: invoiceId,
    });

    if (error) {
      console.error('Error cancelling purchase invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel purchase invoice',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; message?: string };
    
    if (!result.success) {
      toast({
        title: 'Error',
        description: result.error || 'Failed to cancel purchase invoice',
        variant: 'destructive',
      });
      return { success: false, error: result.error };
    }

    toast({
      title: 'Cancelled',
      description: 'Purchase invoice cancelled and stock restored',
    });

    await fetchInvoices();
    
    return { success: true };
  };

  // Quick bill: create and complete sales in one step
  const createAndCompleteBill = async (
    customerName?: string,
    customerPhone?: string,
    paymentMethod: PaymentMethod = 'cash',
    customerId?: string,
    amountPaid?: number
  ) => {
    // Validate cart
    if (cartItems.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Add items to the bill first',
        variant: 'destructive',
      });
      return null;
    }

    // Calculate total for validation
    const totals = calculateTotals();
    const effectivePaid = paymentMethod === 'credit' ? 0 : (amountPaid ?? totals.totalAmount);
    const pendingAmount = totals.totalAmount - effectivePaid;

    // Credit or partial payment requires a customer
    if ((paymentMethod === 'credit' || pendingAmount > 0) && !customerId) {
      toast({
        title: 'Customer Required',
        description: 'Credit or partial payment requires selecting an existing customer',
        variant: 'destructive',
      });
      return null;
    }

    // Validate stock availability
    for (const item of cartItems) {
      if (!item.sku) continue;
      
      const available = item.price_type === 'per_metre' 
        ? item.sku.length_metres 
        : item.sku.quantity;
      const required = item.price_type === 'per_metre' 
        ? item.length_metres 
        : item.quantity;

      if (available < required) {
        toast({
          title: 'Insufficient Stock',
          description: `${item.sku_name}: Available ${available}, Required ${required}`,
          variant: 'destructive',
        });
        return null;
      }
    }

    // Create draft invoice
    const invoice = await createDraftInvoice('sale', customerName, customerPhone, undefined, undefined, customerId);
    if (!invoice) return null;

    // Complete the invoice (atomic stock update)
    const result = await completeInvoice(invoice.id, paymentMethod, customerId, amountPaid);
    
    if (!result.success) {
      return null;
    }

    return invoice;
  };

  // Quick purchase bill: create and complete purchase in one step
  const createAndCompletePurchaseBill = async (
    supplierId: string,
    supplierName: string,
    paymentMethod: PaymentMethod = 'cash',
    amountPaid: number = 0
  ) => {
    // Validate cart
    if (cartItems.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Add items to the purchase bill first',
        variant: 'destructive',
      });
      return null;
    }

    // Create draft purchase invoice
    const invoice = await createDraftInvoice('purchase', undefined, undefined, supplierId, supplierName);
    if (!invoice) return null;

    // Complete the purchase invoice (atomic stock update)
    const result = await completePurchaseInvoice(invoice.id, paymentMethod, amountPaid);
    
    if (!result.success) {
      return null;
    }

    return invoice;
  };

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  return {
    invoices,
    currentInvoice,
    cartItems,
    isLoading,
    fetchInvoices,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    calculateTotals,
    createDraftInvoice,
    completeInvoice,
    completePurchaseInvoice,
    cancelInvoice,
    cancelPurchaseInvoice,
    createAndCompleteBill,
    createAndCompletePurchaseBill,
    generateInvoiceNumber,
  };
}
