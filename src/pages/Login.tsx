import { useState } from 'react';
import { useAuth, UserRole } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { BusinessMode } from '@/types/business';
import {
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Store,
  Shield,
  UserCheck,
  ShoppingCart,
  AlertCircle,
  Loader2,
  UtensilsCrossed,
  Check,
} from 'lucide-react';

type AuthTab = 'login' | 'signup';

interface DemoOption {
  role: UserRole;
  mode: BusinessMode;
  label: string;
  icon: typeof Shield;
  desc: string;
}

const demoOptions: DemoOption[] = [
  { role: 'admin', mode: 'restaurant', label: 'Restaurant Admin', icon: UtensilsCrossed, desc: 'Full restaurant access' },
  { role: 'admin', mode: 'retail', label: 'Retail Admin', icon: Store, desc: 'Full retail access' },
  { role: 'manager', mode: 'restaurant', label: 'Manager', icon: UserCheck, desc: 'All except settings' },
  { role: 'cashier', mode: 'restaurant', label: 'Cashier', icon: ShoppingCart, desc: 'POS only' },
];

const businessModes: { value: BusinessMode; label: string; icon: typeof Store; desc: string }[] = [
  { value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, desc: 'Café, bar, food truck' },
  { value: 'retail', label: 'Retail Shop', icon: Store, desc: 'Store, boutique, electronics' },
];

export default function Login() {
  const { signIn, signUp, signInDemo, isDemoMode } = useAuth();

  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessMode, setBusinessMode] = useState<BusinessMode>('restaurant');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (tab === 'login') {
      const result = await signIn(email, password);
      if (result.error) setError(result.error);
    } else {
      if (!fullName.trim()) {
        setError('Full name is required');
        setLoading(false);
        return;
      }
      const result = await signUp({ email, password, fullName, businessMode });
      if (result.error) {
        setError(result.error);
      } else if (!isDemoMode) {
        setSignupSuccess(true);
      }
    }

    setLoading(false);
  };

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserPlus className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Check your email</h1>
          <p className="text-muted-foreground mb-6">
            We sent a confirmation link to <strong>{email}</strong>.
            Click the link to activate your account.
          </p>
          <Button variant="outline" onClick={() => { setSignupSuccess(false); setTab('login'); }}>
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-4">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Nexus POS</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {/* Demo mode banner */}
        {isDemoMode && (
          <div className="mb-6 p-4 rounded border border-info/30 bg-info/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-info mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Demo Mode</p>
                <p className="text-xs text-muted-foreground">
                  Supabase not configured. Pick a role to jump in instantly.
                </p>
              </div>
            </div>

            {/* Quick demo login buttons */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {demoOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={`${opt.role}-${opt.mode}`}
                    onClick={() => signInDemo(opt.role, opt.mode)}
                    className="flex items-center gap-2.5 p-3 rounded border border-border bg-card hover:bg-muted transition-colors text-left"
                  >
                    <Icon className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold block truncate">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground block truncate">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or use form</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-muted p-1 rounded mb-6">
          <button
            onClick={() => { setTab('login'); setError(''); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-all',
              tab === 'login'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError(''); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-all',
              tab === 'signup'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UserPlus className="w-4 h-4" />
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && (
            <>
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Mike Munene"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>

              {/* Business Mode Selector */}
              <div>
                <Label>Business Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {businessModes.map(({ value, label, icon: Icon, desc }) => {
                    const selected = businessMode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBusinessMode(value)}
                        className={cn(
                          'relative flex items-center gap-3 p-3 rounded border-2 text-left transition-all',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:border-primary/40'
                        )}
                      >
                        {selected && (
                          <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                        <Icon className={cn('w-5 h-5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
                        <div>
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-[10px] text-muted-foreground">{desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@store.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tab === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Nexus POS • Restaurant & Retail Point of Sale
        </p>
      </div>
    </div>
  );
}
