import { useState, useMemo } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { OrderCard } from '@/components/pos/OrderCard';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { MenuCard } from '@/components/pos/MenuCard';
import { CartPanelEnhanced as CartPanel } from '@/components/pos/CartPanelEnhanced';
import { OrderStatusTabs } from '@/components/pos/OrderStatusTabs';
import { IncomingOrdersQueue } from '@/components/order/IncomingOrdersQueue';
import { OrderQueueProvider } from '@/context/OrderQueueContext';
import { useProducts } from '@/hooks/useProducts';
import { activeOrders } from '@/data/menuData';
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
  const { menuItems, categories, loading } = useProducts();
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeOrderId, setActiveOrderId] = useState(activeOrders[0]?.id);
  const [showIncomingQueue, setShowIncomingQueue] = useState(true);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return menuItems;
    return menuItems.filter((item) => item.category === activeCategory);
  }, [activeCategory, menuItems]);

  return (
    <PageLayout activeTab="order-line" onNavigate={onNavigate} flexContent>
          {/* Incoming Orders Queue — hidden on mobile, visible on lg+ */}
            {showIncomingQueue && (
            <div className="hidden lg:block w-80 border-r border-border overflow-y-auto shrink-0">
                <IncomingOrdersQueue className="h-full rounded-none border-0" />
              </div>
            )}

            {/* Menu Area */}
          <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto min-w-0">
            {/* Order Status */}
            <div className="mb-4 lg:mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Order Line</h1>
              <div className="overflow-x-auto scrollbar-hide">
              <OrderStatusTabs
                tabs={orderStatusTabs}
                activeTab={activeStatus}
                onTabChange={setActiveStatus}
              />
              </div>
            </div>

            {/* Active Orders */}
            <div className="mb-6 lg:mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-2 flex-1">
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isActive={activeOrderId === order.id}
                      onClick={() => setActiveOrderId(order.id)}
                    />
                  ))}
                </div>
                <div className="hidden sm:flex gap-2 ml-4 shrink-0">
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
                <h2 className="text-lg sm:text-xl font-bold text-foreground">Foodies Menu</h2>
                <div className="hidden sm:flex gap-2">
                  <button className="p-2 rounded-full bg-card border border-border hover:bg-muted transition-colors">
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button className="p-2 rounded-full bg-card border border-border hover:bg-muted transition-colors">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto scrollbar-hide">
              <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
              </div>

              {/* Menu Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
                {filteredItems.map((item) => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>

          {/* Cart Panel */}
          <CartPanel />
    </PageLayout>
  );
}

export default function OrderLine({ onNavigate }: OrderLineProps) {
  return (
    <OrderQueueProvider>
      <OrderLineContent onNavigate={onNavigate} />
    </OrderQueueProvider>
  );
}
