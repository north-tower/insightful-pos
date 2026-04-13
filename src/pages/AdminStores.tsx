import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Building2, Loader2, Plus, UserPlus } from 'lucide-react';
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
  const [savingMembership, setSavingMembership] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  const [stores, setStores] = useState<Store[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<StoreMembership[]>([]);

  const [storeForm, setStoreForm] = useState(defaultCreateStoreForm);
  const [membershipForm, setMembershipForm] = useState({
    profile_id: '',
    store_id: '',
    role_in_store: 'cashier' as 'admin' | 'manager' | 'cashier',
    is_default_store: false,
  });
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    full_name: '',
    role: 'cashier' as 'admin' | 'manager' | 'cashier',
    business_mode: 'restaurant' as 'restaurant' | 'retail',
    store_id: '',
    role_in_store: 'cashier' as 'admin' | 'manager' | 'cashier',
    is_default_store: true,
    send_invite: true,
    password: '',
  });

  const profileOptions = useMemo(
    () =>
      profiles.map((p) => ({
        value: p.id,
        label: `${p.full_name || p.email} (${p.email})`,
      })),
    [profiles]
  );

  const storeOptions = useMemo(
    () =>
      stores.map((s) => ({
        value: s.id,
        label: `${s.name} (${s.code})`,
      })),
    [stores]
  );

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

  const handleAssignMembership = async () => {
    if (!membershipForm.profile_id || !membershipForm.store_id) {
      toast({
        title: 'Missing fields',
        description: 'Select both a user and a store.',
        variant: 'destructive',
      });
      return;
    }

    setSavingMembership(true);

    if (membershipForm.is_default_store) {
      const { error: resetError } = await supabase
        .from('profile_stores')
        .update({ is_default_store: false })
        .eq('profile_id', membershipForm.profile_id);
      if (resetError) {
        setSavingMembership(false);
        toast({
          title: 'Failed to update default store',
          description: resetError.message,
          variant: 'destructive',
        });
        return;
      }
    }

    const { error } = await supabase.from('profile_stores').upsert(
      [
        {
          profile_id: membershipForm.profile_id,
          store_id: membershipForm.store_id,
          role_in_store: membershipForm.role_in_store,
          is_default_store: membershipForm.is_default_store,
        },
      ],
      { onConflict: 'profile_id,store_id' }
    );

    setSavingMembership(false);

    if (error) {
      toast({
        title: 'Failed to assign user',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'User assigned to store' });
    loadData();
  };

  const handleCreateUser = async () => {
    if (!createUserForm.email || !createUserForm.full_name || !createUserForm.store_id) {
      toast({
        title: 'Missing fields',
        description: 'Email, full name, and store are required.',
        variant: 'destructive',
      });
      return;
    }

    if (!createUserForm.send_invite && createUserForm.password.trim().length < 6) {
      toast({
        title: 'Password required',
        description: 'Provide at least 6 characters when invite is disabled.',
        variant: 'destructive',
      });
      return;
    }

    setCreatingUser(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: createUserForm.email,
        full_name: createUserForm.full_name,
        role: createUserForm.role,
        business_mode: createUserForm.business_mode,
        store_id: createUserForm.store_id,
        role_in_store: createUserForm.role_in_store,
        is_default_store: createUserForm.is_default_store,
        send_invite: createUserForm.send_invite,
        password: createUserForm.send_invite ? undefined : createUserForm.password,
      },
    });
    setCreatingUser(false);

    if (error || data?.error) {
      toast({
        title: 'Create user failed',
        description: error?.message || data?.error || 'Unknown error',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'User created successfully',
      description: data?.invited
        ? 'Invitation sent and store membership assigned.'
        : 'User account and store membership created.',
    });

    setCreateUserForm({
      email: '',
      full_name: '',
      role: 'cashier',
      business_mode: 'restaurant',
      store_id: '',
      role_in_store: 'cashier',
      is_default_store: true,
      send_invite: true,
      password: '',
    });
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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Assign User
                </CardTitle>
                <CardDescription>Grant a user access to a specific store.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>User</Label>
                  <Select
                    value={membershipForm.profile_id}
                    onValueChange={(value) => setMembershipForm((prev) => ({ ...prev, profile_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {profileOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Store</Label>
                  <Select
                    value={membershipForm.store_id}
                    onValueChange={(value) => setMembershipForm((prev) => ({ ...prev, store_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role in store</Label>
                  <Select
                    value={membershipForm.role_in_store}
                    onValueChange={(value: 'admin' | 'manager' | 'cashier') =>
                      setMembershipForm((prev) => ({ ...prev, role_in_store: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Set as default store</p>
                    <p className="text-xs text-muted-foreground">Used at login for this user.</p>
                  </div>
                  <Switch
                    checked={membershipForm.is_default_store}
                    onCheckedChange={(value) => setMembershipForm((prev) => ({ ...prev, is_default_store: value }))}
                  />
                </div>
                <Button onClick={handleAssignMembership} disabled={savingMembership} className="w-full">
                  {savingMembership ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Assign User
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
            <CardTitle>Create User and Assign Store</CardTitle>
            <CardDescription>
              One action to create/invite account, upsert profile, and attach store access.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="staff@company.com"
                value={createUserForm.email}
                onChange={(e) => setCreateUserForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Full name</Label>
              <Input
                placeholder="Jane Doe"
                value={createUserForm.full_name}
                onChange={(e) => setCreateUserForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>App role</Label>
              <Select
                value={createUserForm.role}
                onValueChange={(value: 'admin' | 'manager' | 'cashier') =>
                  setCreateUserForm((prev) => ({ ...prev, role: value, role_in_store: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business mode</Label>
              <Select
                value={createUserForm.business_mode}
                onValueChange={(value: 'restaurant' | 'retail') =>
                  setCreateUserForm((prev) => ({ ...prev, business_mode: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Store</Label>
              <Select
                value={createUserForm.store_id}
                onValueChange={(value) => setCreateUserForm((prev) => ({ ...prev, store_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {storeOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role in store</Label>
              <Select
                value={createUserForm.role_in_store}
                onValueChange={(value: 'admin' | 'manager' | 'cashier') =>
                  setCreateUserForm((prev) => ({ ...prev, role_in_store: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Send invite email</p>
                <p className="text-xs text-muted-foreground">If off, password must be provided.</p>
              </div>
              <Switch
                checked={createUserForm.send_invite}
                onCheckedChange={(value) => setCreateUserForm((prev) => ({ ...prev, send_invite: value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Default store</p>
                <p className="text-xs text-muted-foreground">Used when user logs in.</p>
              </div>
              <Switch
                checked={createUserForm.is_default_store}
                onCheckedChange={(value) => setCreateUserForm((prev) => ({ ...prev, is_default_store: value }))}
              />
            </div>
            {!createUserForm.send_invite && (
              <div>
                <Label>Temporary password</Label>
                <Input
                  type="password"
                  placeholder="min 6 characters"
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
            )}
            <div className="lg:col-span-4">
              <Button onClick={handleCreateUser} disabled={creatingUser}>
                {creatingUser ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Create User + Assign Store
              </Button>
            </div>
          </CardContent>
        </Card>

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
