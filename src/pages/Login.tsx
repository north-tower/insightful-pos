import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Store,
  AlertCircle,
  Loader2,
  Presentation,
} from 'lucide-react';
import { DEMO_BRANDING } from '@/lib/demoMode';
import { COMPANY } from '@/config/company';
import { useProducts } from '@/hooks/useProducts';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { formatCurrency } from '@/lib/currency';

type AuthTab = 'login' | 'signup';

const demoEmail = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
const demoPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
const hasDemoLogin = Boolean(demoEmail && demoPassword);

const INPUT_CLASS =
  'h-11 rounded-lg border-[0.5px] border-border bg-white text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(55,138,221,0.2)]';

const SIGN_IN_BUTTON_CLASS =
  'w-full h-11 rounded-lg bg-[#185FA5] hover:bg-[#145494] text-white text-sm font-medium active:scale-[0.98] transition-all';

function LoginLeftPanel({
  inventoryValue,
  productCount,
  storeName,
}: {
  inventoryValue: string;
  productCount: string;
  storeName: string;
}) {
  const stats = [
    { value: inventoryValue, label: 'Total inventory value' },
    { value: productCount, label: 'Total products' },
    { value: storeName, label: 'Active store' },
  ];

  return (
    <aside
      className="relative hidden md:flex w-[42%] shrink-0 flex-col justify-between overflow-hidden px-10 py-10"
      style={{ backgroundColor: '#0f1923' }}
    >
      {/* Background decoration */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)' }}
      />

      {/* Brand block */}
      <div className="relative z-10">
        <div className="mb-4 inline-flex items-center justify-center rounded-xl border border-blue-500/20 bg-white/5 p-3">
          <Store className="h-6 w-6 text-blue-400" />
        </div>
        <h2 className="text-[20px] font-medium text-white">Insightful POS</h2>
        <p className="mt-1 text-xs text-white/40">Restaurant &amp; Retail Point of Sale</p>
      </div>

      {/* Store stats */}
      <div className="relative z-10 space-y-8">
        {stats.map((stat) => (
          <div key={stat.label} className="border-l-2 border-blue-600 pl-4">
            <p className="text-[22px] font-medium leading-tight text-white">{stat.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/50">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tagline */}
      <p className="relative z-10 text-[13px] leading-[1.6] text-white/50">
        Your store, fully in view. Every sale, every unit, every margin.
      </p>
    </aside>
  );
}

function LoginFooter() {
  return (
    <p className="mt-8 text-center text-[11px] text-muted-foreground">
      Insightful POS &middot; Restaurant &amp; Retail Point of Sale
    </p>
  );
}

export default function Login() {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const { retailProducts, loading: productsLoading } = useProducts();
  const { settings } = useBusinessSettings();

  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    setFormVisible(true);
  }, []);

  const hasProductStats = !productsLoading && retailProducts.length > 0;

  const panelStats = useMemo(() => {
    const totalValue = hasProductStats
      ? formatCurrency(
          retailProducts.reduce(
            (sum, p) => sum + p.price * (p.mainStock ?? p.stock),
            0,
          ),
        )
      : '—';

    const totalProducts = hasProductStats ? String(retailProducts.length) : '—';

    const storeName = settings.fullName || settings.name || COMPANY.fullName;

    return { totalValue, totalProducts, storeName };
  }, [hasProductStats, retailProducts, settings.fullName, settings.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
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
      const result = await signUp({ email, password, fullName });
      if (result.error) {
        setError(result.error);
      } else {
        setSignupSuccess(true);
      }
    }

    setLoading(false);
  };

  const handleDemoLogin = async () => {
    if (!demoEmail || !demoPassword) return;
    setError('');
    setInfo('');
    setLoading(true);
    const result = await signIn(demoEmail, demoPassword);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    setError('');
    setInfo('');

    if (!email.trim()) {
      setError('Enter your email first to reset password');
      return;
    }

    setIsResettingPassword(true);
    const result = await requestPasswordReset(email.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setInfo('Password reset link sent. Check your email inbox.');
    }
    setIsResettingPassword(false);
  };

  if (signupSuccess) {
    return (
      <div className="flex h-screen overflow-hidden bg-white">
        <LoginLeftPanel
          inventoryValue={panelStats.totalValue}
          productCount={panelStats.totalProducts}
          storeName={panelStats.storeName}
        />
        <main className="flex flex-1 flex-col overflow-y-auto bg-white">
          <div
            className={cn(
              'mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10 transition-opacity duration-300 ease-out',
              formVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <UserPlus className="h-8 w-8 text-success" />
              </div>
              <h1 className="mb-3 text-[20px] font-medium text-foreground">Check your email</h1>
              <p className="mb-6 text-[13px] text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>.
                Click the link to activate your account.
              </p>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setSignupSuccess(false);
                  setTab('login');
                }}
              >
                Back to Login
              </Button>
            </div>
            <LoginFooter />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <LoginLeftPanel
        inventoryValue={panelStats.totalValue}
        productCount={panelStats.totalProducts}
        storeName={panelStats.storeName}
      />

      <main className="flex flex-1 flex-col overflow-y-auto bg-white">
        <div
          className={cn(
            'mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10 transition-opacity duration-300 ease-out',
            formVisible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* Header */}
          <div className="mb-8">
            {hasDemoLogin ? (
              <>
                <img
                  src={DEMO_BRANDING.logoUrl}
                  alt={DEMO_BRANDING.name}
                  className="mb-4 h-16 w-16 rounded-xl border border-border object-cover shadow-sm"
                />
                <h1 className="text-[20px] font-medium text-foreground">{DEMO_BRANDING.name}</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Demo — sign in or use view-only access below
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[20px] font-medium text-foreground">Welcome back</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Sign in to continue to your store
                </p>
              </>
            )}
          </div>

          {/* Tab Switcher */}
          <div className="mb-6 flex gap-1 rounded-lg bg-[#f0f0f0] p-1">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError('');
                setInfo('');
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm transition-all',
                tab === 'login'
                  ? 'border-[0.5px] border-border bg-white font-medium text-foreground shadow-sm'
                  : 'font-normal text-muted-foreground hover:text-foreground',
              )}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setError('');
                setInfo('');
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm transition-all',
                tab === 'signup'
                  ? 'border-[0.5px] border-border bg-white font-medium text-foreground shadow-sm'
                  : 'font-normal text-muted-foreground hover:text-foreground',
              )}
            >
              <UserPlus className="h-4 w-4" />
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Mike Munene"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={cn('mt-1.5', INPUT_CLASS)}
                  required
                />
              </div>
            )}

            <div>
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn('mt-1.5', INPUT_CLASS)}
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn('pr-10', INPUT_CLASS)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {tab === 'login' && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword}
                    className="text-xs text-[#185FA5] hover:underline disabled:opacity-60"
                  >
                    {isResettingPassword ? 'Sending reset link...' : 'Forgot password?'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
                {info}
              </div>
            )}

            <Button type="submit" className={SIGN_IN_BUTTON_CLASS} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tab === 'login' ? 'Sign In' : 'Create Account'}
            </Button>

            {tab === 'login' && hasDemoLogin && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-lg border-amber-500/50 text-amber-900 hover:bg-amber-500/10 dark:text-amber-100"
                disabled={loading}
                onClick={() => void handleDemoLogin()}
              >
                <Presentation className="mr-2 h-4 w-4" />
                Demo {DEMO_BRANDING.name} (view only)
              </Button>
            )}
          </form>

          <LoginFooter />
        </div>
      </main>
    </div>
  );
}
