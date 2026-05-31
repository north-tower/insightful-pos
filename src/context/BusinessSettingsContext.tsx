import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useBusinessSettings, BusinessSettings } from '@/hooks/useBusinessSettings';
import { useAuth } from '@/context/AuthContext';
import { DEMO_BRANDING, getDemoLogoUrl } from '@/lib/demoMode';

// Re-export for convenience
export type { BusinessSettings };

interface BusinessSettingsContextType {
  /** The company / business settings object */
  settings: BusinessSettings;
  /** True while the initial fetch is in progress */
  loading: boolean;
  /** Persist changes to the database */
  saveSettings: (updates: Partial<BusinessSettings>) => Promise<void>;
  /** Re-fetch from the database */
  refetch: () => Promise<void>;
  /** Shortcut: the company name (empty string if not yet set) */
  companyName: string;
  /** Shop logo URL when in demo mode (Top Ranch) */
  shopLogoUrl: string | null;
  /** Last time business settings snapshot was synced */
  lastSyncedAt: string | null;
}

const BusinessSettingsContext = createContext<BusinessSettingsContextType | undefined>(undefined);

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const { settings, loading, saveSettings, refetch, lastSyncedAt } = useBusinessSettings();
  const { isDemo } = useAuth();

  const effectiveSettings = useMemo<BusinessSettings>(() => {
    if (!isDemo) return settings;
    return {
      ...settings,
      name: DEMO_BRANDING.name,
      fullName: DEMO_BRANDING.name,
      tagline: DEMO_BRANDING.tagline,
    };
  }, [settings, isDemo]);

  const companyName = isDemo ? DEMO_BRANDING.name : settings.name || '';
  const shopLogoUrl = isDemo ? getDemoLogoUrl() : null;

  return (
    <BusinessSettingsContext.Provider
      value={{
        settings: effectiveSettings,
        loading,
        saveSettings,
        refetch,
        companyName,
        shopLogoUrl,
        lastSyncedAt,
      }}
    >
      {children}
    </BusinessSettingsContext.Provider>
  );
}

/**
 * Access the company / business settings from any component.
 *
 * Usage:
 *   const { companyName, settings } = useCompanySettings();
 */
export function useCompanySettings() {
  const context = useContext(BusinessSettingsContext);
  if (!context) {
    throw new Error('useCompanySettings must be used within a BusinessSettingsProvider');
  }
  return context;
}
