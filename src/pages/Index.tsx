import { useState } from 'react';
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
import Purchases from '@/pages/Purchases';
import AccountsReceivable from '@/pages/AccountsReceivable';
import Settings from '@/pages/Settings';

function POSApp() {
  const { isSetup, isRestaurant } = useBusinessMode();
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Edge case: user authenticated but has no business_mode on their profile
  // (e.g. migrated user). Show mode selector so they can pick.
  if (isSetup) {
    return <ModeSelector />;
  }

  const handleNavigate = (tab: string) => {
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
    case 'purchases':
      return <Purchases onNavigate={handleNavigate} />;
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
