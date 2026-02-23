import { createContext, useContext, ReactNode } from 'react';
import { useBusinessSettings, BusinessSettings } from '@/hooks/useBusinessSettings';

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
}

const BusinessSettingsContext = createContext<BusinessSettingsContextType | undefined>(undefined);

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const { settings, loading, saveSettings, refetch } = useBusinessSettings();

  return (
    <BusinessSettingsContext.Provider
      value={{
        settings,
        loading,
        saveSettings,
        refetch,
        companyName: settings.name || '',
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
