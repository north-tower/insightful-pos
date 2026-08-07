import { Search, Bell, Menu, GitBranch, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { Badge } from '@/components/ui/badge';
import { SyncStatusIndicator } from '@/components/pos/SyncStatusIndicator';
import { ShopLogo } from '@/components/branding/ShopLogo';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HeaderProps {
  onMenuToggle?: () => void;
  hideSearch?: boolean;
}

export function Header({ onMenuToggle, hideSearch = false }: HeaderProps) {
  const { config, isRestaurant } = useBusinessMode();
  const { user } = useAuth();
  const { shopLogoUrl, companyName } = useCompanySettings();
  const { branches, activeBranch, loading: branchesLoading, switchBranch } = useBranch();

  const searchPlaceholder = isRestaurant
    ? 'Search menu, tickets and more'
    : 'Search products, sales and more';

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : '';

  const showBranchSwitcher = branches.length > 0;

  return (
    <header className="h-14 lg:h-16 bg-card border-b border-border px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={onMenuToggle}
          className="lg:hidden -ml-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted transition-colors active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>

        {!hideSearch && (
          <div className="relative hidden sm:block sm:w-48 md:w-64 lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        )}

        {shopLogoUrl ? (
          <div className="hidden md:flex items-center gap-2 shrink-0 max-w-[140px]">
            <ShopLogo size="xs" showFallback={false} className="!h-8" />
            <span className="text-sm font-semibold text-foreground truncate">{companyName}</span>
          </div>
        ) : (
          <Badge
            variant="outline"
            className="hidden md:flex text-xs font-medium text-muted-foreground shrink-0"
          >
            {config.icon} {config.label}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {showBranchSwitcher && (
          <div className="flex items-center gap-1.5 min-w-0">
            <GitBranch className="w-4 h-4 text-muted-foreground hidden sm:block shrink-0" />
            <Select
              value={activeBranch?.id}
              onValueChange={(id) => void switchBranch(id)}
              disabled={branchesLoading || branches.length < 2}
            >
              <SelectTrigger className="h-9 w-[140px] sm:w-[180px] text-xs sm:text-sm">
                {branchesLoading ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Branch…
                  </span>
                ) : (
                  <SelectValue placeholder="Branch" />
                )}
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {b.is_headquarters ? ' (HQ)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <SyncStatusIndicator />

        {!hideSearch && (
          <button className="sm:hidden p-2 rounded-full hover:bg-muted transition-colors">
            <Search className="w-5 h-5 text-muted-foreground" />
          </button>
        )}

        <ThemeToggle />

        <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-primary/20">
            {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
            <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden md:block text-sm">
            <p className="font-semibold text-foreground">{user?.full_name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
