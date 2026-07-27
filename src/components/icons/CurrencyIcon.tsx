import { Banknote, type LucideProps } from 'lucide-react';

/** Currency affordance for KES — use instead of DollarSign in the UI. */
export function CurrencyIcon(props: LucideProps) {
  return <Banknote {...props} />;
}
