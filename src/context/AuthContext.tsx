import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
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
}

interface AuthContextType {
  // State
  user: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasAssignedStore: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;

  // Role helpers
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isCashier: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a UserProfile instantly from the Supabase User's JWT metadata.
 * This never makes a network request, so it can't fail or hang.
 */
function profileFromMetadata(supaUser: User): UserProfile {
  const meta = supaUser.user_metadata ?? {};
  return {
    id: supaUser.id,
    email: supaUser.email || '',
    full_name:
      (meta.full_name as string) ||
      supaUser.email?.split('@')[0] ||
      'User',
    role: (meta.role as UserRole) || 'cashier',
    business_mode: (meta.business_mode as BusinessMode) || 'retail',
    avatar_url: meta.avatar_url as string | undefined,
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAssignedStore, setHasAssignedStore] = useState(false);
  const assignmentUserIdRef = useRef<string | null>(null);

  // ── Enrich profile from the `profiles` table (best-effort) ────────────
  // This is called AFTER the user is already set from metadata, so the app
  // is already in authenticated state. If this fails, nothing breaks.
  const enrichProfile = useCallback(async (supaUser: User) => {
    try {
      const [{ data, error }, { count, error: membershipError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', supaUser.id)
          .single(),
        supabase
          .from('profile_stores')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', supaUser.id)
          .eq('is_default_store', true),
      ]);

      if (!membershipError) {
        setHasAssignedStore((count ?? 0) > 0);
      }

      if (error || !data) return; // Keep the metadata-based profile

      setUser({
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        role: data.role || 'cashier',
        business_mode: data.business_mode || 'retail',
        business_name: data.business_name,
      });
    } catch {
      // Silently ignore – the metadata-based profile is good enough
    }
  }, []);

  // ── Initialize: check existing session ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // Handle a session: set user from metadata instantly, then enrich
    const handleSession = (s: Session | null) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        setUser(profileFromMetadata(s.user));
        // Avoid flashing "pending approval" on every token refresh/re-render.
        // Only reset store assignment state when the authenticated user changes.
        if (assignmentUserIdRef.current !== s.user.id) {
          setHasAssignedStore(false);
          assignmentUserIdRef.current = s.user.id;
        }
        // Fire-and-forget: try to get the full profile from the DB
        enrichProfile(s.user);
      } else {
        setUser(null);
        setHasAssignedStore(false);
        assignmentUserIdRef.current = null;
      }
      setIsLoading(false);
    };

    // 1. Check for existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) handleSession(s);
    }).catch((err) => {
      console.error('Failed to restore session:', err);
      if (!cancelled) setIsLoading(false);
    });

    // Safety timeout: never let isLoading stay true longer than 5 seconds
    const timeout = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) console.warn('Auth loading timed out');
        return false;
      });
    }, 5000);

    // 2. Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        handleSession(newSession);
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [enrichProfile]);

  // ── Sign in with email + password ───────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    },
    [],
  );

  // ── Sign up ─────────────────────────────────────────────────────────────
  const signUp = useCallback(
    async ({ email, password, fullName }: SignUpParams): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: 'cashier', business_mode: 'retail' },
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    },
    [],
  );

  // ── Sign out ────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setHasAssignedStore(false);
    assignmentUserIdRef.current = null;
  }, []);

  // ── Role helpers ────────────────────────────────────────────────────────
  const hasRole = useCallback(
    (role: UserRole | UserRole[]) => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        hasAssignedStore,
        signIn,
        signUp,
        signOut,
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
