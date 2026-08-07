import { useState, useEffect } from 'react';
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
  ChevronDown,
  History,
  Receipt,
  Store,
  CircleDollarSign,
  Truck,
  ShoppingCart,
  Package,
  Warehouse,
  X,
  TrendingUp,
  Factory,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { ShopLogo } from '@/components/branding/ShopLogo';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** Mobile: whether the sidebar drawer is open */
  mobileOpen?: boolean;
  /** Mobile: callback to close the drawer */
  onMobileClose?: () => void;
}

interface NavChild {
  id: string;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Roles that can see this nav item. If omitted, visible to all. */
  roles?: UserRole[];
  children?: NavChild[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const restaurantNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'order-line', label: 'Order Line', icon: ClipboardList },
  { id: 'order-history', label: 'Order History', icon: History },
  { id: 'accounts', label: 'Accounts', icon: CircleDollarSign, roles: ['admin', 'manager', 'cashier'] },
  { id: 'purchases', label: 'Purchases', icon: Truck, roles: ['admin', 'manager'] },
  { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, roles: ['admin', 'manager'] },
  { id: 'shop-day', label: 'Shop Day Close', icon: CalendarDays, roles: ['admin', 'manager'] },
  { id: 'manage-table', label: 'Manage Table', icon: Armchair, roles: ['admin', 'manager'] },
  { id: 'manage-dishes', label: 'Manage Dishes', icon: UtensilsCrossed, roles: ['admin', 'manager'] },
  { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'manager'] },
];

const retailNavSections: NavSection[] = [
  {
    label: 'Sales',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
      { id: 'order-history', label: 'Transactions', icon: Receipt },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { id: 'products', label: 'Products', icon: Package, roles: ['admin', 'manager'] },
      { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'Stock',
    items: [
      {
        id: 'inventory',
        label: 'Inventory',
        icon: Warehouse,
        roles: ['admin', 'manager'],
        children: [
          { id: 'inventory', label: 'Overview' },
          { id: 'inventory-assign-staff', label: 'Assign Staff Inventory' },
        ],
      },
      { id: 'production', label: 'Production', icon: Factory, roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'purchases', label: 'Purchases', icon: Truck, roles: ['admin', 'manager'] },
      { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, roles: ['admin', 'manager'] },
      { id: 'shop-day', label: 'Shop Day Close', icon: CalendarDays, roles: ['admin', 'manager'] },
      {
        id: 'accounts',
        label: 'Accounts',
        icon: CircleDollarSign,
        roles: ['admin', 'manager', 'cashier'],
      },
    ],
  },
];

/** Flat list of retail nav items for active-tab parent expansion. */
const retailNavItems: NavItem[] = retailNavSections.flatMap((section) => section.items);

const bottomNavItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin', 'manager'] },
  { id: 'help', label: 'Help Center', icon: HelpCircle },
];

function isNavGroupActive(item: NavItem, activeTab: string): boolean {
  if (item.children?.length) {
    return item.children.some((child) => child.id === activeTab);
  }
  return activeTab === item.id;
}

export function Sidebar({ activeTab, onTabChange, mobileOpen, onMobileClose }: SidebarProps) {
  const { isRestaurant, config } = useBusinessMode();
  const { user, signOut } = useAuth();
  const { companyName } = useCompanySettings();
  const allNavItems = isRestaurant ? restaurantNavItems : retailNavItems;
  const LogoIcon = isRestaurant ? UtensilsCrossed : Store;
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => new Set());

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

  useEffect(() => {
    const parentsToExpand = allNavItems.filter(
      (item) => item.children?.some((child) => child.id === activeTab),
    );
    if (parentsToExpand.length === 0) return;
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      parentsToExpand.forEach((item) => next.add(item.id));
      return next;
    });
  }, [activeTab, allNavItems]);

  const handleNavClick = (tab: string) => {
    onTabChange(tab);
    // Close mobile drawer on navigation
    onMobileClose?.();
  };

  const toggleMenuExpanded = (menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const hasChildren = Boolean(item.children?.length);
    const isGroupActive = isNavGroupActive(item, activeTab);
    const isExpanded = hasChildren && (expandedMenus.has(item.id) || isGroupActive);

    if (hasChildren) {
      return (
        <div key={item.id} className="space-y-1">
          <button
            onClick={() => toggleMenuExpanded(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative',
              isGroupActive
                ? 'bg-sidebar-primary/15 text-sidebar-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <Icon
              className={cn(
                'w-5 h-5 transition-transform duration-200',
                isGroupActive ? 'scale-110' : 'group-hover:scale-110',
              )}
            />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={cn(
                'w-4 h-4 opacity-70 transition-transform duration-200',
                isExpanded && 'rotate-180',
              )}
            />
          </button>
          {isExpanded && (
            <div className="ml-4 pl-3 border-l border-sidebar-border/50 space-y-1">
              {item.children!.map((child) => {
                const isChildActive = activeTab === child.id;
                return (
                  <button
                    key={child.id}
                    onClick={() => handleNavClick(child.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isChildActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    )}
                  >
                    <span className="flex-1 text-left">{child.label}</span>
                    {isChildActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        )}
      >
        <Icon
          className={cn(
            'w-5 h-5 transition-transform duration-200',
            isActive ? 'scale-110' : 'group-hover:scale-110',
          )}
        />
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
      </button>
    );
  };

  const sidebarContent = (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-sidebar h-full">
      {/* Logo Section */}
      <div className="p-6 pb-8 border-b border-sidebar-border/50">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <ShopLogo size="sidebar" fallbackIcon={LogoIcon} className="rounded-2xl shadow-lg" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-sidebar" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-xl leading-tight tracking-tight truncate">
              {companyName || 'POS'}
            </h1>
            <p className="text-xs text-sidebar-foreground/60 font-medium">{config.label} POS</p>
          </div>
        </div>
          {/* Close button – mobile only */}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            <X className="w-5 h-5 text-sidebar-foreground/70" />
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        {isRestaurant ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-2">
              Main Menu
            </p>
            {mainNavItems.map((item) => renderNavItem(item))}
          </div>
        ) : (
          <div className="space-y-5">
            {retailNavSections.map((section) => {
              const visibleItems = section.items.filter(
                (item) => !item.roles || item.roles.includes(userRole),
              );
              if (visibleItems.length === 0) return null;
              return (
                <div key={section.label} className="space-y-1.5">
                  <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3">
                    {section.label}
                  </p>
                  {visibleItems.map((item) => renderNavItem(item))}
                </div>
              );
            })}
          </div>
        )}
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
                onClick={() => handleNavClick(item.id)}
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

  return (
    <>
      {/* Desktop sidebar – always visible */}
      <div className="hidden lg:block shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile sidebar – slide-over drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="relative z-10 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
