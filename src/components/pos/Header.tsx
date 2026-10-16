import { Bell, HelpCircle, LogOut, Menu, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { SyncStatusIndicator } from '@/components/pos/SyncStatusIndicator';
import { GlobalSearchField } from '@/components/pos/GlobalSearchField';
import { StoreSwitcher } from '@/components/pos/StoreSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onMenuToggle?: () => void;
  hideSearch?: boolean;
  onNavigate?: (tab: string) => void;
  /** When set, shown on md+ instead of the store switcher (store stays in the sidebar). */
  pageTitle?: string;
}

export function Header({ onMenuToggle, hideSearch = false, onNavigate, pageTitle }: HeaderProps) {
  const { user, signOut } = useAuth();

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b border-hairline bg-surface px-2 sm:gap-3 sm:px-4 md:h-16 lg:px-6">
      <button
        type="button"
        onClick={onMenuToggle}
        className="focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)] text-ink hover:bg-muted md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        {pageTitle ? (
          <>
            <h1 className="hidden min-w-0 truncate font-sans text-base font-semibold text-ink md:block">
              {pageTitle}
            </h1>
            <div className="min-w-0 flex-1 md:hidden md:max-w-[220px] lg:max-w-[280px]">
              <StoreSwitcher className="w-full" />
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1 md:flex-none md:max-w-[220px] lg:max-w-[280px]">
            <StoreSwitcher className="w-full" />
          </div>
        )}

        {!hideSearch && (
          <div className="relative hidden min-w-0 max-w-[480px] flex-1 md:block">
            <GlobalSearchField />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <SyncStatusIndicator />

        <div className="hidden md:block">
          <ThemeToggle />
        </div>

        <button
          type="button"
          className="focus-ring relative flex h-12 w-12 items-center justify-center rounded-[var(--radius)] text-ink hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-ink" aria-hidden />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-ink" aria-hidden />
          <span className="sr-only">Notifications</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="focus-ring rounded-full"
              aria-label={user?.full_name ? `Account menu, ${user.full_name}` : 'Account menu'}
            >
              <Avatar className="h-10 w-10 border border-hairline bg-surface">
                {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
                <AvatarFallback className="bg-muted text-sm font-medium text-ink">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-float">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-semibold text-ink">{user?.full_name || 'User'}</p>
              {user?.email && (
                <p className="truncate text-xs font-normal text-ink-2">{user.email}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onNavigate?.('settings')}
              className="gap-2 cursor-pointer"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onNavigate?.('help')}
              className="gap-2 cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" aria-hidden />
              Help Center
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void signOut()}
              className="gap-2 cursor-pointer text-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
