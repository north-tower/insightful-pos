import { Store, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompanySettings } from '@/context/BusinessSettingsContext';

export type ShopLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'sidebar';

const sizeClass: Record<ShopLogoSize, string> = {
  xs: 'h-8 max-w-[80px]',
  sm: 'h-10 max-w-[100px]',
  md: 'h-12 max-w-[120px]',
  lg: 'h-16 max-w-[160px]',
  xl: 'h-20 max-w-[200px]',
  sidebar: 'h-12 w-12 max-w-[48px]',
};

interface ShopLogoProps {
  size?: ShopLogoSize;
  className?: string;
  /** When no custom logo, show a Lucide icon in a rounded box */
  fallbackIcon?: LucideIcon;
  showFallback?: boolean;
}

export function ShopLogo({
  size = 'md',
  className,
  fallbackIcon: FallbackIcon = Store,
  showFallback = true,
}: ShopLogoProps) {
  const { shopLogoUrl, companyName } = useCompanySettings();

  if (shopLogoUrl) {
    return (
      <img
        src={shopLogoUrl}
        alt={companyName || 'Shop logo'}
        className={cn('object-contain object-left', sizeClass[size], className)}
      />
    );
  }

  if (!showFallback) return null;

  return (
    <div
      className={cn(
        'rounded-2xl bg-primary/10 flex items-center justify-center shrink-0',
        size === 'sidebar' ? 'h-12 w-12' : sizeClass[size],
        className,
      )}
    >
      <FallbackIcon
        className={cn(
          'text-primary',
          size === 'xs' && 'w-4 h-4',
          size === 'sm' && 'w-5 h-5',
          (size === 'md' || size === 'sidebar') && 'w-6 h-6',
          size === 'lg' && 'w-8 h-8',
          size === 'xl' && 'w-10 h-10',
        )}
      />
    </div>
  );
}
