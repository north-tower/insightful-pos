import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TableTurnover } from '@/data/dashboardData';
import { Progress } from '@/components/ui/progress';
import { Clock, Table2 } from 'lucide-react';

interface TableTurnoverProps {
  data: TableTurnover[];
}

export function TableTurnoverMetrics({ data }: TableTurnoverProps) {
  const overallTurnover = data.reduce((sum, area) => sum + area.turnoverRate, 0) / data.length;
  const overallAvgTime = data.reduce((sum, area) => sum + area.avgTurnoverTime, 0) / data.length;
  const totalTables = data.reduce((sum, area) => sum + area.totalTables, 0);
  const totalOccupied = data.reduce((sum, area) => sum + area.occupiedTables, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Table Turnover Metrics</CardTitle>
        <CardDescription>Table utilization and turnover rates by area</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-xl">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Tables</p>
            <p className="text-2xl font-bold text-foreground">{totalTables}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Occupied</p>
            <p className="text-2xl font-bold text-foreground">{totalOccupied}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Avg Turnover Time</p>
            <p className="text-2xl font-bold text-foreground">{overallAvgTime.toFixed(0)}m</p>
          </div>
        </div>

        {/* Area Breakdown */}
        <div className="space-y-4">
          {data.map((area) => (
            <div key={area.area} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{area.area}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {area.occupiedTables}/{area.totalTables} tables
                  </span>
                  <span className="font-semibold text-foreground">
                    {area.turnoverRate.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress value={area.turnoverRate} className="h-2" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Avg turnover time: {area.avgTurnoverTime} minutes</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


