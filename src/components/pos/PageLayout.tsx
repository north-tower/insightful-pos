import { useState } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import { GlobalSearchField } from '@/components/pos/GlobalSearchField';
import { ThemeToggle } from '@/components/ThemeToggle';
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
  flexContent?: boolean;
  hideBottomNav?: boolean;
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
    <div className="flex h-screen overflow-hidden bg-paper">
      <a
        href="#main-content"
        className="focus-ring sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius)] focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink"
      >
        Skip to main content
      </a>

      <Sidebar
        activeTab={activeTab}
        onTabChange={onNavigate}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        mobileDrawerTop={!hideHeaderSearch ? <GlobalSearchField /> : undefined}
        mobileDrawerFooter={
          <div className="flex h-11 min-h-11 items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink-2">Theme</span>
            <ThemeToggle />
          </div>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DemoModeBanner />
        <Header
          onMenuToggle={() => setMobileMenuOpen(true)}
          hideSearch={hideHeaderSearch}
        />

        {flexContent ? (
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden outline-none lg:flex-row lg:pb-0',
              showBottomNav
                ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))]'
                : 'pb-[env(safe-area-inset-bottom,0px)]',
            )}
          >
            {children}
          </main>
        ) : (
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              'min-h-0 flex-1 overflow-y-auto p-3 outline-none sm:p-4 lg:p-6 lg:pb-6',
              showBottomNav
                ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))]'
                : 'pb-4',
            )}
          >
            {children}
          </main>
        )}

        {showBottomNav && (
          <nav
            aria-label="Quick navigation"
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-hairline bg-surface md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex h-16 items-stretch justify-around">
              {bottomNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'focus-ring relative flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] flex-1 flex-col items-center justify-center gap-0.5 px-1',
                      isActive
                        ? 'font-semibold text-ink before:absolute before:left-2 before:right-2 before:top-0 before:h-[3px] before:rounded-full before:bg-primary before:content-[""]'
                        : 'text-ink-2',
                    )}
                  >
                    <Icon
                      className={cn('h-5 w-5', isActive && 'text-primary')}
                      aria-hidden
                    />
                    <span className="text-xs">{item.label}</span>
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
