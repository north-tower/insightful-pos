import { useState } from 'react';
import { CartProvider } from '@/context/CartContext';
import OrderLine from '@/pages/OrderLine';
import ManageTable from '@/pages/ManageTable';

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
