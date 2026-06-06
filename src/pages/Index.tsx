import { useEffect, useMemo, useState } from 'react';
import { CartProvider } from '@/context/CartContext';
import { useBusinessMode } from '@/context/BusinessModeContext';
import ModeSelector from '@/pages/ModeSelector';
import Dashboard from '@/pages/Dashboard';
import OrderLine from '@/pages/OrderLine';
import OrderHistory from '@/pages/OrderHistory';
import CustomerManagement from '@/pages/CustomerManagement';
import ManageTable from '@/pages/ManageTable';
import ManageDishes from '@/pages/ManageDishes';
import RetailDashboard from '@/pages/RetailDashboard';
import RetailPOS from '@/pages/RetailPOS';
import RetailProducts from '@/pages/RetailProducts';
import RetailInventory from '@/pages/RetailInventory';
import RetailStaffInventory from '@/pages/RetailStaffInventory';
import Purchases from '@/pages/Purchases';
import AccountsReceivable from '@/pages/AccountsReceivable';
import ProfitLossReport from '@/pages/ProfitLossReport';
import RetailProduction from '@/pages/RetailProduction';
import Settings from '@/pages/Settings';

const RESTAURANT_TABS = new Set([
  'dashboard',
  'order-line',
  'order-history',
  'customers',
  'accounts',
  'purchases',
  'profit-loss',
  'manage-table',
  'manage-dishes',
  'settings',
]);

const RETAIL_TABS = new Set([
  'dashboard',
  'pos',
  'products',
  'inventory',
  'inventory-assign-staff',
  'production',
  'purchases',
  'profit-loss',
  'order-history',
  'accounts',
  'customers',
  'settings',
]);

function isValidTab(tab: string, isRestaurant: boolean): boolean {
  return isRestaurant ? RESTAURANT_TABS.has(tab) : RETAIL_TABS.has(tab);
}

function defaultTab(): string {
  return 'dashboard';
}

function POSApp() {
  const { isSetup, isRestaurant } = useBusinessMode();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const navigationStorageKey = useMemo(
    () => (isRestaurant ? 'insightful-pos:last-tab:restaurant' : 'insightful-pos:last-tab:retail'),
    [isRestaurant],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTab = window.localStorage.getItem(navigationStorageKey);
    if (storedTab && isValidTab(storedTab, isRestaurant)) {
      setCurrentPage(storedTab);
      return;
    }
    setCurrentPage(defaultTab());
  }, [isRestaurant, navigationStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isValidTab(currentPage, isRestaurant)) return;
    window.localStorage.setItem(navigationStorageKey, currentPage);
  }, [currentPage, isRestaurant, navigationStorageKey]);

  // Edge case: user authenticated but has no business_mode on their profile
  // (e.g. migrated user). Show mode selector so they can pick.
  if (isSetup) {
    return <ModeSelector />;
  }

  const handleNavigate = (tab: string) => {
    if (!isValidTab(tab, isRestaurant)) return;
    setCurrentPage(tab);
  };

  // ─── Restaurant mode pages ────────────────────────────────────────────────
  if (isRestaurant) {
  switch (currentPage) {
    case 'dashboard':
      return <Dashboard onNavigate={handleNavigate} />;
    case 'order-line':
      return <OrderLine onNavigate={handleNavigate} />;
    case 'order-history':
      return <OrderHistory onNavigate={handleNavigate} />;
    case 'customers':
      return <CustomerManagement onNavigate={handleNavigate} />;
      case 'accounts':
        return <AccountsReceivable onNavigate={handleNavigate} />;
    case 'purchases':
      return <Purchases onNavigate={handleNavigate} />;
    case 'profit-loss':
      return <ProfitLossReport onNavigate={handleNavigate} />;
    case 'manage-table':
      return <ManageTable onNavigate={handleNavigate} />;
    case 'manage-dishes':
      return <ManageDishes onNavigate={handleNavigate} />;
    case 'settings':
      return <Settings onNavigate={handleNavigate} />;
    default:
      return <Dashboard onNavigate={handleNavigate} />;
    }
  }

  // ─── Retail mode pages ────────────────────────────────────────────────────
  switch (currentPage) {
    case 'dashboard':
      return <RetailDashboard onNavigate={handleNavigate} />;
    case 'pos':
      return <RetailPOS onNavigate={handleNavigate} />;
    case 'products':
      return <RetailProducts onNavigate={handleNavigate} />;
    case 'inventory':
      return <RetailInventory onNavigate={handleNavigate} />;
    case 'inventory-assign-staff':
      return <RetailStaffInventory onNavigate={handleNavigate} />;
    case 'production':
      return <RetailProduction onNavigate={handleNavigate} />;
    case 'purchases':
      return <Purchases onNavigate={handleNavigate} />;
    case 'profit-loss':
      return <ProfitLossReport onNavigate={handleNavigate} />;
    case 'order-history':
      return <OrderHistory onNavigate={handleNavigate} />;
    case 'accounts':
      return <AccountsReceivable onNavigate={handleNavigate} />;
    case 'customers':
      return <CustomerManagement onNavigate={handleNavigate} />;
    case 'settings':
      return <Settings onNavigate={handleNavigate} />;
    default:
      return <RetailDashboard onNavigate={handleNavigate} />;
  }
}

export default function Index() {
  return (
    <CartProvider>
      <POSApp />
    </CartProvider>
  );
}
