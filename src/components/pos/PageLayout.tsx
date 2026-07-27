import { useState } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  ClipboardList,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { DemoModeBanner } from '@/components/pos/DemoModeBanner';

interface PageLayoutProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  children: React.ReactNode;
  /** If true, the content area uses flex row layout (e.g. POS with cart panel) */
  flexContent?: boolean;
  /**
   * Hide the mobile bottom tab bar (e.g. while the POS cart/checkout sheet is open
   * so the sticky Complete Sale bar isn't competing for thumb space).
   */
  hideBottomNav?: boolean;
  /** Hide the global header search (e.g. POS has its own product search). */
  hideHeaderSearch?: boolean;
}

interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const restaurantBottomNav: BottomNavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'order-line', label: 'Orders', icon: ClipboardList },
  { id: 'order-history', label: 'History', icon: Receipt },
  { id: 'customers', label: 'Customers', icon: Users },
];

const retailBottomNav: BottomNavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'order-history', label: 'History', icon: Receipt },
  { id: 'customers', label: 'Customers', icon: Users },
];

/**
 * Shared page layout: responsive sidebar + header + content area.
 * Desktop: sidebar always visible on the left.
 * Mobile: sidebar hidden behind a hamburger menu overlay + bottom nav bar.
 */
export function PageLayout({
  activeTab,
  onNavigate,
  children,
  flexContent,
  hideBottomNav = false,
  hideHeaderSearch = false,
}: PageLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isRestaurant } = useBusinessMode();

  const bottomNav = isRestaurant ? restaurantBottomNav : retailBottomNav;
  const showBottomNav = !hideBottomNav;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onNavigate}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DemoModeBanner />
        <Header
          onMenuToggle={() => setMobileMenuOpen(true)}
          hideSearch={hideHeaderSearch}
        />

        {flexContent ? (
          <div
            className={cn(
              'flex-1 flex flex-col lg:flex-row overflow-hidden lg:pb-0',
              showBottomNav
                ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'
                : 'pb-[env(safe-area-inset-bottom,0px)]',
            )}
          >
            {children}
          </div>
        ) : (
          <div
            className={cn(
              'flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 lg:pb-6',
              showBottomNav
                ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))]'
                : 'pb-4',
            )}
          >
            {children}
          </div>
        )}

        {/* Mobile Bottom Navigation — Home / POS / History / Customers */}
        {showBottomNav && (
          <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex h-14 items-center justify-around">
              {bottomNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 transition-colors',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground active:text-foreground',
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isActive && 'scale-110')} />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
