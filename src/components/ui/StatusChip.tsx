import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Circle,
  CloudOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusChipStatus =
  | 'open'
  | 'paid'
  | 'signed'
  | 'waiting'
  | 'low'
  | 'out'
  | 'rejected';

type StatusChipSize = 'sm' | 'md';

const STATUS_CONFIG: Record<
  StatusChipStatus,
  { label: string; Icon: LucideIcon; iconClassName: string }
> = {
  open: { label: 'Open', Icon: Circle, iconClassName: 'text-ink fill-ink' },
  paid: { label: 'Paid', Icon: CheckCircle2, iconClassName: 'text-ok' },
  signed: { label: 'Signed', Icon: BadgeCheck, iconClassName: 'text-ok' },
  waiting: { label: 'Waiting for network', Icon: CloudOff, iconClassName: 'text-wait' },
  low: { label: 'Low', Icon: AlertTriangle, iconClassName: 'text-wait' },
  out: { label: 'Out of stock', Icon: XCircle, iconClassName: 'text-fail' },
  rejected: { label: 'Rejected', Icon: XCircle, iconClassName: 'text-fail' },
};

export interface StatusChipProps {
  status?: StatusChipStatus;
  label?: string;
  size?: StatusChipSize;
  className?: string;
}

export function StatusChip({ status, label, size = 'sm', className }: StatusChipProps) {
  if (!status) return null;

  const { label: defaultLabel, Icon, iconClassName } = STATUS_CONFIG[status];
  const text = label ?? defaultLabel;

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 border border-hairline bg-transparent font-semibold text-ink',
        size === 'sm' ? 'h-7 rounded-[var(--radius)] px-2 text-[13px]' : 'h-8 rounded-[var(--radius)] px-2.5 text-sm',
        className,
      )}
    >
      <Icon
        className={cn(
          'shrink-0',
          iconClassName,
          size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
          status === 'open' && 'h-2 w-2',
        )}
        aria-hidden
      />
      <span className="truncate">{text}</span>
    </span>
  );
}
