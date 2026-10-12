import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { cn } from '@/lib/utils';

interface GlobalSearchFieldProps {
  className?: string;
  inputClassName?: string;
}

export function GlobalSearchField({ className, inputClassName }: GlobalSearchFieldProps) {
  const { isRestaurant } = useBusinessMode();

  const searchPlaceholder = isRestaurant
    ? 'Search menu, tickets and more'
    : 'Search products, sales and more';

  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2"
        aria-hidden
      />
      <Input
        type="search"
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className={cn(
          'min-h-10 w-full border-hairline bg-paper pl-10 text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          inputClassName,
        )}
      />
    </div>
  );
}
