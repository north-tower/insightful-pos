import { cn } from '@/lib/utils';
import { Category } from '@/data/menuData';

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
}

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
      {categories.map((category) => {
        const isActive = activeCategory === category.id;
        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200',
              isActive
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-card border border-border text-foreground hover:border-primary/50'
            )}
          >
            <span className="text-base">{category.icon}</span>
            <span>{category.name}</span>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-md',
              isActive ? 'bg-primary-foreground/20' : 'bg-muted'
            )}>
              {category.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
