import { useState, useEffect, type ReactNode } from 'react';
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

type AuthTab = 'login' | 'signup';

const demoEmail = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
const demoPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
const hasDemoLogin = Boolean(demoEmail && demoPassword);

const INPUT_CLASS =
  'h-11 rounded-lg border-[0.5px] border-border bg-white text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(55,138,221,0.2)]';

const SIGN_IN_BUTTON_CLASS =
  'w-full h-11 rounded-lg bg-[#185FA5] hover:bg-[#145494] text-white text-sm font-medium active:scale-[0.98] transition-all';

function LoginIllustration() {
  return (
    <svg
      viewBox="0 0 260 290"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[280px]"
      aria-hidden="true"
    >
      {/* Floating decorative circles */}
      <circle cx="18" cy="52" r="5" fill="#378ADD" opacity="0.1" />
      <circle cx="238" cy="38" r="4" fill="#1D9E75" opacity="0.12" />
      <circle cx="248" cy="175" r="6" fill="#378ADD" opacity="0.08" />
      <circle cx="12" cy="210" r="4" fill="#F0A500" opacity="0.14" />
      <circle cx="220" cy="268" r="5" fill="#1D9E75" opacity="0.1" />

      {/* App window frame */}
      <rect x="18" y="28" width="224" height="218" rx="12" fill="#1a2d3d" />

      {/* Title bar */}
      <rect x="18" y="28" width="224" height="30" rx="12" fill="#152535" />
      <rect x="18" y="46" width="224" height="12" fill="#152535" />

      {/* Window chrome dots */}
      <circle cx="34" cy="43" r="4.5" fill="#E24B4A" />
      <circle cx="50" cy="43" r="4.5" fill="#F0A500" />
      <circle cx="66" cy="43" r="4.5" fill="#1D9E75" />

      <text
        x="130"
        y="46"
        textAnchor="middle"
        fill="#ffffff"
        opacity="0.35"
        fontSize="8"
        fontFamily="sans-serif"
        letterSpacing="0.08em"
      >
        insightful pos
      </text>

      {/* Dashed highlight around revenue stat card */}
      <rect
        x="28"
        y="68"
        width="64"
        height="50"
        rx="8"
        fill="none"
        stroke="#378ADD"
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.45"
      />

      {/* Stat card — Revenue */}
      <rect x="32" y="72" width="56" height="42" rx="6" fill="#243d4f" />
      <text x="40" y="86" fill="#7a8fa0" fontSize="6" fontFamily="sans-serif" letterSpacing="0.06em">
        REVENUE
      </text>
      <text x="40" y="106" fill="#378ADD" fontSize="13" fontWeight="500" fontFamily="sans-serif">
        KES 48k
      </text>

      {/* Stat card — In Stock */}
      <rect x="102" y="72" width="56" height="42" rx="6" fill="#243d4f" />
      <text x="110" y="86" fill="#7a8fa0" fontSize="6" fontFamily="sans-serif" letterSpacing="0.06em">
        IN STOCK
      </text>
      <text x="110" y="106" fill="#1D9E75" fontSize="13" fontWeight="500" fontFamily="sans-serif">
        142
      </text>

      {/* Stat card — Restock */}
      <rect x="172" y="72" width="56" height="42" rx="6" fill="#243d4f" />
      <text x="180" y="86" fill="#7a8fa0" fontSize="6" fontFamily="sans-serif" letterSpacing="0.06em">
        RESTOCK
      </text>
      <text x="180" y="106" fill="#E24B4A" fontSize="13" fontWeight="500" fontFamily="sans-serif">
        8
      </text>

      {/* Sparkline chart area */}
      <rect x="32" y="124" width="196" height="58" rx="6" fill="#1e3344" />
      <line x1="42" y1="172" x2="218" y2="172" stroke="#378ADD" strokeOpacity="0.12" strokeWidth="1" />
      <line x1="42" y1="158" x2="218" y2="158" stroke="#378ADD" strokeOpacity="0.08" strokeWidth="1" />
      <line x1="42" y1="144" x2="218" y2="144" stroke="#378ADD" strokeOpacity="0.06" strokeWidth="1" />

      {/* Revenue trend line */}
      <path
        d="M42 162 C62 148, 82 155, 102 142 S142 138, 162 132 S192 128, 218 134"
        fill="none"
        stroke="#378ADD"
        strokeWidth="2"
        opacity="0.5"
        strokeLinecap="round"
      />

      {/* Stock trend line */}
      <path
        d="M42 168 C62 164, 82 158, 102 152 S142 148, 162 144 S192 140, 218 146"
        fill="none"
        stroke="#1D9E75"
        strokeWidth="2"
        opacity="0.5"
        strokeLinecap="round"
      />

      {/* Mini POS / receipt strip */}
      <rect x="32" y="192" width="196" height="46" rx="8" fill="#243d4f" />

      {/* Product placeholder lines */}
      <rect x="42" y="202" width="110" height="7" rx="2" fill="#4a6272" />
      <rect x="42" y="213" width="72" height="5" rx="2" fill="#3a5262" opacity="0.7" />

      {/* Payment buttons */}
      <rect x="42" y="224" width="38" height="12" rx="3" fill="#1D9E75" />
      <text x="61" y="233" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontFamily="sans-serif" fontWeight="500">
        PAY
      </text>

      <rect x="86" y="224" width="46" height="12" rx="3" fill="#378ADD" />
      <text x="109" y="233" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontFamily="sans-serif" fontWeight="500">
        MPESA
      </text>

      <rect x="138" y="224" width="40" height="12" rx="3" fill="#F0A500" />
      <text x="158" y="233" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontFamily="sans-serif" fontWeight="500">
        CASH
      </text>
    </svg>
  );
}

function LoginLeftPanel() {
  return (
    <aside
      className="relative hidden md:flex w-[44%] shrink-0 flex-col justify-between overflow-hidden px-10 py-10"
      style={{ backgroundColor: '#0f1923' }}
    >
      {/* Brand block */}
      <div className="relative z-10">
        <div className="mb-3 inline-flex items-center justify-center rounded-lg border border-[#378ADD]/25 bg-white/5 p-2.5">
          <Store className="h-5 w-5 text-[#378ADD]" />
        </div>
        <h2 className="text-[18px] font-medium text-white">Insightful POS</h2>
        <p className="mt-0.5 text-[11px] text-white/35">Restaurant &amp; Retail</p>
      </div>

      {/* SVG illustration */}
      <div className="relative z-10 flex flex-1 items-center justify-center py-6">
        <LoginIllustration />
      </div>

      {/* Tagline */}
      <p className="relative z-10 text-[12px] leading-[1.6] text-white/45">
        Every sale tracked. Every unit counted.
        <br />
        Your store, always in view.
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

function LoginFormPanel({
  formVisible,
  children,
}: {
  formVisible: boolean;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-white">
      <div
        className={cn(
          'mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10 transition-opacity duration-300 ease-out',
          formVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        {children}
      </div>
    </main>
  );
}

export default function Login() {
  const { signIn, signUp, requestPasswordReset } = useAuth();

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
        <LoginLeftPanel />
        <LoginFormPanel formVisible={formVisible}>
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
        </LoginFormPanel>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <LoginLeftPanel />

      <LoginFormPanel formVisible={formVisible}>
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
      </LoginFormPanel>
    </div>
  );
}
