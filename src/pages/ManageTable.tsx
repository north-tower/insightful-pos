import { useState } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
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
    <PageLayout activeTab="manage-table" onNavigate={onNavigate} flexContent>
      {/* Reservation List — hidden on mobile, visible on lg+ */}
      <div className="hidden lg:block">
        <ReservationList
          reservations={reservations}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      </div>

      {/* Floor Plan Area */}
      <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <OrderStatusTabs
            tabs={viewTabs}
            activeTab={activeView}
            onTabChange={setActiveView}
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Manage Tables</h2>
            <div className="flex bg-muted rounded-xl p-1">
              {areaTabs.map((area) => (
                <button
                  key={area}
                  onClick={() => setActiveArea(area)}
                  className={cn(
                    'px-3 sm:px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all',
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
    </PageLayout>
  );
}
