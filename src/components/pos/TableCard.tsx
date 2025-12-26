import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableStatus } from '@/data/tableData';

interface TableCardProps {
  table: Table;
  onClick?: () => void;
  isSelected?: boolean;
}

const statusStyles: Record<TableStatus, { bg: string; border: string; text: string }> = {
  available: {
    bg: 'bg-primary/10',
    border: 'border-primary',
    text: 'text-primary',
  },
  reserved: {
    bg: 'bg-warning/10',
    border: 'border-warning',
    text: 'text-warning',
  },
  occupied: {
    bg: 'bg-destructive/10',
    border: 'border-destructive',
    text: 'text-destructive',
  },
};

export function TableCard({ table, onClick, isSelected }: TableCardProps) {
  const style = statusStyles[table.status];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Top chairs */}
      <div className="flex justify-center gap-1">
        {Array.from({ length: Math.min(Math.ceil(table.seats / 2), 4) }).map((_, i) => (
          <div
            key={`top-${i}`}
            className={cn(
              'w-6 h-3 rounded-t-lg border-2',
              style.border,
              style.bg
            )}
          />
        ))}
      </div>

      {/* Table body */}
      <button
        onClick={onClick}
        className={cn(
          'relative w-28 h-16 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-0.5',
          style.border,
          style.bg,
          isSelected && 'ring-2 ring-offset-2 ring-primary shadow-lg',
          'hover:shadow-md hover:scale-105'
        )}
      >
        <span className={cn('font-bold text-sm', style.text)}>
          Table #{table.number}
        </span>
        <div className={cn('flex items-center gap-1 text-xs', style.text)}>
          <Users className="w-3 h-3" />
          <span>{table.seats}</span>
        </div>
      </button>

      {/* Bottom chairs */}
      <div className="flex justify-center gap-1">
        {Array.from({ length: Math.min(Math.floor(table.seats / 2), 4) }).map((_, i) => (
          <div
            key={`bottom-${i}`}
            className={cn(
              'w-6 h-3 rounded-b-lg border-2',
              style.border,
              style.bg
            )}
          />
        ))}
      </div>
    </div>
  );
}
