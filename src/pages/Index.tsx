import { useState } from 'react';
import { CartProvider } from '@/context/CartContext';
import OrderLine from '@/pages/OrderLine';
import ManageTable from '@/pages/ManageTable';
import ManageDishes from '@/pages/ManageDishes';

function POSApp() {
  const [currentPage, setCurrentPage] = useState('order-line');

  const handleNavigate = (tab: string) => {
    setCurrentPage(tab);
  };

  // Render current page
  switch (currentPage) {
    case 'order-line':
      return <OrderLine onNavigate={handleNavigate} />;
    case 'manage-table':
      return <ManageTable onNavigate={handleNavigate} />;
    case 'manage-dishes':
      return <ManageDishes onNavigate={handleNavigate} />;
    default:
      // For unimplemented pages, show OrderLine with the correct active tab
      return <OrderLine onNavigate={handleNavigate} />;
  }
}

export default function Index() {
  return (
    <CartProvider>
      <POSApp />
    </CartProvider>
  );
}
