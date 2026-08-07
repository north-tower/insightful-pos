import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface BranchStore {
  id: string;
  code: string;
  name: string;
  business_id: string;
  business_name: string;
  is_headquarters: boolean;
  is_default_store: boolean;
  role_in_store: string;
}

interface BranchContextType {
  branches: BranchStore[];
  activeBranch: BranchStore | null;
  loading: boolean;
  switchBranch: (storeId: string) => Promise<void>;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [branches, setBranches] = useState<BranchStore[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshBranches = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setBranches([]);
      return;
    }
    setLoading(true);
    try {
      // Promote a membership to active if none is marked default
      await supabase.rpc('ensure_default_store');
      const { data, error } = await supabase.rpc('my_branch_stores');
      if (error) throw error;
      setBranches((data || []) as BranchStore[]);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    void refreshBranches();
  }, [refreshBranches]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.is_default_store) || branches[0] || null,
    [branches],
  );

  const switchBranch = useCallback(
    async (storeId: string) => {
      if (activeBranch?.id === storeId) return;
      const target = branches.find((b) => b.id === storeId);
      if (!target) {
        toast.error('Branch not available');
        return;
      }
      try {
        const { error } = await supabase.rpc('set_my_default_store', {
          p_store_id: storeId,
        });
        if (error) throw error;
        await refreshBranches();
        toast.success(`Switched to ${target.name}`);
        // Reload so all store-scoped queries pick up the new current_store_id
        window.setTimeout(() => window.location.reload(), 400);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to switch branch');
      }
    },
    [activeBranch?.id, branches, refreshBranches],
  );

  const value = useMemo(
    () => ({
      branches,
      activeBranch,
      loading,
      switchBranch,
      refreshBranches,
    }),
    [branches, activeBranch, loading, switchBranch, refreshBranches],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    throw new Error('useBranch must be used within BranchProvider');
  }
  return ctx;
}
