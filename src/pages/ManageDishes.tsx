import { useState } from 'react';
import { Plus, Search, LayoutGrid, List, SlidersHorizontal, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PageLayout } from '@/components/pos/PageLayout';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import type { MenuItem } from '@/hooks/useProducts';

interface ManageDishesProps {
  onNavigate: (tab: string) => void;
}

const dishCategories = [
  { id: 'all', name: 'All Dishes', icon: '🍽️', count: 154 },
  { id: 'breakfast', name: 'Breakfast', icon: '🍳', count: 12 },
  { id: 'beef', name: 'Beef Dishes', icon: '🥩', count: 5 },
  { id: 'biryani', name: 'Biryani', icon: '🍚', count: 8 },
  { id: 'chicken', name: 'Chicken Dishes', icon: '🍗', count: 10 },
  { id: 'desserts', name: 'Desserts', icon: '🍰', count: 19 },
  { id: 'dinner', name: 'Dinner', icon: '🍷', count: 8 },
  { id: 'drinks', name: 'Drinks', icon: '🥤', count: 15 },
  { id: 'fast-foods', name: 'Fast Foods', icon: '🍔', count: 25 },
  { id: 'lunch', name: 'Lunch', icon: '🥗', count: 20 },
  { id: 'platters', name: 'Platters', icon: '🍱', count: 14 },
  { id: 'salads', name: 'Salads', icon: '🥬', count: 8 },
  { id: 'side-dishes', name: 'Side Dishes', icon: '🍟', count: 4 },
  { id: 'soups', name: 'Soups', icon: '🍜', count: 3 },
];

export default function ManageDishes({ onNavigate }: ManageDishesProps) {
  const { menuItems, loading } = useProducts();
  const [activeCategory, setActiveCategory] = useState('desserts');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const activeCategoryData = dishCategories.find((c) => c.id === activeCategory);

  const toggleDishSelection = (id: string) => {
    setSelectedDishes((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <PageLayout activeTab="manage-dishes" onNavigate={onNavigate} flexContent>
          {/* Category List — sidebar on lg+, horizontal scroll on mobile */}
          <div className="lg:w-72 bg-card border-b lg:border-b-0 lg:border-r border-border flex lg:flex-col shrink-0">
            <div className="hidden lg:block p-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Dishes Category</h2>
            </div>

            <div className="flex lg:flex-1 overflow-x-auto lg:overflow-y-auto p-2 lg:p-3 gap-1 lg:gap-0 lg:space-y-1 scrollbar-hide">
              {dishCategories.map((category) => {
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 lg:px-4 py-2 lg:py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{category.icon}</span>
                      <span>{category.name}</span>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      isActive ? 'bg-primary-foreground/20' : 'bg-muted'
                    )}>
                      {category.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="hidden lg:block p-4 border-t border-border">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                <Plus className="w-4 h-4" />
                Add New Category
              </Button>
            </div>
          </div>

          {/* Dishes Grid */}
          <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                {activeCategoryData?.name} ({activeCategoryData?.count})
              </h2>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* Search */}
                <div className="relative w-full sm:w-48 lg:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search dishes"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-muted/50 border-0"
                  />
                </div>

                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2" size="sm">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add New Dishes</span>
                  <span className="sm:hidden">Add</span>
                </Button>

                {/* View Toggle */}
                <div className="flex bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-2 rounded-md transition-all',
                      viewMode === 'grid' ? 'bg-card shadow-sm' : 'text-muted-foreground'
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-2 rounded-md transition-all',
                      viewMode === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <Button variant="outline" size="icon">
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Dishes Grid */}
            <div className={cn(
              'grid gap-4',
              viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
            )}>
              {/* Add New Dish Card */}
              <button className="aspect-square rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-3 hover:bg-primary/10 hover:border-primary/50 transition-all group">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-primary">
                  Add New Dish to {activeCategoryData?.name}
                </span>
              </button>

              {/* Dish Cards */}
              {menuItems.map((dish, index) => (
                <DishManageCard
                  key={dish.id}
                  dish={dish}
                  isSelected={selectedDishes.includes(dish.id)}
                  onSelect={() => toggleDishSelection(dish.id)}
                  style={{ animationDelay: `${index * 50}ms` }}
                />
              ))}
            </div>
          </div>
    </PageLayout>
  );
}

interface DishManageCardProps {
  dish: MenuItem;
  isSelected: boolean;
  onSelect: () => void;
  style?: React.CSSProperties;
}

function DishManageCard({ dish, isSelected, onSelect, style }: DishManageCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-2xl border-2 overflow-hidden transition-all animate-scale-in shadow-card hover:shadow-card-hover',
        isSelected ? 'border-primary' : 'border-transparent'
      )}
      style={style}
    >
      {/* Checkbox */}
      <div className="relative">
        <div className="absolute top-3 left-3 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="bg-card/80 backdrop-blur-sm border-2"
          />
        </div>
        <div className="absolute top-3 right-3 z-10">
          <button className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm hover:bg-card transition-colors">
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Image */}
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={dish.image}
            alt={dish.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-xs text-primary font-medium mb-1 capitalize">{dish.category}</p>
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
          {dish.name}
        </h3>
        <p className="text-lg font-bold text-foreground">
          ${dish.price.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
