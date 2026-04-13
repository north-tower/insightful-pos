import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '@/components/pos/PageLayout';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Building2, Save, Loader2, Shield } from 'lucide-react';

interface SettingsProps {
  onNavigate: (tab: string) => void;
}

export default function Settings({ onNavigate }: SettingsProps) {
  const { settings, loading, saveSettings } = useCompanySettings();
  const { isAdmin } = useAuth();

  const [form, setForm] = useState({
    name: '',
    fullName: '',
    tagline: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    tax_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Sync form state when settings load from the database
  useEffect(() => {
    if (!loading) {
      setForm({
        name: settings.name,
        fullName: settings.fullName,
        tagline: settings.tagline,
        address: settings.address,
        city: settings.city,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        tax_id: settings.tax_id,
      });
    }
  }, [loading, settings]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
  };

  if (loading) {
    return (
      <PageLayout activeTab="settings" onNavigate={onNavigate}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activeTab="settings" onNavigate={onNavigate}>
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Settings</h1>
          <p className="text-muted-foreground">Manage your business information and preferences</p>
        </div>

        {/* Company Information Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  This information appears on receipts, the sidebar, login page, and the customer order page.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Names Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Short Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Nexus"
                  value={form.name}
                  onChange={handleChange('name')}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Shown in the sidebar &amp; login page</p>
              </div>
              <div>
                <Label htmlFor="fullName">Full Business Name</Label>
                <Input
                  id="fullName"
                  placeholder="e.g. Nexus Restaurant"
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Shown on receipts &amp; customer pages</p>
              </div>
            </div>

            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                placeholder="e.g. Restaurant & Retail Point of Sale"
                value={form.tagline}
                onChange={handleChange('tagline')}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">Shown on the login page footer</p>
            </div>

            <Separator />

            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="info@yourbusiness.com"
                  value={form.email}
                  onChange={handleChange('email')}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="www.yourbusiness.com"
                value={form.website}
                onChange={handleChange('website')}
                className="mt-1.5"
              />
            </div>

            <Separator />

            {/* Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street"
                  value={form.address}
                  onChange={handleChange('address')}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="city">City / Region</Label>
                <Input
                  id="city"
                  placeholder="New York, NY 10001"
                  value={form.city}
                  onChange={handleChange('city')}
                  className="mt-1.5"
                />
              </div>
            </div>

            <Separator />

            {/* Tax */}
            <div className="max-w-xs">
              <Label htmlFor="tax_id">Tax ID / VAT Number</Label>
              <Input
                id="tax_id"
                placeholder="TAX-123456"
                value={form.tax_id}
                onChange={handleChange('tax_id')}
                className="mt-1.5"
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Admin Controls
              </CardTitle>
              <CardDescription>
                Manage stores and user assignments for multi-store operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/admin/stores">Open Store Management</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
