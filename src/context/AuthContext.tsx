import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { BusinessMode } from '@/types/business';

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  business_mode: BusinessMode;
  business_name?: string;
}

interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  businessMode: BusinessMode;
}

interface AuthContextType {
  // State
  user: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInDemo: (role?: UserRole, businessMode?: BusinessMode) => void;

  // Role helpers
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isCashier: boolean;
}

// ─── Demo users (offline / no Supabase) ──────────────────────────────────────

function makeDemoUser(role: UserRole, businessMode: BusinessMode = 'restaurant'): UserProfile {
  const users: Record<UserRole, Omit<UserProfile, 'business_mode'>> = {
    admin: {
      id: 'demo-admin',
      email: 'admin@nexus.pos',
      full_name: 'Mike Munene',
      role: 'admin',
      business_name: 'Nexus POS',
    },
    manager: {
      id: 'demo-manager',
      email: 'manager@nexus.pos',
      full_name: 'Sarah Johnson',
      role: 'manager',
      business_name: 'Nexus POS',
    },
    cashier: {
      id: 'demo-cashier',
      email: 'cashier@nexus.pos',
      full_name: 'Alex Kim',
      role: 'cashier',
      business_name: 'Nexus POS',
    },
  };
  return { ...users[role], business_mode: businessMode };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Storage helpers ─────────────────────────────────────────────────────────

const DEMO_STORAGE_KEY = 'nexus-pos-demo-user';

function loadDemoUser(): UserProfile | null {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return null;
}

function saveDemoUser(user: UserProfile | null) {
  try {
    if (user) {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isDemoMode = !isSupabaseConfigured();

  // ── Fetch profile from Supabase `profiles` table ────────────────────────
  const fetchProfile = useCallback(async (supaUser: User): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supaUser.id)
      .single();

    if (error || !data) {
      // Profile not yet created – return a default from auth metadata
      return {
        id: supaUser.id,
        email: supaUser.email || '',
        full_name:
          (supaUser.user_metadata?.full_name as string) ||
          supaUser.email?.split('@')[0] ||
          'User',
        role: (supaUser.user_metadata?.role as UserRole) || 'cashier',
        business_mode: (supaUser.user_metadata?.business_mode as BusinessMode) || 'restaurant',
        avatar_url: supaUser.user_metadata?.avatar_url as string | undefined,
      };
    }

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      role: data.role || 'cashier',
      business_mode: data.business_mode || 'restaurant',
      business_name: data.business_name,
    };
  }, []);

  // ── Initialize: check existing session / demo user ──────────────────────
  useEffect(() => {
    const init = async () => {
      // 1) Check for demo user first
      if (isDemoMode) {
        const demoUser = loadDemoUser();
        if (demoUser) setUser(demoUser);
        setIsLoading(false);
        return;
      }

      // 2) Check for existing Supabase session
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
          setSession(existingSession);
          const profile = await fetchProfile(existingSession.user);
          setUser(profile);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      }

      setIsLoading(false);
    };

    init();

    // 3) Listen for auth state changes
    if (!isDemoMode) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          setSession(newSession);
          if (newSession?.user) {
            const profile = await fetchProfile(newSession.user);
            setUser(profile);
          } else {
            setUser(null);
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isDemoMode, fetchProfile]);

  // ── Sign in with email + password ───────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      if (isDemoMode) {
        // In demo mode, accept any email – map to a demo user based on what they type
        const role: UserRole = email.includes('admin')
          ? 'admin'
          : email.includes('manager')
          ? 'manager'
          : 'cashier';
        // Preserve the existing demo user's business_mode if they already had one
        const existingDemo = loadDemoUser();
        const bm = existingDemo?.business_mode || 'restaurant';
        const demoUser = { ...makeDemoUser(role, bm), email };
        setUser(demoUser);
        saveDemoUser(demoUser);
        return { error: null };
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    },
    [isDemoMode]
  );

  // ── Sign up ─────────────────────────────────────────────────────────────
  const signUp = useCallback(
    async ({ email, password, fullName, businessMode }: SignUpParams): Promise<{ error: string | null }> => {
      if (isDemoMode) {
        const demoUser: UserProfile = {
          ...makeDemoUser('admin', businessMode),
          email,
          full_name: fullName,
        };
        setUser(demoUser);
        saveDemoUser(demoUser);
        return { error: null };
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: 'admin', business_mode: businessMode },
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    },
    [isDemoMode]
  );

  // ── Sign out ────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (isDemoMode) {
      setUser(null);
      saveDemoUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [isDemoMode]);

  // ── Demo sign-in (skip login form) ─────────────────────────────────────
  const signInDemo = useCallback((role: UserRole = 'admin', businessMode: BusinessMode = 'restaurant') => {
    const demoUser = makeDemoUser(role, businessMode);
    setUser(demoUser);
    saveDemoUser(demoUser);
  }, []);

  // ── Role helpers ────────────────────────────────────────────────────────
  const hasRole = useCallback(
    (role: UserRole | UserRole[]) => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        isDemoMode,
        signIn,
        signUp,
        signOut,
        signInDemo,
        hasRole,
        isAdmin: user?.role === 'admin',
        isManager: user?.role === 'manager' || user?.role === 'admin',
        isCashier: user?.role === 'cashier',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
