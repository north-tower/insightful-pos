import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Building2, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Store = {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
};

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'cashier';
};

type StoreMembership = {
  id: string;
  profile_id: string;
  store_id: string;
  role_in_store: 'admin' | 'manager' | 'cashier';
  is_default_store: boolean;
};

const defaultCreateStoreForm = { code: '', name: '' };

export default function AdminStores() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(false);

  const [stores, setStores] = useState<Store[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<StoreMembership[]>([]);

  const [storeForm, setStoreForm] = useState(defaultCreateStoreForm);

  const loadData = async () => {
    setLoading(true);
    const [storesRes, profilesRes, membershipsRes] = await Promise.all([
      supabase.from('stores').select('id, code, name, status').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name, role').order('created_at', { ascending: false }),
      supabase
        .from('profile_stores')
        .select('id, profile_id, store_id, role_in_store, is_default_store')
        .order('created_at', { ascending: false }),
    ]);

    if (storesRes.error || profilesRes.error || membershipsRes.error) {
      toast({
        title: 'Failed to load store admin data',
        description:
          storesRes.error?.message || profilesRes.error?.message || membershipsRes.error?.message || 'Unknown error',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setStores((storesRes.data || []) as Store[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setMemberships((membershipsRes.data || []) as StoreMembership[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateStore = async () => {
    const code = storeForm.code.trim().toLowerCase();
    const name = storeForm.name.trim();

    if (!code || !name) {
      toast({
        title: 'Missing fields',
        description: 'Store code and name are required.',
        variant: 'destructive',
      });
      return;
    }

    setSavingStore(true);
    const { error } = await supabase.from('stores').insert([{ code, name, status: 'active' }]);
    setSavingStore(false);

    if (error) {
      toast({
        title: 'Store creation failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setStoreForm(defaultCreateStoreForm);
    toast({ title: 'Store created', description: `${name} is ready.` });
    loadData();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Store Administration</h1>
            <p className="text-sm text-muted-foreground">Create stores and assign users for independent operations.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to POS
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Create Store
                </CardTitle>
                <CardDescription>New stores get isolated data automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="store-code">Store code</Label>
                  <Input
                    id="store-code"
                    placeholder="e.g. nairobi-west"
                    value={storeForm.code}
                    onChange={(e) => setStoreForm((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="store-name">Store name</Label>
                  <Input
                    id="store-name"
                    placeholder="e.g. Nairobi West Branch"
                    value={storeForm.name}
                    onChange={(e) => setStoreForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCreateStore} disabled={savingStore} className="w-full">
                  {savingStore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Store
                </Button>
              </CardContent>
            </Card>

            <Card className="xl:col-span-1">
              <CardHeader>
                <CardTitle>Current Stores</CardTitle>
                <CardDescription>{stores.length} total stores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stores yet.</p>
                ) : (
                  stores.map((store) => (
                    <div key={store.id} className="rounded-md border p-3">
                      <p className="font-medium">{store.name}</p>
                      <p className="text-xs text-muted-foreground">Code: {store.code}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-1">Status: {store.status}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>User-store memberships</CardTitle>
            <CardDescription>Who can access what store right now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No memberships found.</p>
            ) : (
              memberships.map((m) => {
                const profile = profiles.find((p) => p.id === m.profile_id);
                const store = stores.find((s) => s.id === m.store_id);
                return (
                  <div key={m.id} className="rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">{profile?.full_name || profile?.email || m.profile_id}</span>
                    <span className="text-muted-foreground">{' -> '}</span>
                    <span>{store?.name || m.store_id}</span>
                    <span className="text-muted-foreground"> ({m.role_in_store})</span>
                    {m.is_default_store && <span className="ml-2 text-xs text-primary font-medium">default</span>}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
