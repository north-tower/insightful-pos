import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { BUSINESS_CONFIGS } from '@/types/business';
import type { BusinessMode, BusinessConfig } from '@/types/business';

// Re-export types so existing imports from this file still work
export type { BusinessMode, BusinessConfig };
export { BUSINESS_CONFIGS };

// ─── Context ──────────────────────────────────────────────────────────────────

interface BusinessModeContextType {
  mode: BusinessMode;
  config: BusinessConfig;
  setMode: (mode: BusinessMode) => void;
  isRestaurant: boolean;
  isRetail: boolean;
  isSetup: boolean; // true if user hasn't picked a mode yet (only during signup flow)
  t: BusinessConfig['terminology']; // shortcut for terminology
}

const BusinessModeContext = createContext<BusinessModeContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface BusinessModeProviderProps {
  children: ReactNode;
}

export function BusinessModeProvider({ children }: BusinessModeProviderProps) {
  const { user, isAuthenticated } = useAuth();

  // The mode is primarily driven by the authenticated user's profile.
  // We keep a local override so mode selection during signup can work
  // before the profile is saved.
  const [localOverride, setLocalOverride] = useState<BusinessMode | null>(null);

  // Resolve the active mode:
  // 1. Local override (set during signup flow before profile exists)
  // 2. User's profile business_mode (from Supabase)
  // 3. null → means we need the mode selector (isSetup)
  const resolvedMode: BusinessMode | null = localOverride ?? user?.business_mode ?? null;

  // When user logs in / profile loads, clear any local override
  // so the profile becomes the source of truth.
  useEffect(() => {
    if (isAuthenticated && user?.business_mode) {
      setLocalOverride(null);
    }
  }, [isAuthenticated, user?.business_mode]);

  const setMode = useCallback(
    async (newMode: BusinessMode) => {
      setLocalOverride(newMode);

      // If the user is authenticated, persist the mode change to the profile.
      if (isAuthenticated && user) {
        await supabase
          .from('profiles')
          .update({ business_mode: newMode })
          .eq('id', user.id);
      }
    },
    [isAuthenticated, user]
  );

  const isSetup = isAuthenticated && resolvedMode === null;
  const activeMode = resolvedMode ?? 'restaurant'; // fallback for config access
  const config = BUSINESS_CONFIGS[activeMode];

  return (
    <BusinessModeContext.Provider
      value={{
        mode: activeMode,
        config,
        setMode,
        isRestaurant: activeMode === 'restaurant',
        isRetail: activeMode === 'retail',
        isSetup,
        t: config.terminology,
      }}
    >
      {children}
    </BusinessModeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBusinessMode() {
  const context = useContext(BusinessModeContext);
  if (!context) {
    throw new Error('useBusinessMode must be used within a BusinessModeProvider');
  }
  return context;
}
