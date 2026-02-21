import { Search, Bell, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { config, isRestaurant } = useBusinessMode();
  const { user } = useAuth();

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

  return (
    <header className="h-14 lg:h-16 bg-card border-b border-border px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2">
      {/* Left Side */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>

        {/* Search — hide on very small screens, show on sm+ */}
        <div className="relative hidden sm:block sm:w-48 md:w-64 lg:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
            placeholder={searchPlaceholder}
          className="pl-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
        />
        </div>

        {/* Mode badge — hidden on xs, visible on md+ */}
        <Badge variant="outline" className="hidden md:flex text-xs font-medium text-muted-foreground shrink-0">
          {config.icon} {config.label}
        </Badge>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Mobile search button */}
        <button className="sm:hidden p-2 rounded-full hover:bg-muted transition-colors">
          <Search className="w-5 h-5 text-muted-foreground" />
        </button>

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
          {/* Name/role — hidden on mobile */}
          <div className="hidden md:block text-sm">
            <p className="font-semibold text-foreground">{user?.full_name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
