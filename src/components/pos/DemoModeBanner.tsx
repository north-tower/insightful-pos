import { Eye } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DEMO_BRANDING } from '@/lib/demoMode';

export function DemoModeBanner() {
  const { isDemo } = useAuth();
  if (!isDemo) return null;

  return (
    <div
      role="status"
      className="shrink-0 bg-amber-500/15 border-b border-amber-500/40 px-3 py-2 text-center text-sm text-amber-950 dark:text-amber-100"
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-2 font-medium">
        <img
          src={DEMO_BRANDING.logoUrl}
          alt={DEMO_BRANDING.name}
          className="h-7 w-7 rounded-full object-cover border border-amber-500/30"
        />
        <Eye className="w-4 h-4 shrink-0" />
        <span>
          <strong>{DEMO_BRANDING.name}</strong> demo — live Store 007 data. Nothing is saved.
        </span>
      </span>
    </div>
  );
}
