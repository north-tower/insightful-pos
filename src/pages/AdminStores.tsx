import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Building2, GitBranch, Loader2, Plus, UserPlus, UserRoundPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBusinessMode } from '@/context/BusinessModeContext';

type Business = {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
};

type Branch = {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  business_id: string;
  is_headquarters: boolean;
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

export default function AdminStores() {
  const { toast } = useToast();
  const { mode } = useBusinessMode();

  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<StoreMembership[]>([]);

  const [businessForm, setBusinessForm] = useState({ code: '', name: '' });
  const [branchForm, setBranchForm] = useState({
    business_id: '',
    code: '',
    name: '',
  });
  const [membershipForm, setMembershipForm] = useState({
    profile_id: '',
    store_id: '',
    role_in_store: 'cashier' as 'admin' | 'manager' | 'cashier',
    is_default_store: false,
  });
  const [createUserForm, setCreateUserForm] = useState({
    full_name: '',
    email: '',
    role: 'cashier' as 'admin' | 'manager' | 'cashier',
    store_id: '',
    role_in_store: 'cashier' as 'admin' | 'manager' | 'cashier',
    is_default_store: true,
    send_invite: false,
    password: '',
  });

  const profileOptions = useMemo(
    () =>
      profiles.map((p) => ({
        value: p.id,
        label: `${p.full_name || p.email} (${p.email})`,
      })),
    [profiles],
  );

  const businessOptions = useMemo(
    () =>
      businesses.map((b) => ({
        value: b.id,
        label: `${b.name} (${b.code})`,
      })),
    [businesses],
  );

  const branchOptions = useMemo(
    () =>
      branches.map((s) => {
        const biz = businesses.find((b) => b.id === s.business_id);
        return {
          value: s.id,
          label: `${s.name}${s.is_headquarters ? ' · HQ' : ''} — ${biz?.name || 'Business'}`,
        };
      }),
    [branches, businesses],
  );

  const loadData = async () => {
    setLoading(true);
    const [bizRes, storesRes, profilesRes, membershipsRes] = await Promise.all([
      supabase.from('businesses').select('id, code, name, status').order('created_at', { ascending: false }),
      supabase
        .from('stores')
        .select('id, code, name, status, business_id, is_headquarters')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name, role').order('created_at', { ascending: false }),
      supabase
        .from('profile_stores')
        .select('id, profile_id, store_id, role_in_store, is_default_store')
        .order('created_at', { ascending: false }),
    ]);

    if (bizRes.error || storesRes.error || profilesRes.error || membershipsRes.error) {
      toast({
        title: 'Failed to load branch admin data',
        description:
          bizRes.error?.message ||
          storesRes.error?.message ||
          profilesRes.error?.message ||
          membershipsRes.error?.message ||
          'Unknown error',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setBusinesses((bizRes.data || []) as Business[]);
    setBranches((storesRes.data || []) as Branch[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setMemberships((membershipsRes.data || []) as StoreMembership[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreateBusiness = async () => {
    const code = businessForm.code.trim().toLowerCase();
    const name = businessForm.name.trim();
    if (!code || !name) {
      toast({
        title: 'Missing fields',
        description: 'Business code and name are required.',
        variant: 'destructive',
      });
      return;
    }

    setSavingBusiness(true);
    const { data: biz, error } = await supabase
      .from('businesses')
      .insert([{ code, name, status: 'active' }])
      .select('id')
      .single();
    if (error || !biz) {
      setSavingBusiness(false);
      toast({
        title: 'Business creation failed',
        description: error?.message || 'Unknown error',
        variant: 'destructive',
      });
      return;
    }

    // Auto-create headquarters branch for the new business
    const hqCode = `${code}-hq`;
    const { error: branchErr } = await supabase.from('stores').insert([
      {
        code: hqCode,
        name: `${name} HQ`,
        status: 'active',
        business_id: biz.id,
        is_headquarters: true,
      },
    ]);
    setSavingBusiness(false);

    if (branchErr) {
      toast({
        title: 'Business created, HQ branch failed',
        description: branchErr.message,
        variant: 'destructive',
      });
      void loadData();
      return;
    }

    setBusinessForm({ code: '', name: '' });
    toast({
      title: 'Business registered',
      description: `${name} created with an HQ branch. Add more branches below.`,
    });
    void loadData();
  };

  const handleCreateBranch = async () => {
    const code = branchForm.code.trim().toLowerCase();
    const name = branchForm.name.trim();
    if (!branchForm.business_id || !code || !name) {
      toast({
        title: 'Missing fields',
        description: 'Select a business and enter branch code and name.',
        variant: 'destructive',
      });
      return;
    }

    setSavingBranch(true);
    const { data: created, error } = await supabase
      .from('stores')
      .insert([
        {
          code,
          name,
          status: 'active',
          business_id: branchForm.business_id,
          is_headquarters: false,
        },
      ])
      .select('id')
      .single();
    if (error || !created) {
      setSavingBranch(false);
      toast({
        title: 'Branch creation failed',
        description: error?.message || 'Unknown error',
        variant: 'destructive',
      });
      return;
    }

    // Auto-assign the creating admin so it appears in the header dropdown
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase.from('profile_stores').upsert(
        [
          {
            profile_id: user.id,
            store_id: created.id,
            role_in_store: 'admin',
            is_default_store: false,
          },
        ],
        { onConflict: 'profile_id,store_id' },
      );
    }

    setSavingBranch(false);
    setBranchForm({ business_id: branchForm.business_id, code: '', name: '' });
    toast({
      title: 'Branch created',
      description: `${name} is ready and added to your branch switcher. Assign other staff as needed.`,
    });
    void loadData();
  };

  const handleAssignMembership = async () => {
    if (!membershipForm.profile_id || !membershipForm.store_id) {
      toast({
        title: 'Missing fields',
        description: 'Select both a user and a branch.',
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
          title: 'Failed to update default branch',
          description: resetError.message,
          variant: 'destructive',
        });
        return;
      }
    }

    // If user has no active branch yet, force this assignment to be active
    const { count: defaultCount } = await supabase
      .from('profile_stores')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', membershipForm.profile_id)
      .eq('is_default_store', true);

    const makeDefault = membershipForm.is_default_store || (defaultCount ?? 0) === 0;

    const { error } = await supabase.from('profile_stores').upsert(
      [
        {
          profile_id: membershipForm.profile_id,
          store_id: membershipForm.store_id,
          role_in_store: membershipForm.role_in_store,
          is_default_store: makeDefault,
        },
      ],
      { onConflict: 'profile_id,store_id' },
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

    toast({ title: 'User assigned to branch' });
    void loadData();
  };

  const handleCreateUser = async () => {
    const fullName = createUserForm.full_name.trim();
    const email = createUserForm.email.trim().toLowerCase();
    if (!fullName || !email || !createUserForm.store_id) {
      toast({
        title: 'Missing fields',
        description: 'Name, email, and branch are required.',
        variant: 'destructive',
      });
      return;
    }
    if (!createUserForm.send_invite) {
      if (!createUserForm.password || createUserForm.password.length < 6) {
        toast({
          title: 'Password required',
          description: 'Set a password of at least 6 characters, or turn on email invite.',
          variant: 'destructive',
        });
        return;
      }
    }

    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email,
          full_name: fullName,
          role: createUserForm.role,
          business_mode: mode,
          store_id: createUserForm.store_id,
          role_in_store: createUserForm.role_in_store,
          is_default_store: createUserForm.is_default_store,
          send_invite: createUserForm.send_invite,
          password: createUserForm.send_invite ? undefined : createUserForm.password,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: data?.existed ? 'Existing user linked' : 'User created',
        description: data?.invited
          ? `Invite sent to ${email}. They can set a password from the email.`
          : `${fullName} can sign in with ${email}.`,
      });
      setCreateUserForm({
        full_name: '',
        email: '',
        role: 'cashier',
        store_id: createUserForm.store_id,
        role_in_store: 'cashier',
        is_default_store: true,
        send_invite: false,
        password: '',
      });
      void loadData();
    } catch (err: unknown) {
      toast({
        title: 'Could not create user',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Business & Branches</h1>
            <p className="text-sm text-muted-foreground">
              Register the parent business, add branches under it, then assign staff.
            </p>
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
          <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRoundPlus className="w-5 h-5" />
                Create staff user
              </CardTitle>
              <CardDescription>
                Create a login for a cashier, manager, or admin and assign them to a branch.
                Requires the <code className="text-xs">admin-create-user</code> edge function to be
                deployed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-user-name">Full name *</Label>
                  <Input
                    id="new-user-name"
                    placeholder="e.g. Jane Wanjiku"
                    value={createUserForm.full_name}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                    disabled={creatingUser}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-user-email">Email *</Label>
                  <Input
                    id="new-user-email"
                    type="email"
                    placeholder="jane@example.com"
                    value={createUserForm.email}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    disabled={creatingUser}
                  />
                </div>
                <div className="space-y-1">
                  <Label>App role *</Label>
                  <Select
                    value={createUserForm.role}
                    onValueChange={(value: 'admin' | 'manager' | 'cashier') =>
                      setCreateUserForm((prev) => ({
                        ...prev,
                        role: value,
                        role_in_store: value,
                      }))
                    }
                    disabled={creatingUser}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Branch *</Label>
                  <Select
                    value={createUserForm.store_id || undefined}
                    onValueChange={(value) =>
                      setCreateUserForm((prev) => ({ ...prev, store_id: value }))
                    }
                    disabled={creatingUser}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branchOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Role at branch</Label>
                  <Select
                    value={createUserForm.role_in_store}
                    onValueChange={(value: 'admin' | 'manager' | 'cashier') =>
                      setCreateUserForm((prev) => ({ ...prev, role_in_store: value }))
                    }
                    disabled={creatingUser}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!createUserForm.send_invite && (
                  <div className="space-y-1">
                    <Label htmlFor="new-user-password">Temporary password *</Label>
                    <Input
                      id="new-user-password"
                      type="text"
                      autoComplete="new-password"
                      placeholder="Min 6 characters"
                      value={createUserForm.password}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      disabled={creatingUser}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Set as their active branch</p>
                      <p className="text-xs text-muted-foreground">Used when they log in.</p>
                    </div>
                    <Switch
                      checked={createUserForm.is_default_store}
                      onCheckedChange={(value) =>
                        setCreateUserForm((prev) => ({ ...prev, is_default_store: value }))
                      }
                      disabled={creatingUser}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Send email invite instead</p>
                      <p className="text-xs text-muted-foreground">
                        They set their own password from the invite email.
                      </p>
                    </div>
                    <Switch
                      checked={createUserForm.send_invite}
                      onCheckedChange={(value) =>
                        setCreateUserForm((prev) => ({ ...prev, send_invite: value }))
                      }
                      disabled={creatingUser}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => void handleCreateUser()}
                  disabled={creatingUser || branchOptions.length === 0}
                  className="sm:self-end"
                >
                  {creatingUser ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserRoundPlus className="w-4 h-4 mr-2" />
                  )}
                  Create user
                </Button>
              </div>
              {branchOptions.length === 0 && (
                <p className="text-xs text-destructive">
                  Create a business/branch first, then you can add users.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Register business
                </CardTitle>
                <CardDescription>
                  Parent company only. Creates an HQ branch automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="biz-code">Business code</Label>
                  <Input
                    id="biz-code"
                    placeholder="e.g. afya-gold"
                    value={businessForm.code}
                    onChange={(e) => setBusinessForm((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="biz-name">Business name</Label>
                  <Input
                    id="biz-name"
                    placeholder="e.g. Afya Gold"
                    value={businessForm.name}
                    onChange={(e) => setBusinessForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <Button onClick={() => void handleCreateBusiness()} disabled={savingBusiness} className="w-full">
                  {savingBusiness ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Register business
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Add branch
                </CardTitle>
                <CardDescription>
                  New location under an existing business (own till &amp; stock).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Business</Label>
                  <Select
                    value={branchForm.business_id || undefined}
                    onValueChange={(value) => setBranchForm((prev) => ({ ...prev, business_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent business" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="branch-code">Branch code</Label>
                  <Input
                    id="branch-code"
                    placeholder="e.g. westlands"
                    value={branchForm.code}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="branch-name">Branch name</Label>
                  <Input
                    id="branch-name"
                    placeholder="e.g. Westlands"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <Button onClick={() => void handleCreateBranch()} disabled={savingBranch} className="w-full">
                  {savingBranch ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create branch
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Assign staff to branch
                </CardTitle>
                <CardDescription>Staff only see the branches they are assigned to.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>User</Label>
                  <Select
                    value={membershipForm.profile_id || undefined}
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
                  <Label>Branch</Label>
                  <Select
                    value={membershipForm.store_id || undefined}
                    onValueChange={(value) => setMembershipForm((prev) => ({ ...prev, store_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branchOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role at branch</Label>
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
                    <p className="text-sm font-medium">Set as active branch</p>
                    <p className="text-xs text-muted-foreground">Used at login for this user.</p>
                  </div>
                  <Switch
                    checked={membershipForm.is_default_store}
                    onCheckedChange={(value) =>
                      setMembershipForm((prev) => ({ ...prev, is_default_store: value }))
                    }
                  />
                </div>
                <Button
                  onClick={() => void handleAssignMembership()}
                  disabled={savingMembership}
                  className="w-full"
                >
                  {savingMembership ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Assign to branch
                </Button>
              </CardContent>
            </Card>
          </div>
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Businesses</CardTitle>
              <CardDescription>{businesses.length} parent business(es)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {businesses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No businesses yet — register one above.</p>
              ) : (
                businesses.map((biz) => {
                  const bizBranches = branches.filter((b) => b.business_id === biz.id);
                  return (
                    <div key={biz.id} className="rounded-md border p-3">
                      <p className="font-medium">{biz.name}</p>
                      <p className="text-xs text-muted-foreground">Code: {biz.code}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {bizBranches.length} branch{bizBranches.length === 1 ? '' : 'es'}
                        {bizBranches.length === 1 && bizBranches[0]?.is_headquarters
                          ? ' (HQ only — add locations with Add branch)'
                          : ''}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branches</CardTitle>
              <CardDescription>{branches.length} location(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {branches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No branches yet.</p>
              ) : (
                branches.map((branch) => {
                  const biz = businesses.find((b) => b.id === branch.business_id);
                  return (
                    <div key={branch.id} className="rounded-md border p-3">
                      <p className="font-medium">
                        {branch.name}
                        {branch.is_headquarters && (
                          <span className="ml-2 text-xs text-primary font-medium">HQ</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {biz?.name || 'Business'} · Code: {branch.code}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Staff ↔ branch</CardTitle>
            <CardDescription>Who can work at which branch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No memberships found.</p>
            ) : (
              memberships.map((m) => {
                const profile = profiles.find((p) => p.id === m.profile_id);
                const branch = branches.find((s) => s.id === m.store_id);
                return (
                  <div key={m.id} className="rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">
                      {profile?.full_name || profile?.email || m.profile_id}
                    </span>
                    <span className="text-muted-foreground">{' → '}</span>
                    <span>{branch?.name || m.store_id}</span>
                    <span className="text-muted-foreground"> ({m.role_in_store})</span>
                    {m.is_default_store && (
                      <span className="ml-2 text-xs text-primary font-medium">active</span>
                    )}
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
