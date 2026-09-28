import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Profile = {
  id: string;
  email: string;
  full_name: string;
};

type Store = {
  id: string;
  code: string;
  name: string;
};

type StaffLinkRow = {
  id: string;
  phone: string;
  profile_id: string;
  store_id: string;
  enabled: boolean;
  created_at: string;
};

type StaffLinkView = StaffLinkRow & {
  profile?: Profile | null;
  store?: Store | null;
};

function normalizeE164(raw: string): string | null {
  const phone = raw.trim().replace(/[\s-]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    return null;
  }
  return phone;
}

export default function AdminWhatsAppStaff() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [links, setLinks] = useState<StaffLinkView[]>([]);

  const [form, setForm] = useState({
    phone: '',
    profile_id: '',
    store_id: '',
    enabled: true,
  });

  const profileOptions = useMemo(
    () =>
      profiles.map((p) => ({
        value: p.id,
        label: `${p.full_name || p.email} (${p.email})`,
      })),
    [profiles],
  );

  const storeOptions = useMemo(
    () =>
      stores.map((s) => ({
        value: s.id,
        label: `${s.name} (${s.code})`,
      })),
    [stores],
  );

  const loadData = async () => {
    setLoading(true);
    const [profilesRes, storesRes, linksRes] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name').order('full_name', { ascending: true }),
      supabase.from('stores').select('id, code, name').eq('status', 'active').order('name', { ascending: true }),
      supabase
        .from('whatsapp_staff_links')
        .select('id, phone, profile_id, store_id, enabled, created_at')
        .order('created_at', { ascending: false }),
    ]);

    if (profilesRes.error || storesRes.error || linksRes.error) {
      toast({
        title: 'Failed to load WhatsApp staff links',
        description:
          profilesRes.error?.message ||
          storesRes.error?.message ||
          linksRes.error?.message ||
          'Unknown error',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const profileList = (profilesRes.data || []) as Profile[];
    const storeList = (storesRes.data || []) as Store[];
    const linkRows = (linksRes.data || []) as StaffLinkRow[];

    const profileById = new Map(profileList.map((p) => [p.id, p]));
    const storeById = new Map(storeList.map((s) => [s.id, s]));

    setProfiles(profileList);
    setStores(storeList);
    setLinks(
      linkRows.map((row) => ({
        ...row,
        profile: profileById.get(row.profile_id) ?? null,
        store: storeById.get(row.store_id) ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreate = async () => {
    const phone = normalizeE164(form.phone);
    if (!phone) {
      toast({
        title: 'Invalid phone',
        description: 'Use E.164 format, e.g. +254712345678 (include country code, no spaces).',
        variant: 'destructive',
      });
      return;
    }
    if (!form.profile_id || !form.store_id) {
      toast({
        title: 'Missing fields',
        description: 'Select a staff member and branch.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('whatsapp_staff_links').insert([
      {
        phone,
        profile_id: form.profile_id,
        store_id: form.store_id,
        enabled: form.enabled,
      },
    ]);
    setSaving(false);

    if (error) {
      toast({
        title: 'Could not add link',
        description: error.message.includes('whatsapp_staff_links_phone_unique')
          ? 'That phone number is already linked to another staff member.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'WhatsApp link added', description: `${phone} can use shop ops on WhatsApp.` });
    setForm({ phone: '', profile_id: form.profile_id, store_id: form.store_id, enabled: true });
    void loadData();
  };

  const handleToggleEnabled = async (link: StaffLinkView, enabled: boolean) => {
    setUpdatingId(link.id);
    const { error } = await supabase.from('whatsapp_staff_links').update({ enabled }).eq('id', link.id);
    setUpdatingId(null);

    if (error) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setLinks((prev) => prev.map((row) => (row.id === link.id ? { ...row, enabled } : row)));
  };

  const handleDelete = async (link: StaffLinkView) => {
    const profileLabel = link.profile?.full_name || link.profile?.email || link.profile_id;
    if (
      !window.confirm(
        `Remove WhatsApp access for ${link.phone} (${profileLabel})? They will no longer pass identify on WhatsApp.`,
      )
    ) {
      return;
    }

    setDeletingId(link.id);
    const { error } = await supabase.from('whatsapp_staff_links').delete().eq('id', link.id);
    setDeletingId(null);

    if (error) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Link removed' });
    setLinks((prev) => prev.filter((row) => row.id !== link.id));
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">WhatsApp staff access</h1>
            <p className="text-sm text-muted-foreground">
              Allowlisted phone numbers for the shop WhatsApp ops menu (sales, credit, payments).
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to POS
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Link staff phone
            </CardTitle>
            <CardDescription>
              The number must match the WhatsApp account that messages your shop line. One phone per
              staff member.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="wa-phone">WhatsApp phone (E.164) *</Label>
                <Input
                  id="wa-phone"
                  placeholder="+254712345678"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <Label>Staff user *</Label>
                <Select
                  value={form.profile_id || undefined}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, profile_id: value }))}
                  disabled={saving}
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
              <div className="space-y-1">
                <Label>Branch for ops *</Label>
                <Select
                  value={form.store_id || undefined}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, store_id: value }))}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
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
              <div className="flex flex-col justify-end gap-2">
                <div className="flex items-center justify-between rounded-md border px-3 py-2 h-10">
                  <Label htmlFor="wa-enabled" className="text-sm font-normal cursor-pointer">
                    Enabled
                  </Label>
                  <Switch
                    id="wa-enabled"
                    checked={form.enabled}
                    onCheckedChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))}
                    disabled={saving}
                  />
                </div>
                <Button onClick={() => void handleCreate()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MessageCircle className="w-4 h-4 mr-2" />
                  )}
                  Add link
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked numbers</CardTitle>
            <CardDescription>
              {links.length} phone{links.length === 1 ? '' : 's'} on the allowlist
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No links yet. Add a staff phone above — until then, WhatsApp identify returns
                unauthorised.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-mono text-sm">{link.phone}</TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {link.profile?.full_name || link.profile?.email || '—'}
                          </span>
                          {link.profile?.email && link.profile.full_name && (
                            <p className="text-xs text-muted-foreground">{link.profile.email}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {link.store?.name || link.store_id}
                          {link.store?.code && (
                            <span className="text-muted-foreground text-xs ml-1">
                              ({link.store.code})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={link.enabled}
                            onCheckedChange={(value) => void handleToggleEnabled(link, value)}
                            disabled={updatingId === link.id}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => void handleDelete(link)}
                            disabled={deletingId === link.id}
                            aria-label="Remove link"
                          >
                            {deletingId === link.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
