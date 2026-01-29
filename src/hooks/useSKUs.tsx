import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export interface SKU {
  id: string;
  sku_code: string;
  barcode: string | null;
  name: string;
  parent_sku_id?: string | null;
  color?: string | null;
  base_name?: string | null;
  // Kept for backward compatibility with existing DB column, but intentionally unused in UI.
  name_hindi: string | null;
  description: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  price_type: 'per_metre' | 'fixed';
  rate: number | null;
  fixed_price: number | null;
  purchase_rate?: number | null;
  purchase_fixed_price?: number | null;
  quantity: number;
  length_metres: number;
  low_stock_threshold: number;
  image_url: string | null;
  hsn_code?: string | null;
  gst_rate?: number;
  sync_status: 'synced' | 'pending' | 'offline';
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  categories?: { name: string; name_hindi: string | null } | null;
  subcategories?: { name: string; name_hindi: string | null } | null;
}

export interface Category {
  id: string;
  name: string;
  name_hindi: string | null;
  description: string | null;
  icon: string | null;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  name_hindi: string | null;
}

export function useSKUs() {
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data || []);
  };

  const fetchSubcategories = async () => {
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching subcategories:', error);
      return;
    }

    setSubcategories(data || []);
  };

  const fetchSKUs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('skus')
        .select(`
          *,
          categories(name, name_hindi),
          subcategories(name, name_hindi)
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching SKUs:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch inventory',
          variant: 'destructive',
        });
        return;
      }

      setSKUs(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  const createSKU = async (sku: Partial<SKU>) => {
    const insertData = {
      sku_code: sku.sku_code!,
      name: sku.name!,
      barcode: sku.barcode,
      parent_sku_id: sku.parent_sku_id ?? null,
      color: sku.color ?? null,
      base_name: sku.base_name ?? null,
      // We no longer capture Hindi name in the UI; keep existing DB values intact by inserting null.
      name_hindi: null,
      description: sku.description,
      category_id: sku.category_id,
      subcategory_id: sku.subcategory_id,
      price_type: sku.price_type || 'fixed',
      rate: sku.rate,
      fixed_price: sku.fixed_price,
      purchase_rate: sku.purchase_rate ?? null,
      purchase_fixed_price: sku.purchase_fixed_price ?? null,
      quantity: sku.quantity || 0,
      length_metres: sku.length_metres || 0,
      low_stock_threshold: sku.low_stock_threshold || 5,
      hsn_code: sku.hsn_code ?? null,
      gst_rate: sku.gst_rate ?? 0,
      created_by: user?.id,
      updated_by: user?.id,
    };

    const { data, error } = await supabase
      .from('skus')
      .insert(insertData)
      .select(`
        *,
        categories(name, name_hindi),
        subcategories(name, name_hindi)
      `)
      .single();

    if (error) {
      console.error('Error creating SKU:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create SKU',
        variant: 'destructive',
      });
      return null;
    }

    setSKUs((prev) => [data, ...prev]);
    toast({
      title: 'Success',
      description: 'SKU created successfully',
    });
    return data;
  };

  const updateSKU = async (id: string, updates: Partial<SKU>) => {
    // Avoid overwriting existing Hindi name (we don't edit it anymore).
    // If something explicitly passes name_hindi we still ignore it.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name_hindi, ...safeUpdates } = updates as any;
    const { data, error } = await supabase
      .from('skus')
      .update({
        ...safeUpdates,
        updated_by: user?.id,
      })
      .eq('id', id)
      .select(`
        *,
        categories(name, name_hindi),
        subcategories(name, name_hindi)
      `)
      .single();

    if (error) {
      console.error('Error updating SKU:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update SKU',
        variant: 'destructive',
      });
      return null;
    }

    setSKUs((prev) => prev.map((s) => (s.id === id ? data : s)));
    toast({
      title: 'Success',
      description: 'SKU updated successfully',
    });
    return data;
  };

  const deleteSKU = async (id: string) => {
    const { error } = await supabase
      .from('skus')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting SKU:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete SKU',
        variant: 'destructive',
      });
      return false;
    }

    setSKUs((prev) => prev.filter((s) => s.id !== id));
    toast({
      title: 'Deleted',
      description: 'SKU deleted successfully',
    });
    return true;
  };

  const updateStock = async (
    id: string,
    quantity?: number,
    lengthMetres?: number,
    notes?: string
  ) => {
    const currentSKU = skus.find((s) => s.id === id);
    if (!currentSKU) return null;

    // Log the inventory change
    await supabase.from('inventory_logs').insert({
      sku_id: id,
      previous_quantity: currentSKU.quantity,
      new_quantity: quantity ?? currentSKU.quantity,
      previous_length: currentSKU.length_metres,
      new_length: lengthMetres ?? currentSKU.length_metres,
      change_type: 'manual_update',
      notes,
      changed_by: user?.id,
    });

    return updateSKU(id, {
      quantity: quantity ?? currentSKU.quantity,
      length_metres: lengthMetres ?? currentSKU.length_metres,
    });
  };

  const findByBarcode = async (barcode: string) => {
    const { data, error } = await supabase
      .from('skus')
      .select(`
        *,
        categories(name, name_hindi),
        subcategories(name, name_hindi)
      `)
      .eq('barcode', barcode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error finding SKU by barcode:', error);
      return null;
    }

    return data as SKU;
  };

  const getLowStockItems = () => {
    return skus.filter((sku) => {
      if (sku.price_type === 'per_metre') {
        return sku.length_metres < sku.low_stock_threshold;
      }
      return sku.quantity < sku.low_stock_threshold;
    });
  };

  const variantSkus = skus.filter((s) => !!s.parent_sku_id);
  const baseSkus = skus.filter((s) => !s.parent_sku_id);

  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchSubcategories();
      fetchSKUs();
    }
  }, [user]);

  return {
    skus,
    variantSkus,
    baseSkus,
    categories,
    subcategories,
    isLoading,
    fetchSKUs,
    createSKU,
    updateSKU,
    deleteSKU,
    updateStock,
    findByBarcode,
    getLowStockItems,
    fetchCategories,
    fetchSubcategories,
  };
}
