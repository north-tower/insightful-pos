import { useState } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import { ReservationList } from '@/components/pos/ReservationList';
import { TableFloorPlan } from '@/components/pos/TableFloorPlan';
import { OrderStatusTabs } from '@/components/pos/OrderStatusTabs';
import { tables, reservations } from '@/data/tableData';
import { cn } from '@/lib/utils';

const viewTabs = [
  { id: 'all', label: 'All', count: 12 },
  { id: 'reservation', label: 'Reservation', count: 7 },
  { id: 'on-dine', label: 'On Dine', count: 5 },
];

const areaTabs = ['main', 'terrace', 'outdoor'] as const;

interface ManageTableProps {
  onNavigate: (tab: string) => void;
}

export default function ManageTable({ onNavigate }: ManageTableProps) {
  const [activeView, setActiveView] = useState('all');
  const [activeArea, setActiveArea] = useState<typeof areaTabs[number]>('main');
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState('Thu, 11 January 2024');

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar activeTab="manage-table" onTabChange={onNavigate} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 flex overflow-hidden">
          {/* Reservation List */}
          <ReservationList
            reservations={reservations}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />

          {/* Floor Plan Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <OrderStatusTabs
                tabs={viewTabs}
                activeTab={activeView}
                onTabChange={setActiveView}
              />

              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-foreground">Manage Tables</h2>
                <div className="flex bg-muted rounded-xl p-1">
                  {areaTabs.map((area) => (
                    <button
                      key={area}
                      onClick={() => setActiveArea(area)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all',
                        activeArea === area
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {area === 'main' ? 'Main Dining' : area}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Floor Plan */}
            <TableFloorPlan
              tables={tables}
              selectedArea={activeArea}
              selectedTable={selectedTable}
              onTableSelect={setSelectedTable}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
