import { type ReactNode, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Armchair,
  UtensilsCrossed,
  Users,
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
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { ShopLogo } from '@/components/branding/ShopLogo';
import { StoreSwitcher } from '@/components/pos/StoreSwitcher';
import { SidebarSyncFooter } from '@/components/pos/SidebarSyncFooter';
import { useProducts } from '@/hooks/useProducts';
import { getStockStatus } from '@/lib/stockStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const SIDEBAR_COLLAPSED_KEY = 'insightful-pos:sidebar-collapsed';

const RETAIL_CASHIER_NAV_IDS = new Set(['pos', 'order-history', 'shop-day']);

function readSidebarCollapsedPreference(): boolean | null {
  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
  } catch {
    /* ignore */
  }
  return null;
}

function defaultSidebarCollapsed(activeTab: string): boolean {
  if (activeTab === 'pos') return true;
  if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
    return false;
  }
  return true;
}

function persistSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    /* ignore */
  }
}

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

function isItemVisibleInNav(
  item: NavItem,
  userRole: UserRole,
  isRestaurant: boolean,
): boolean {
  if (!isRestaurant && userRole === 'cashier') {
    return RETAIL_CASHIER_NAV_IDS.has(item.id);
  }
  return !item.roles || item.roles.includes(userRole);
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
  const { user } = useAuth();
  const { activeBranch, branches } = useBranch();
  const { companyName } = useCompanySettings();
  const { retailProducts } = useProducts();
  const allNavItems = isRestaurant ? restaurantNavItems : retailNavItems;
  const LogoIcon = isRestaurant ? UtensilsCrossed : Store;
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => new Set());
  const navScrollRef = useRef<HTMLElement>(null);
  const [navScrollState, setNavScrollState] = useState({ top: false, bottom: false });
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    const saved = readSidebarCollapsedPreference();
    return saved ?? defaultSidebarCollapsed(activeTab);
  });

  const userRole = user?.role || 'cashier';
  const mainNavItems = allNavItems.filter((item) =>
    isItemVisibleInNav(item, userRole, isRestaurant),
  );

  const lowStockCount = useMemo(() => {
    if (isRestaurant) return 0;
    return retailProducts.filter((p) => getStockStatus(p) === 'low').length;
  }, [retailProducts, isRestaurant]);

  const storeDisplayName =
    branches.length > 0
      ? activeBranch?.is_headquarters
        ? `${activeBranch?.name} (HQ)`
        : activeBranch?.name ?? 'Store'
      : companyName || 'Store';

  useEffect(() => {
    if (readSidebarCollapsedPreference() !== null) return;
    setDesktopCollapsed(defaultSidebarCollapsed(activeTab));
  }, [activeTab]);

  const toggleDesktopCollapsed = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      persistSidebarCollapsed(next);
      return next;
    });
  };

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
          compact && 'relative justify-center px-0',
        )}
      >
        <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} aria-hidden />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
            {item.id === 'inventory' && lowStockCount > 0 && (
              <span
                className="num flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent-soft))] px-1.5 text-xs font-semibold text-primary"
                aria-label={`${lowStockCount} low stock`}
              >
                {lowStockCount}
              </span>
            )}
          </>
        )}
        {compact && item.id === 'inventory' && lowStockCount > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-semibold text-primary-foreground"
            aria-hidden
          >
            {lowStockCount > 9 ? '9+' : lowStockCount}
          </span>
        )}
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
          const visibleItems = section.items.filter((item) =>
            isItemVisibleInNav(item, userRole, isRestaurant),
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

  const showNewSale = !isRestaurant && activeTab !== 'pos';

  const newSaleButton = (compact?: boolean) => {
    if (!showNewSale) return null;

    const button = (
      <Button
        type="button"
        variant="default"
        onClick={() => handleNavClick('pos')}
        className={cn(
          'focus-ring w-full gap-2 font-semibold shadow-none',
          compact ? 'h-10 w-10 px-0' : 'h-10 min-h-10',
        )}
        aria-label={compact ? 'New sale' : undefined}
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        {!compact && 'New sale'}
      </Button>
    );

    if (compact) {
      return (
        <div className="mb-2 flex justify-center px-1">
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" className="shadow-float">
              New sale
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    return <div className="mb-3 px-1">{button}</div>;
  };

  const collapseToggle = (compact: boolean) => (
    <div
      className={cn(
        'shrink-0 border-t border-hairline p-2',
        compact && 'flex justify-center',
      )}
    >
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleDesktopCollapsed}
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-ink-2 hover:bg-muted hover:text-ink"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="shadow-float">
            Expand sidebar
          </TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={toggleDesktopCollapsed}
          className="focus-ring flex h-10 w-full items-center gap-2 rounded-[var(--radius)] px-3 text-sm font-medium text-ink-2 hover:bg-muted hover:text-ink"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
          Collapse
        </button>
      )}
    </div>
  );

  const logoBlock = (showClose: boolean, compact?: boolean) => {
    if (compact) {
      return (
        <div className="flex shrink-0 justify-center border-b border-hairline py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-[var(--radius)]">
                <ShopLogo
                  size="sidebar"
                  fallbackIcon={LogoIcon}
                  className="!h-10 !w-10 !max-w-[2.5rem] rounded-[var(--radius)] border border-hairline bg-surface shadow-none [&>div]:!h-10 [&>div]:!w-10 [&>div]:rounded-[var(--radius)] [&>div]:border [&>div]:border-hairline [&>div]:bg-surface"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="shadow-float">
              {storeDisplayName}
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    return (
      <div className="shrink-0 border-b border-hairline px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ShopLogo
              size="sidebar"
              fallbackIcon={LogoIcon}
              className="!h-10 !w-10 !max-w-[2.5rem] shrink-0 rounded-[var(--radius)] border border-hairline bg-surface shadow-none [&>div]:!h-10 [&>div]:!w-10 [&>div]:rounded-[var(--radius)] [&>div]:border [&>div]:border-hairline [&>div]:bg-surface [&>div]:shadow-none"
            />
            <div className="min-w-0 flex-1">
              {branches.length > 0 ? (
                <StoreSwitcher className="h-auto max-w-full border-0 bg-transparent p-0 text-base font-semibold shadow-none [&>span]:font-semibold" />
              ) : (
                <h1 className="truncate font-sans text-base font-semibold leading-tight text-ink">
                  {companyName || 'POS'}
                </h1>
              )}
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
  };

  const navRegion = (compact?: boolean, drawer?: boolean) => (
    <nav
      ref={navScrollRef}
      aria-label="Primary"
      onScroll={updateNavScrollEdges}
      className={cn(
        'shell-nav-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2',
        drawer && 'min-h-[60%]',
        navScrollState.top && 'shell-nav-scroll--top',
        navScrollState.bottom && 'shell-nav-scroll--bottom',
      )}
    >
      {newSaleButton(compact)}
      {renderMainNav(compact)}
    </nav>
  );

  const sidebarInner = (compact: boolean, options?: { drawer?: boolean; showCollapse?: boolean }) => (
    <>
      {logoBlock(Boolean(options?.drawer), compact)}
      {navRegion(compact, options?.drawer)}
      {options?.drawer && mobileDrawerFooter && (
        <div className="shrink-0 border-t border-hairline px-3 py-1.5">{mobileDrawerFooter}</div>
      )}
      <SidebarSyncFooter compact={compact} />
      {options?.showCollapse && collapseToggle(compact)}
    </>
  );

  const asideClass =
    'flex h-full flex-col border-hairline bg-surface text-ink';

  return (
    <TooltipProvider delayDuration={300}>
      {/* Desktop / tablet sidebar */}
      <div className="hidden h-full shrink-0 md:block">
        <aside
          className={cn(
            asideClass,
            'motion-reduce:transition-none border-r transition-[width] duration-200 ease-linear',
            desktopCollapsed ? 'w-[4.5rem]' : 'w-64',
          )}
        >
          {sidebarInner(desktopCollapsed, { showCollapse: true })}
        </aside>
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
              'relative z-10 h-full max-h-[100dvh] w-[min(320px,85vw)] shadow-float motion-reduce:animate-none animate-in slide-in-from-left duration-300',
            )}
          >
            {mobileDrawerTop && (
              <div className="shrink-0 border-b border-hairline px-4 py-3">{mobileDrawerTop}</div>
            )}
            {sidebarInner(false, { drawer: true })}
          </aside>
        </div>
      )}
    </TooltipProvider>
  );
}
