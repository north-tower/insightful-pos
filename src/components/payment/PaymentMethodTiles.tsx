import {
  Banknote,
  Smartphone,
  Landmark,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPaymentMethodLabel } from '@/lib/paymentMethods';
import type { PaymentMethod } from '@/hooks/useOrders';

export type PaymentMethodTileDef = {
  id: PaymentMethod;
  icon: LucideIcon;
};

export const INVOICE_PAYMENT_METHOD_TILES: PaymentMethodTileDef[] = [
  { id: 'cash', icon: Banknote },
  { id: 'card', icon: Landmark },
  { id: 'qr', icon: Smartphone },
];

export const METHOD_ONLY_PAYMENT_TILES: PaymentMethodTileDef[] = [
  { id: 'cash', icon: Banknote },
  { id: 'mpesa', icon: Smartphone },
  { id: 'card', icon: Landmark },
];

export const ACCOUNT_QUICK_PAYMENT_TILES: PaymentMethodTileDef[] = [
  { id: 'cash', icon: Banknote },
  { id: 'card', icon: Landmark },
  { id: 'qr', icon: Smartphone },
];

export function PaymentMethodTiles({
  methods,
  value,
  onChange,
}: {
  methods: PaymentMethodTileDef[];
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <div
      className={cn(
        'grid gap-2',
        methods.length >= 4
          ? 'grid-cols-2 min-[400px]:grid-cols-4'
          : 'grid-cols-2 min-[400px]:grid-cols-3',
      )}
    >
      {methods.map(({ id, icon: Icon }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(id)}
            className={cn(
              'focus-ring relative flex h-14 min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius)] border-2 px-2 text-center active:scale-[0.98]',
              selected
                ? 'border-primary bg-[hsl(var(--accent-soft))] text-ink'
                : 'border-hairline bg-surface text-ink-2 hover:border-primary/40',
            )}
          >
            {selected ? (
              <Check
                className="absolute right-1.5 top-1.5 h-4 w-4 text-primary"
                aria-hidden
              />
            ) : null}
            <Icon
              className={cn('h-5 w-5', selected ? 'text-primary' : 'text-ink-2')}
              aria-hidden
            />
            <span className="text-xs font-semibold leading-tight">
              {getPaymentMethodLabel(id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
