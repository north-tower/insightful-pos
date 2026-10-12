import { type ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Armchair,
  UtensilsCrossed,
  Users,
  Settings,
  HelpCircle,
  LogOut,
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
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { ShopLogo } from '@/components/branding/ShopLogo';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Full-width row at top of the mobile drawer (global search). */
  mobileDrawerTop?: ReactNode;
  /** Extra controls in the mobile drawer footer (e.g. theme toggle). */
  mobileDrawerFooter?: ReactNode;
}

interface NavChild {
  id: string;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
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

const navRowClass =
  'focus-ring relative flex w-full items-center gap-3 rounded-[var(--radius)] px-3 text-sm font-medium text-ink hover:bg-muted motion-reduce:transition-none h-10 min-h-10 [@media(pointer:coarse)]:min-h-[var(--tap-min)]';

function activeNavClass(isActive: boolean) {
  return isActive
    ? 'bg-[hsl(var(--accent-soft))] font-semibold before:absolute before:bottom-1 before:left-0 before:top-1 before:w-[3px] before:rounded-full before:bg-primary before:content-[""]'
    : '';
}

export function Sidebar({
  activeTab,
  onTabChange,
  mobileOpen,
  onMobileClose,
  mobileDrawerTop,
  mobileDrawerFooter,
}: SidebarProps) {
  const { isRestaurant, config } = useBusinessMode();
  const { user, signOut } = useAuth();
  const { companyName } = useCompanySettings();
  const allNavItems = isRestaurant ? restaurantNavItems : retailNavItems;
  const LogoIcon = isRestaurant ? UtensilsCrossed : Store;
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => new Set());
  const navScrollRef = useRef<HTMLElement>(null);
  const [navScrollState, setNavScrollState] = useState({ top: false, bottom: false });

  const userRole = user?.role || 'cashier';
  const mainNavItems = allNavItems.filter((item) => !item.roles || item.roles.includes(userRole));
  const visibleBottomItems = bottomNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole),
  );

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  const updateNavScrollEdges = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 0;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setNavScrollState({ top, bottom });
  }, []);

  useEffect(() => {
    updateNavScrollEdges();
  }, [activeTab, mobileOpen, updateNavScrollEdges]);

  const handleLogout = async () => {
    await signOut();
  };

  useEffect(() => {
    const parentsToExpand = allNavItems.filter((item) =>
      item.children?.some((child) => child.id === activeTab),
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

  const renderNavItem = (item: NavItem, compact?: boolean) => {
    const Icon = item.icon;
    const hasChildren = Boolean(item.children?.length);
    const isGroupActive = isNavGroupActive(item, activeTab);
    const isExpanded = hasChildren && (expandedMenus.has(item.id) || isGroupActive);

    if (hasChildren && compact) {
      const defaultChildId = item.children![0]?.id ?? item.id;
      const isActive = isNavGroupActive(item, activeTab);
      const button = (
        <button
          key={item.id}
          type="button"
          onClick={() => handleNavClick(defaultChildId)}
          aria-current={isActive ? 'page' : undefined}
          aria-label={item.label}
          className={cn(navRowClass, activeNavClass(isActive), 'justify-center px-0')}
        >
          <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} aria-hidden />
        </button>
      );
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="shadow-float">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    if (hasChildren && !compact) {
      return (
        <div key={item.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleMenuExpanded(item.id)}
            aria-expanded={isExpanded}
            className={cn(navRowClass, activeNavClass(isGroupActive))}
          >
            <Icon
              className={cn('h-5 w-5 shrink-0', isGroupActive && 'text-primary')}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-ink-2 motion-reduce:transition-none transition-transform duration-200',
                isExpanded && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
          {isExpanded && (
            <div className="ml-3 space-y-0.5 border-l border-hairline pl-3">
              {item.children!.map((child) => {
                const isChildActive = activeTab === child.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => handleNavClick(child.id)}
                    aria-current={isChildActive ? 'page' : undefined}
                    className={cn(navRowClass, activeNavClass(isChildActive))}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{child.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isActive = activeTab === item.id;

    const button = (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavClick(item.id)}
        aria-current={isActive ? 'page' : undefined}
        aria-label={compact ? item.label : undefined}
        className={cn(
          navRowClass,
          activeNavClass(isActive),
          compact && 'justify-center px-0',
        )}
      >
        <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} aria-hidden />
        {!compact && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
      </button>
    );

    if (compact) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="shadow-float">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  const renderMainNav = (compact?: boolean) => {
    if (isRestaurant) {
      return (
        <div className="space-y-1">
          {!compact && (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-ink-2">
              Main Menu
            </p>
          )}
          {compact && <div className="mx-2 border-t border-hairline" aria-hidden />}
          {mainNavItems.map((item) => renderNavItem(item, compact))}
        </div>
      );
    }

    return (
      <div className={cn(compact ? 'space-y-2' : 'space-y-4')}>
        {retailNavSections.map((section, index) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || item.roles.includes(userRole),
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="space-y-0.5">
              {compact ? (
                index > 0 && <div className="mx-2 border-t border-hairline" aria-hidden />
              ) : (
                <p className="px-3 pb-0.5 text-xs font-medium uppercase tracking-wider text-ink-2">
                  {section.label}
                </p>
              )}
              {visibleItems.map((item) => renderNavItem(item, compact))}
            </div>
          );
        })}
      </div>
    );
  };

  const logoBlock = (showClose: boolean) => (
    <div className="shrink-0 border-b border-hairline px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <ShopLogo
            size="sidebar"
            fallbackIcon={LogoIcon}
            className="!h-10 !w-10 !max-w-[2.5rem] rounded-[var(--radius)] border border-hairline bg-surface shadow-none [&>div]:!h-10 [&>div]:!w-10 [&>div]:rounded-[var(--radius)] [&>div]:border [&>div]:border-hairline [&>div]:bg-surface [&>div]:shadow-none"
          />
          <div className="min-w-0">
            <h1 className="truncate font-sans text-base font-semibold leading-tight text-ink">
              {companyName || 'POS'}
            </h1>
            <p className="text-xs font-medium text-ink-2">{config.label} POS</p>
          </div>
        </div>
        {showClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)] text-ink hover:bg-muted md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );

  const userBlock = (compact?: boolean) => (
    <div className={cn('shrink-0 border-t border-hairline px-3 py-3', compact && 'flex justify-center px-2')}>
      <div
        className={cn(
          'flex items-center gap-3',
          compact ? 'justify-center' : 'px-1',
        )}
      >
        <Avatar className="h-10 w-10 border border-hairline bg-surface">
          {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
          <AvatarFallback className="bg-muted text-sm font-medium text-ink">{initials}</AvatarFallback>
        </Avatar>
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user?.full_name || 'User'}</p>
            <p className="text-xs text-ink-2">{roleLabel}</p>
          </div>
        )}
      </div>
    </div>
  );

  const footerActions = (compact?: boolean) => (
    <div className="shrink-0 space-y-0.5 border-t border-hairline px-3 py-3">
      {visibleBottomItems.map((item) => {
        const Icon = item.icon;
        if (compact) {
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-label={item.label}
                  className="focus-ring flex h-10 w-full items-center justify-center rounded-[var(--radius)] text-ink hover:bg-muted [@media(pointer:coarse)]:min-h-[var(--tap-min)]"
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="shadow-float">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavClick(item.id)}
            className={cn(navRowClass, 'text-ink-2 hover:text-ink')}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </button>
        );
      })}
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Logout"
              className="focus-ring flex h-10 w-full items-center justify-center rounded-[var(--radius)] text-ink hover:bg-muted [@media(pointer:coarse)]:min-h-[var(--tap-min)]"
            >
              <LogOut className="h-5 w-5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="shadow-float">
            Logout
          </TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={() => void handleLogout()}
          className={cn(navRowClass, 'text-ink hover:text-ink')}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          Logout
        </button>
      )}
    </div>
  );

  const navRegion = (compact?: boolean) => (
    <nav
      ref={navScrollRef}
      aria-label="Primary"
      onScroll={updateNavScrollEdges}
      className={cn(
        'shell-nav-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2',
        navScrollState.top && 'shell-nav-scroll--top',
        navScrollState.bottom && 'shell-nav-scroll--bottom',
      )}
    >
      {renderMainNav(compact)}
    </nav>
  );

  const fullSidebarInner = (
    <>
      {logoBlock(false)}
      {navRegion(false)}
      {userBlock(false)}
      {footerActions(false)}
    </>
  );

  const drawerInner = (
    <>
      {mobileDrawerTop && (
        <div className="shrink-0 border-b border-hairline px-4 py-3">{mobileDrawerTop}</div>
      )}
      {logoBlock(true)}
      {navRegion(false)}
      {mobileDrawerFooter && (
        <div className="shrink-0 border-t border-hairline px-4 py-2">{mobileDrawerFooter}</div>
      )}
      {userBlock(false)}
      {footerActions(false)}
    </>
  );

  const railInner = (
    <>
      <div className="flex shrink-0 justify-center border-b border-hairline py-3">
        <ShopLogo
          size="sidebar"
          fallbackIcon={LogoIcon}
          className="!h-10 !w-10 !max-w-[2.5rem] rounded-[var(--radius)] border border-hairline bg-surface shadow-none [&>div]:!h-10 [&>div]:!w-10 [&>div]:rounded-[var(--radius)] [&>div]:border [&>div]:border-hairline [&>div]:bg-surface"
        />
      </div>
      {navRegion(true)}
      {userBlock(true)}
      {footerActions(true)}
    </>
  );

  const asideClass =
    'flex h-full flex-col border-hairline bg-surface text-ink';

  return (
    <TooltipProvider delayDuration={300}>
      {/* Desktop sidebar */}
      <div className="hidden h-full shrink-0 lg:block">
        <aside className={cn(asideClass, 'w-64 border-r')}>{fullSidebarInner}</aside>
      </div>

      {/* Tablet icon rail */}
      <div className="hidden h-full shrink-0 md:block lg:hidden">
        <aside className={cn(asideClass, 'w-[4.5rem] border-r')}>{railInner}</aside>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-ink/40 motion-reduce:transition-none"
            onClick={onMobileClose}
            aria-hidden
          />
          <aside
            className={cn(
              asideClass,
              'relative z-10 w-64 max-w-[85vw] shadow-float motion-reduce:animate-none animate-in slide-in-from-left duration-300',
            )}
          >
            {drawerInner}
          </aside>
        </div>
      )}
    </TooltipProvider>
  );
}
