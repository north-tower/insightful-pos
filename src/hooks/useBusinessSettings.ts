import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { COMPANY } from '@/config/company';
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/offline/cache';

export interface BusinessSettings {
  id?: string;
  name: string;
  fullName: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  tax_id: string;
}

/** Defaults sourced from the static config – used until the user saves their own. */
const DEFAULT_SETTINGS: BusinessSettings = {
  name: COMPANY.name,
  fullName: COMPANY.fullName,
  tagline: COMPANY.tagline,
  address: COMPANY.address,
  city: COMPANY.city,
  phone: COMPANY.phone,
  email: COMPANY.email,
  website: COMPANY.website,
  tax_id: COMPANY.taxId,
};

const businessSettingsCacheKey = (userId: string) => `snapshot:business-settings:${userId}`;

export function useBusinessSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const cacheKey = businessSettingsCacheKey(user.id);
    try {
      const cached = await getCachedSnapshot<BusinessSettings>(cacheKey);
      if (cached) {
        setSettings(cached);
        setLoading(false);
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cached) {
          setSettings(DEFAULT_SETTINGS);
        }
        return;
      }

      const [{ data, error }, { data: storeIdData }, ] = await Promise.all([
        supabase
        .from('business_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
        supabase.rpc('current_store_id'),
      ]);

      if (error) throw error;

      let storeName: string | null = null;
      if (storeIdData) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('name')
          .eq('id', storeIdData)
          .maybeSingle();
        storeName = storeData?.name || null;
      }

      if (data) {
        const effectiveName = storeName || data.name || DEFAULT_SETTINGS.name;
        const nextSettings = {
          id: data.id,
          name: effectiveName,
          fullName: effectiveName,
          tagline: data.tagline || DEFAULT_SETTINGS.tagline,
          address: data.address || DEFAULT_SETTINGS.address,
          city: data.city || DEFAULT_SETTINGS.city,
          phone: data.phone || DEFAULT_SETTINGS.phone,
          email: data.email || DEFAULT_SETTINGS.email,
          website: data.website || DEFAULT_SETTINGS.website,
          tax_id: data.tax_id || DEFAULT_SETTINGS.tax_id,
        };
        setSettings(nextSettings);
        await setCachedSnapshot<BusinessSettings>(cacheKey, nextSettings);
      } else {
        setSettings(DEFAULT_SETTINGS);
        await setCachedSnapshot<BusinessSettings>(cacheKey, DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Failed to fetch business settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(
    async (updates: Partial<BusinessSettings>) => {
      if (!user) return;
      try {
        const { data: storeIdData } = await supabase.rpc('current_store_id');
        const hasNameUpdate = updates.name !== undefined || updates.fullName !== undefined;
        const requestedStoreName = (updates.fullName ?? updates.name ?? '').trim();

        // Keep business name store-specific by writing into the active store record.
        if (hasNameUpdate && storeIdData && requestedStoreName) {
          const { error: storeErr } = await supabase
            .from('stores')
            .update({ name: requestedStoreName })
            .eq('id', storeIdData);
          if (storeErr) throw storeErr;
        }

        const payload = {
          user_id: user.id,
          // Name/full_name are derived from store name in this app flow.
          // Keep persisted values stable so store name is the source of truth.
          name: settings.name,
          full_name: settings.fullName,
          tagline: updates.tagline ?? settings.tagline,
          address: updates.address ?? settings.address,
          city: updates.city ?? settings.city,
          phone: updates.phone ?? settings.phone,
          email: updates.email ?? settings.email,
          website: updates.website ?? settings.website,
          tax_id: updates.tax_id ?? settings.tax_id,
        };

        const { data, error } = settings.id
          ? await supabase
              .from('business_settings')
              .update({ ...payload })
              .eq('id', settings.id)
              .select()
              .single()
          : await supabase
              .from('business_settings')
              .insert({ ...payload })
              .select()
              .single();

        if (error) throw error;

        const nextSettings = {
          id: data.id,
          name: requestedStoreName || data.name || settings.name,
          fullName: requestedStoreName || data.full_name || settings.fullName,
          tagline: data.tagline || '',
          address: data.address,
          city: data.city,
          phone: data.phone,
          email: data.email,
          website: data.website,
          tax_id: data.tax_id,
        };
        setSettings(nextSettings);
        await setCachedSnapshot<BusinessSettings>(businessSettingsCacheKey(user.id), nextSettings);

        toast.success('Business settings saved');
      } catch (err) {
        console.error('Failed to save business settings:', err);
        toast.error('Failed to save settings');
      }
    },
    [user, settings]
  );

  return { settings, loading, saveSettings, refetch: fetchSettings };
}
