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
  shop_id: string;
  created_at: string;
  updated_at: string;
}

export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, isOwner } = useAuth();

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: currentShopId, error: currentShopErr } = await supabase.rpc('current_shop_id');
      if (currentShopErr) {
        console.error('Error fetching current shop id:', currentShopErr);
        return;
      }

      if (!currentShopId) {
        setSettings(null);
        setShopId(null);
        return;
      }

      setShopId(currentShopId);

      const [{ data: shopSettingsRow, error: settingsErr }, { data: shopRow, error: shopErr }] =
        await Promise.all([
          supabase
            .from('shop_settings')
            .select('*')
            .eq('shop_id', currentShopId)
            .limit(1)
            .maybeSingle(),
          supabase.from('shops').select('id,name').eq('id', currentShopId).maybeSingle(),
        ]);

      if (settingsErr) {
        console.error('Error fetching shop settings:', settingsErr);
        return;
      }
      if (shopErr) {
        console.error('Error fetching shop name:', shopErr);
        return;
      }

      // shop_name is canonical in shops.name (not stored in shop_settings)
      setSettings(
        shopSettingsRow
          ? {
              ...(shopSettingsRow as any),
              shop_id: shopSettingsRow.shop_id,
              shop_name: shopRow?.name ?? 'My Shop',
            }
          : null
      );
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

   // 1) Update canonical shop name in public.shops
   const nextShopName = updates.shop_name ?? settings?.shop_name;
   if (nextShopName && shopId) {
     const { error: shopUpdateErr } = await supabase
       .from('shops')
       .update({ name: nextShopName })
       .eq('id', shopId);

     if (shopUpdateErr) {
       console.error('Error updating shop name:', shopUpdateErr);
       toast({
         title: 'Error',
         description: 'Failed to update shop name',
         variant: 'destructive',
       });
       return null;
     }
   }

   // 2) Update shop_settings (excluding shop_name, which is not stored here)
   const { shop_name: _ignoredShopName, ...rest } = updates;
   const upsertPayload = {
     id: settings?.id,
     shop_id: shopId ?? (settings as any)?.shop_id,
     ...rest,
   };

   const { data, error } = await supabase
     .from('shop_settings')
     .upsert(upsertPayload as any, {
       onConflict: 'id',
     })
     .select()
     .single();

   if (error) {
     console.error('Error saving shop settings:', error);
     toast({
       title: 'Error',
       description: 'Failed to save shop settings',
       variant: 'destructive',
     });
     return null;
   }

   setSettings({ ...(data as any), shop_name: nextShopName ?? 'My Shop' });
  toast({
    title: 'Success',
    description: 'Shop settings saved',
  });

   return { ...(data as any), shop_name: nextShopName ?? 'My Shop' };
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
