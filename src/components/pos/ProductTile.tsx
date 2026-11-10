import { forwardRef, type KeyboardEvent, type MouseEvent } from 'react';
import { Star } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import type { ProductCategory } from '@/data/productData';
import { cn } from '@/lib/utils';
import { Money } from '@/components/ui/Money';
import { formatDisplayUnit, formatQty } from '@/lib/units';
import { StatusChip } from '@/components/ui/StatusChip';

export function getProductCategoryDisplayName(
  product: Product,
  categories: ProductCategory[],
): string | null {
  const slug = product.category || 'uncategorized';
  if (!slug || slug === 'uncategorized') return null;
  const fromCatalog = categories.find((c) => c.id === slug);
  const name =
    fromCatalog?.name ||
    slug.replace(/-/g, ' ');
  return name.trim() || null;
}

export type ProductTileProps = {
  product: Product;
  categoryLabel?: string | null;
  inCartQty: number;
  isFavorite: boolean;
  stockStatus?: 'low' | 'out' | null;
  isOutOfStock?: boolean;
  onActivate: () => void;
  onToggleFavorite: (event: MouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
  'data-testid'?: string;
};

export const ProductTile = forwardRef<HTMLDivElement, ProductTileProps>(
  function ProductTile(
    {
      product,
      categoryLabel,
      inCartQty,
      isFavorite,
      stockStatus,
      isOutOfStock = false,
      onActivate,
      onToggleFavorite,
      onKeyDown,
      className,
      'data-testid': dataTestId,
    },
    ref,
  ) {
    const inCart = inCartQty > 0;
    const unitSuffix = formatDisplayUnit(product.unit);
    const showStockQty = product.stock > 0;

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        data-testid={dataTestId}
        onClick={onActivate}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate();
          }
        }}
        className={cn(
          'focus-ring relative flex min-h-[120px] w-full min-w-0 cursor-pointer flex-col rounded-[var(--radius)] border border-hairline bg-surface p-4 text-left active:scale-[0.98]',
          inCart && 'border-2 border-primary',
          isOutOfStock && 'cursor-pointer active:scale-[0.98]',
          className,
        )}
      >
        {inCart ? (
          <span
            className="absolute -left-2 -top-2 z-10 flex h-6 min-w-6 max-w-[calc(100%-1.5rem)] items-center justify-center rounded-[var(--radius)] bg-ink px-1.5 font-sans text-xs font-semibold text-paper tabular-nums"
            aria-hidden
          >
            {formatQty(inCartQty, product.unit)}
          </span>
        ) : null}

        <div className="absolute right-1 top-1 z-10 flex items-center">
          <button
            type="button"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(e);
            }}
            className="focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)] active:scale-95"
          >
            <Star
              className={cn(
                'h-5 w-5',
                isFavorite ? 'fill-ink text-ink' : 'fill-none text-ink-2',
              )}
            />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col pr-10">
          <p
            className={cn(
              'line-clamp-2 text-[16px] font-semibold leading-snug text-ink',
              inCart && 'pl-6',
            )}
            title={product.name}
          >
            {product.name}
          </p>
          {categoryLabel ? (
            <p className="mt-0.5 truncate text-[12px] text-ink-2">{categoryLabel}</p>
          ) : null}

          <div className="mt-1.5 flex min-h-7 items-center">
            {stockStatus === 'low' ? <StatusChip status="low" size="sm" /> : null}
            {stockStatus === 'out' ? <StatusChip status="out" size="sm" /> : null}
          </div>

          <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-2">
            <div className="min-w-0">
              <Money value={product.price} variant="display" size="md" />
              <span className="font-sans text-[14px] text-ink-2"> / {unitSuffix}</span>
            </div>
            {showStockQty ? (
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-ink-2 num">
                {formatQty(product.stock, product.unit)}
              </span>
            ) : (
              <span className="shrink-0 font-mono text-[13px] text-ink-2" aria-hidden>
                {'\u00a0'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);
