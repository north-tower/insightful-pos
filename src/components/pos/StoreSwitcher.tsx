import { Loader2, Store } from 'lucide-react';
import { useBranch } from '@/context/BranchContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface StoreSwitcherProps {
  className?: string;
}

export function StoreSwitcher({ className }: StoreSwitcherProps) {
  const { branches, activeBranch, loading: branchesLoading, switchBranch } = useBranch();

  if (branches.length === 0) {
    return null;
  }

  const branchName = activeBranch?.name ?? 'Store';
  const displayName = activeBranch?.is_headquarters ? `${branchName} (HQ)` : branchName;
  const canSwitch = !branchesLoading && branches.length >= 2;

  if (!canSwitch) {
    return (
      <p
        className={cn('min-w-0 truncate text-sm font-medium text-ink', className)}
        title={displayName}
      >
        {displayName}
      </p>
    );
  }

  return (
    <Select value={activeBranch?.id} onValueChange={(id) => void switchBranch(id)} disabled={branchesLoading}>
      <SelectTrigger
        className={cn(
          'focus-ring h-12 max-w-full min-h-[var(--tap-min)] gap-2 rounded-[var(--radius)] border-hairline bg-surface px-3 text-sm font-medium text-ink shadow-none [&>span]:truncate',
          className,
        )}
        aria-label="Switch store"
      >
        <Store className="h-4 w-4 shrink-0 text-ink" aria-hidden />
        {branchesLoading ? (
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <Loader2 className="h-4 w-4 shrink-0 motion-reduce:animate-none animate-spin" aria-hidden />
            <span className="truncate">Loading…</span>
          </span>
        ) : (
          <SelectValue placeholder="Store" />
        )}
      </SelectTrigger>
      <SelectContent className="shadow-float">
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
            {b.is_headquarters ? ' (HQ)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
