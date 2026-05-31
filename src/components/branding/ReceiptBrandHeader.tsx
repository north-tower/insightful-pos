import { cn } from '@/lib/utils';
import { useCompanySettings } from '@/context/BusinessSettingsContext';

interface ReceiptBrandHeaderProps {
  variant?: 'compact' | 'standard';
  /** Show phone, email, website (standard receipts) */
  showContact?: boolean;
  className?: string;
}

/** Shared receipt / invoice shop header with optional logo. */
export function ReceiptBrandHeader({
  variant = 'standard',
  showContact = false,
  className,
}: ReceiptBrandHeaderProps) {
  const { settings: company, shopLogoUrl, companyName } = useCompanySettings();
  const compact = variant === 'compact';

  return (
    <div className={cn('text-center border-b border-dashed pb-2', className)}>
      {shopLogoUrl && (
        <img
          src={shopLogoUrl}
          alt={companyName}
          className={cn(
            'mx-auto object-contain mb-1.5',
            compact ? 'h-10 max-w-[140px]' : 'h-14 max-w-[180px]',
          )}
        />
      )}
      <h2
        className={cn(
          'font-bold',
          compact ? 'text-[13px]' : 'text-xl',
        )}
      >
        {company.fullName}
      </h2>
      {company.address ? (
        <p className={cn('text-black', compact ? 'text-[10px]' : 'text-sm text-muted-foreground')}>
          {company.address}
        </p>
      ) : null}
      {company.city ? (
        <p className={cn('text-black', compact ? 'text-[10px]' : 'text-sm text-muted-foreground')}>
          {company.city}
        </p>
      ) : null}
      {showContact && company.phone ? (
        <p className="text-sm text-muted-foreground mt-1">{company.phone}</p>
      ) : null}
      {showContact && company.website ? (
        <p className="text-xs text-muted-foreground">{company.website}</p>
      ) : null}
    </div>
  );
}
