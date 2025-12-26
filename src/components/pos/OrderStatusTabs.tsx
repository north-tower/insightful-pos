import { cn } from '@/lib/utils';

interface StatusTab {
  id: string;
  label: string;
  count: number;
}

interface OrderStatusTabsProps {
  tabs: StatusTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function OrderStatusTabs({ tabs, activeTab, onTabChange }: OrderStatusTabsProps) {
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {tab.label}
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              isActive ? 'bg-primary-foreground/20' : 'bg-background'
            )}>
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
