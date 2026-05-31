import { useState } from 'react';
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
          {hasDemoLogin ? (
            <>
              <img
                src={DEMO_BRANDING.logoUrl}
                alt={DEMO_BRANDING.name}
                className="h-24 w-24 mx-auto mb-4 rounded-2xl object-cover shadow-md border border-border"
              />
              <h1 className="text-3xl font-bold text-foreground">{DEMO_BRANDING.name}</h1>
              <p className="text-muted-foreground mt-1">Demo — sign in or use view-only access below</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-4">
                <Store className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">INSIGHTFUL POS</h1>
              <p className="text-muted-foreground mt-1">Sign in to your account</p>
            </>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-muted p-1 rounded mb-6">
          <button
            onClick={() => { setTab('login'); setError(''); setInfo(''); }}
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
            onClick={() => { setTab('signup'); setError(''); setInfo(''); }}
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
            {tab === 'login' && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={isResettingPassword}
                  className="text-xs text-primary hover:underline disabled:opacity-60"
                >
                  {isResettingPassword ? 'Sending reset link...' : 'Forgot password?'}
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {info && (
            <div className="p-3 rounded bg-success/10 border border-success/20 text-sm text-success">
              {info}
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tab === 'login' ? 'Sign In' : 'Create Account'}
          </Button>

          {tab === 'login' && hasDemoLogin && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-amber-500/50 text-amber-900 dark:text-amber-100 hover:bg-amber-500/10"
              disabled={loading}
              onClick={() => void handleDemoLogin()}
            >
              <Presentation className="w-4 h-4 mr-2" />
              Demo {DEMO_BRANDING.name} (view only)
            </Button>
          )}
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          INSIGHTFUL POS • Restaurant & Retail Point of Sale
        </p>
      </div>
    </div>
  );
}
