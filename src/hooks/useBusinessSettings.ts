import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { COMPANY } from '@/config/company';

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
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          name: data.name || DEFAULT_SETTINGS.name,
          fullName: data.full_name || DEFAULT_SETTINGS.fullName,
          tagline: data.tagline || DEFAULT_SETTINGS.tagline,
          address: data.address || DEFAULT_SETTINGS.address,
          city: data.city || DEFAULT_SETTINGS.city,
          phone: data.phone || DEFAULT_SETTINGS.phone,
          email: data.email || DEFAULT_SETTINGS.email,
          website: data.website || DEFAULT_SETTINGS.website,
          tax_id: data.tax_id || DEFAULT_SETTINGS.tax_id,
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
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
        const payload = {
          user_id: user.id,
          name: updates.name ?? settings.name,
          full_name: updates.fullName ?? settings.fullName,
          tagline: updates.tagline ?? settings.tagline,
          address: updates.address ?? settings.address,
          city: updates.city ?? settings.city,
          phone: updates.phone ?? settings.phone,
          email: updates.email ?? settings.email,
          website: updates.website ?? settings.website,
          tax_id: updates.tax_id ?? settings.tax_id,
        };

        // Upsert: insert if not exists, update if it does
        const { data, error } = await supabase
          .from('business_settings')
          .upsert(
            { ...payload },
            { onConflict: 'user_id' }
          )
          .select()
          .single();

        if (error) throw error;

        setSettings({
          id: data.id,
          name: data.name,
          fullName: data.full_name || '',
          tagline: data.tagline || '',
          address: data.address,
          city: data.city,
          phone: data.phone,
          email: data.email,
          website: data.website,
          tax_id: data.tax_id,
        });

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
