import { useMemo } from 'react';
import { Table } from '@/data/tableData';
import { TableCard } from './TableCard';
import { cn } from '@/lib/utils';

interface TableFloorPlanProps {
  tables: Table[];
  selectedArea: string;
  selectedTable?: string;
  onTableSelect: (tableId: string) => void;
}

export function TableFloorPlan({ tables, selectedArea, selectedTable, onTableSelect }: TableFloorPlanProps) {
  const filteredTables = useMemo(() => {
    return tables.filter((t) => t.area === selectedArea);
  }, [tables, selectedArea]);

  // Group tables by row
  const tablesByRow = useMemo(() => {
    const rows: Record<number, Table[]> = {};
    filteredTables.forEach((table) => {
      if (!rows[table.position.row]) {
        rows[table.position.row] = [];
      }
      rows[table.position.row].push(table);
    });
    // Sort tables in each row by column
    Object.keys(rows).forEach((row) => {
      rows[parseInt(row)].sort((a, b) => a.position.col - b.position.col);
    });
    return rows;
  }, [filteredTables]);

  return (
    <div className="bg-card rounded-2xl border border-border p-8 min-h-[500px]">
      {/* Legend */}
      <div className="flex items-center gap-6 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-warning" />
          <span className="text-sm text-muted-foreground">Reserved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <span className="text-sm text-muted-foreground">On Dine</span>
        </div>
      </div>

      {/* Floor Plan Grid */}
      <div className="space-y-12">
        {Object.entries(tablesByRow)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([row, rowTables]) => (
            <div
              key={row}
              className={cn(
                'flex justify-center gap-16 animate-fade-in',
                `delay-${parseInt(row) * 100}`
              )}
              style={{ animationDelay: `${parseInt(row) * 100}ms` }}
            >
              {rowTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  isSelected={selectedTable === table.id}
                  onClick={() => onTableSelect(table.id)}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
