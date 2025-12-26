import { Phone, Users, Utensils, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Reservation } from '@/data/tableData';
import { cn } from '@/lib/utils';

interface ReservationListProps {
  reservations: Reservation[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const statusStyles = {
  payment: { label: 'Payment', className: 'bg-success/10 text-success' },
  'on-dine': { label: 'On Dine', className: 'bg-muted text-muted-foreground' },
  unpaid: { label: 'Unpaid', className: 'bg-warning/10 text-warning' },
  upcoming: { label: 'Free', className: 'bg-primary/10 text-primary' },
};

export function ReservationList({ reservations, selectedDate, onDateChange }: ReservationListProps) {
  return (
    <div className="w-96 bg-card border-r border-border flex flex-col h-full">
      {/* Date Navigation */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold text-foreground">{selectedDate}</span>
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search customers"
              className="pl-10 bg-muted/50 border-0"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Reservation List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {reservations.map((reservation, index) => {
          const status = statusStyles[reservation.status];
          const isAvailable = reservation.status === 'upcoming';

          return (
            <div
              key={reservation.id}
              className={cn(
                'p-4 rounded-xl border border-border bg-card hover:shadow-card transition-all animate-fade-in',
                isAvailable && 'opacity-60'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'text-sm font-bold px-2 py-1 rounded-lg',
                    reservation.status === 'on-dine' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                  )}>
                    {reservation.time}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{reservation.customerName}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Utensils className="w-3 h-3" />
                        {reservation.tableNumber}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {reservation.guests}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground capitalize">{reservation.type}</span>
                  <span className={cn('status-badge block mt-1', status.className)}>
                    {status.label}
                  </span>
                </div>
              </div>

              {reservation.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                  <Phone className="w-3 h-3" />
                  {reservation.phone}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Reservation Button */}
      <div className="p-4 border-t border-border">
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
          Add New Reservation
        </Button>
      </div>
    </div>
  );
}
