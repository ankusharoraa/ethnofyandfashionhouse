import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export interface ShopSettings {
  id: string;
  shop_name: string;
  shop_name_hindi: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  logo_url: string | null;
  tagline: string | null;
  terms_and_conditions: string | null;
  created_at: string;
  updated_at: string;
}

export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, isOwner } = useAuth();

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching shop settings:', error);
        return;
      }

      setSettings(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = async (updates: Partial<ShopSettings>) => {
    if (!isOwner) {
      toast({
        title: 'Permission Denied',
        description: 'Only owners can update shop settings',
        variant: 'destructive',
      });
      return null;
    }

    if (!settings) {
      // Create new settings
      const { data, error } = await supabase
        .from('shop_settings')
        .insert({
          shop_name: updates.shop_name || 'My Shop',
          ...updates,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating shop settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to save shop settings',
          variant: 'destructive',
        });
        return null;
      }

      setSettings(data);
      toast({
        title: 'Success',
        description: 'Shop settings saved',
      });
      return data;
    }

    // Update existing settings
    const { data, error } = await supabase
      .from('shop_settings')
      .update(updates)
      .eq('id', settings.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating shop settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update shop settings',
        variant: 'destructive',
      });
      return null;
    }

    setSettings(data);
    toast({
      title: 'Success',
      description: 'Shop settings updated',
    });
    return data;
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user, fetchSettings]);

  return {
    settings,
    isLoading,
    fetchSettings,
    updateSettings,
  };
}
