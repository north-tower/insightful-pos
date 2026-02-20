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

interface PageLayoutProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  children: React.ReactNode;
  /** If true, the content area uses flex row layout (e.g. POS with cart panel) */
  flexContent?: boolean;
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
export function PageLayout({ activeTab, onNavigate, children, flexContent }: PageLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isRestaurant } = useBusinessMode();

  const bottomNav = isRestaurant ? restaurantBottomNav : retailBottomNav;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onNavigate}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuToggle={() => setMobileMenuOpen(true)} />

        {flexContent ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden pb-14 lg:pb-0">
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 pb-16 lg:pb-6">
            {children}
          </div>
        )}

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
          <div className="flex items-center justify-around h-14">
            {bottomNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground active:text-foreground'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isActive && 'scale-110')} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
