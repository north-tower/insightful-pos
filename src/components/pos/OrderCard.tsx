import { cn } from '@/lib/utils';
import { Order } from '@/data/menuData';

interface OrderCardProps {
  order: Order;
  isActive?: boolean;
  onClick?: () => void;
}

const statusStyles = {
  kitchen: { label: 'In Kitchen', className: 'status-kitchen' },
  ready: { label: 'Ready', className: 'status-ready' },
  waiting: { label: 'Wait List', className: 'status-waiting' },
  served: { label: 'Served', className: 'bg-muted text-muted-foreground' },
};

export function OrderCard({ order, isActive, onClick }: OrderCardProps) {
  const status = statusStyles[order.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-48 p-4 rounded-xl border-2 transition-all duration-200 text-left animate-fade-in',
        isActive
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-foreground">Order #{order.id}</p>
          <p className="text-sm text-muted-foreground">Table {order.tableNumber}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Item: {order.items}X</p>
          <p className="text-xs text-muted-foreground">{order.time}</p>
        </div>
        <span className={cn('status-badge', status.className)}>
          {status.label}
        </span>
      </div>
    </button>
  );
}
