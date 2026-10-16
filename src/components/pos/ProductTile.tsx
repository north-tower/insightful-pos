import { forwardRef, type KeyboardEvent, type MouseEvent } from 'react';
import { Plus, Star } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import type { ProductCategory } from '@/data/productData';
import { cn } from '@/lib/utils';
import { formatKES } from '@/lib/formatKES';
import { formatDisplayUnit, formatQtyAmount } from '@/lib/units';

function PosProductStockHint({ status }: { status: 'low' | 'out' }) {
  const label = status === 'low' ? 'Low stock' : 'Out';
  const dotClass =
    status === 'low' ? 'bg-[hsl(var(--wait))]' : 'bg-[hsl(var(--fail))]';
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-ink-2">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

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

function hasProductImage(product: Product): boolean {
  return Boolean(product.image?.trim());
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
    const showsImage = hasProductImage(product);
    const unitSuffix = formatDisplayUnit(product.unit);

    const handleActivate = () => {
      if (isOutOfStock) return;
      onActivate();
    };

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={isOutOfStock ? -1 : 0}
        data-testid={dataTestId}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (isOutOfStock) return;
          onKeyDown?.(e);
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate();
          }
        }}
        aria-disabled={isOutOfStock || undefined}
        className={cn(
          'focus-ring relative flex h-[104px] min-h-[104px] w-full min-w-0 cursor-pointer flex-col rounded-[var(--radius)] border border-hairline bg-surface p-2.5 text-left active:scale-[0.98] min-[480px]:h-[120px] min-[480px]:min-h-[120px]',
          inCart && 'border-2 border-primary bg-[hsl(var(--accent-soft))]',
          isOutOfStock && 'cursor-not-allowed opacity-50 active:scale-100',
          className,
        )}
      >
        <div className="absolute right-1 top-1 z-10 flex items-center">
          <button
            type="button"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(e);
            }}
            className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] active:scale-95"
          >
            <Star
              className={cn(
                'h-4 w-4',
                isFavorite ? 'fill-ink text-ink' : 'fill-none text-ink-2',
              )}
            />
          </button>
          {inCart ? (
            <span
              className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-ink px-1.5 font-sans text-xs font-semibold text-paper tabular-nums"
              aria-hidden
            >
              {formatQtyAmount(inCartQty)}
            </span>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 gap-2 pr-1">
          <div className="flex min-w-0 flex-1 flex-col pt-0.5">
            <p
              className="line-clamp-2 pr-14 text-[16px] font-semibold leading-snug text-ink"
              title={product.name}
            >
              {product.name}
            </p>
            {categoryLabel ? (
              <p className="mt-0.5 truncate text-[12px] text-ink-2">{categoryLabel}</p>
            ) : null}
            <div className="mt-auto flex min-w-0 flex-wrap items-baseline gap-x-0.5 pt-1">
              <span className="text-[20px] font-semibold leading-none text-ink tabular-nums">
                {formatKES(product.price)}
              </span>
              <span className="text-[13px] font-normal text-ink-2">
                / {unitSuffix}
              </span>
            </div>
          </div>
          {showsImage ? (
            <img
              src={product.image}
              alt=""
              className="h-14 w-14 shrink-0 self-center rounded-[calc(var(--radius)-2px)] object-cover"
            />
          ) : null}
        </div>

        {!inCart && !isOutOfStock ? (
          <button
            type="button"
            aria-label={`Add ${product.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
            className="focus-ring absolute bottom-2 left-2.5 flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-[hsl(var(--accent-soft))] active:scale-95"
          >
            <Plus className="h-5 w-5 text-primary" aria-hidden />
          </button>
        ) : null}

        {stockStatus ? (
          <div className="pointer-events-none absolute bottom-2 right-2.5">
            <PosProductStockHint status={stockStatus} />
          </div>
        ) : null}
      </div>
    );
  },
);
