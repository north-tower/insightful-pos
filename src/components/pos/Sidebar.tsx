import { 
  LayoutDashboard, 
  ClipboardList, 
  Armchair, 
  UtensilsCrossed,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  History,
  ShoppingCart,
  Package,
  Warehouse,
  Receipt,
  Store,
  CircleDollarSign,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth, UserRole } from '@/context/AuthContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Roles that can see this nav item. If omitted, visible to all. */
  roles?: UserRole[];
}

const restaurantNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'order-line', label: 'Order Line', icon: ClipboardList },
  { id: 'order-history', label: 'Order History', icon: History },
  { id: 'accounts', label: 'Accounts', icon: CircleDollarSign, roles: ['admin', 'manager', 'cashier'] },
  { id: 'manage-table', label: 'Manage Table', icon: Armchair, roles: ['admin', 'manager'] },
  { id: 'manage-dishes', label: 'Manage Dishes', icon: UtensilsCrossed, roles: ['admin', 'manager'] },
  { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'manager'] },
];

const retailNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
  { id: 'products', label: 'Products', icon: Package, roles: ['admin', 'manager'] },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, roles: ['admin', 'manager'] },
  { id: 'order-history', label: 'Transactions', icon: Receipt },
  { id: 'accounts', label: 'Accounts', icon: CircleDollarSign, roles: ['admin', 'manager', 'cashier'] },
  { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'manager'] },
];

const bottomNavItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  { id: 'help', label: 'Help Center', icon: HelpCircle },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { isRestaurant, config } = useBusinessMode();
  const { user, signOut } = useAuth();
  const allNavItems = isRestaurant ? restaurantNavItems : retailNavItems;
  const LogoIcon = isRestaurant ? UtensilsCrossed : Store;

  // Filter nav items by the current user's role
  const userRole = user?.role || 'cashier';
  const mainNavItems = allNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );
  const visibleBottomItems = bottomNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  // Compute user initials from full name
  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-sidebar">
      {/* Logo Section */}
      <div className="p-6 pb-8 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-sidebar-primary to-sidebar-accent rounded-2xl flex items-center justify-center shadow-lg">
              <LogoIcon className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-sidebar"></div>
          </div>
          <div>
            <h1 className="font-bold text-xl leading-tight tracking-tight">Nexus</h1>
            <p className="text-xs text-sidebar-foreground/60 font-medium">{config.label} POS</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-3">
            Main Menu
          </p>
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className={cn(
                  'w-5 h-5 transition-transform duration-200',
                  isActive ? 'scale-110' : 'group-hover:scale-110'
                )} />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 opacity-70" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sidebar-accent transition-colors cursor-pointer group">
          <Avatar className="w-10 h-10 border-2 border-sidebar-primary/30">
            {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
            <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {user?.full_name || 'User'}
            </p>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-4 font-medium border-sidebar-border/50',
                  userRole === 'admin' && 'text-primary border-primary/30',
                  userRole === 'manager' && 'text-info border-info/30',
                  userRole === 'cashier' && 'text-sidebar-foreground/60',
                )}
              >
                {roleLabel}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="px-4 pb-6 border-t border-sidebar-border/50 pt-4">
        <div className="space-y-1">
          {visibleBottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
