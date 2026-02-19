import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import { OrderCard } from '@/components/pos/OrderCard';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { MenuCard } from '@/components/pos/MenuCard';
import { CartPanelEnhanced as CartPanel } from '@/components/pos/CartPanelEnhanced';
import { OrderStatusTabs } from '@/components/pos/OrderStatusTabs';
import { IncomingOrdersQueue } from '@/components/order/IncomingOrdersQueue';
import { OrderQueueProvider } from '@/context/OrderQueueContext';
import { categories, menuItems, activeOrders } from '@/data/menuData';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const orderStatusTabs = [
  { id: 'all', label: 'All', count: 70 },
  { id: 'dine-in', label: 'Dine in', count: 4 },
  { id: 'waiting', label: 'Wait List', count: 3 },
  { id: 'takeaway', label: 'Take Away', count: 12 },
  { id: 'served', label: 'Served', count: 51 },
];

interface OrderLineProps {
  onNavigate: (tab: string) => void;
}

function OrderLineContent({ onNavigate }: OrderLineProps) {
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeOrderId, setActiveOrderId] = useState(activeOrders[0]?.id);
  const [showIncomingQueue, setShowIncomingQueue] = useState(true);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return menuItems;
    return menuItems.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <Sidebar activeTab="order-line" onTabChange={onNavigate} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />

          <div className="flex-1 flex overflow-hidden">
            {/* Incoming Orders Queue */}
            {showIncomingQueue && (
              <div className="w-80 border-r border-border overflow-y-auto">
                <IncomingOrdersQueue className="h-full rounded-none border-0" />
              </div>
            )}

            {/* Menu Area */}
            <div className="flex-1 p-6 overflow-y-auto">
            {/* Order Status */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-4">Order Line</h1>
              <OrderStatusTabs
                tabs={orderStatusTabs}
                activeTab={activeStatus}
                onTabChange={setActiveStatus}
              />
            </div>

            {/* Active Orders */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isActive={activeOrderId === order.id}
                      onClick={() => setActiveOrderId(order.id)}
                    />
                  ))}
                </div>
                <div className="flex gap-2 ml-4">
                  <button className="p-2 rounded-full bg-card border border-border hover:bg-muted transition-colors">
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button className="p-2 rounded-full bg-card border border-border hover:bg-muted transition-colors">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>

            {/* Menu Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Foodies Menu</h2>
                <div className="flex gap-2">
                  <button className="p-2 rounded-full bg-card border border-border hover:bg-muted transition-colors">
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button className="p-2 rounded-full bg-card border border-border hover:bg-muted transition-colors">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />

              {/* Menu Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                {filteredItems.map((item) => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>

          {/* Cart Panel */}
          <CartPanel />
        </div>
      </div>
    </div>
  );
}

export default function OrderLine({ onNavigate }: OrderLineProps) {
  return (
    <OrderQueueProvider>
      <OrderLineContent onNavigate={onNavigate} />
    </OrderQueueProvider>
  );
}
