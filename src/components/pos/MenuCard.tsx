import { Plus, Minus, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MenuItem } from '@/data/menuData';
import { useCart } from '@/context/CartContext';
import { cn } from '@/lib/utils';

interface MenuCardProps {
  item: MenuItem;
}

export function MenuCard({ item }: MenuCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((i) => i.id === item.id);
  const quantity = cartItem?.quantity || 0;

  return (
    <div
      className={cn(
        'group bg-card rounded-2xl border-2 overflow-hidden transition-all duration-300 animate-scale-in',
        quantity > 0 ? 'border-primary shadow-card-hover' : 'border-transparent shadow-card hover:shadow-card-hover hover:border-primary/30'
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {item.discount && (
          <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-lg">
            {item.discount}% OFF
          </span>
        )}
        {item.isVeg && (
          <span className="absolute top-2 right-2 bg-success text-success-foreground p-1.5 rounded-lg">
            <Leaf className="w-3 h-3" />
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-xs text-primary font-medium mb-1 capitalize">{item.category}</p>
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2 min-h-[2.5rem]">
          {item.name}
        </h3>

        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-foreground">
            ${item.price.toFixed(2)}
          </p>

          {quantity === 0 ? (
            <Button
              size="sm"
              onClick={() => addItem(item)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 px-4"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-primary/10 rounded-xl p-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => updateQuantity(item.id, quantity - 1)}
                className="h-7 w-7 rounded-lg hover:bg-primary/20 text-primary"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="w-6 text-center font-semibold text-primary">{quantity}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => updateQuantity(item.id, quantity + 1)}
                className="h-7 w-7 rounded-lg hover:bg-primary/20 text-primary"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
