import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useOrders, SaleOrder, SaleType, PaymentMethod } from '@/hooks/useOrders';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import type { Product } from '@/hooks/useProducts';
import { InvoiceDialog } from '@/components/receipt/InvoiceDialog';
import { PaymentDialog, paymentMethodLabel } from '@/components/payment/PaymentDialog';
import { ReceiptData } from '@/data/receiptData';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Trash2,
  X,
  CreditCard,
  Banknote,
  ShoppingCart,
  Package,
  Loader2,
  Printer,
  FileText,
  User,
  UserPlus,
  ChevronDown,
  LayoutGrid,
  List,
  QrCode,
  Smartphone,
  Landmark,
  Minus,
  Plus,
  ScanBarcode,
  CloudOff,
  Wifi,
  Info,
  Star,
  Clock,
  Check,
} from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { generatePlaceholderUrl } from '@/lib/product-images';
import { fc, CURRENCY_SYMBOL } from '@/lib/currency';
import { formatKES } from '@/lib/formatKES';
import { formatDate } from '@/lib/formatDate';
import { getStockStatus } from '@/lib/stockStatus';
import { StatusChip } from '@/components/ui/StatusChip';
import { toast } from 'sonner';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { notifyInvoiceCreated } from '@/lib/sendSms';
import { useAuth } from '@/context/AuthContext';
import { resolveActiveAssignmentId } from '@/lib/activeAssignment';
import { format } from 'date-fns';

interface RetailPOSProps {
  onNavigate: (tab: string) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  /** Override price – defaults to product.price when undefined */
  overridePrice?: number;
}

type ProductViewMode = 'card' | 'list';
type CreditDepositMethod = 'cash' | 'card' | 'qr';
type DiscountMode = 'amount' | 'percent';

const PRODUCT_VIEW_STORAGE_KEY = 'retail-pos:product-view-mode';
const MAX_RECENT_PRODUCTS = 12;

function readStoredIdList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredIdList(key: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

function getInitialShowOutOfStock(userKey: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`retail-pos:show-oos:${userKey}`) === '1';
}

/** localStorage snapshot: product ids + qty + optional price override (rehydrated from live catalog). */
type PersistedRetailCartLine = {
  productId: string;
  quantity: number;
  overridePrice?: number;
};

function getInitialProductViewMode(): ProductViewMode {
  if (typeof window === 'undefined') return 'card';
  return window.localStorage.getItem(PRODUCT_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'card';
}

/** Snapshot address for credit sales from the linked customer record. */
function formatStoredCustomerAddress(c: Customer): string | undefined {
  const parts: string[] = [];
  if (c.address?.trim()) parts.push(c.address.trim());
  const cityLine = [c.city?.trim(), c.postal_code?.trim()].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  if (c.country?.trim()) parts.push(c.country.trim());
  return parts.length ? parts.join(', ') : undefined;
}

/** Collapsed by default; expands when tapped or when fields already have values. */
function WalkInCustomerFields({
  name,
  phone,
  address,
  onNameChange,
  onPhoneChange,
  onAddressChange,
  compact = false,
}: {
  name: string;
  phone: string;
  address: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  compact?: boolean;
}) {
  const hasValue = Boolean(name.trim() || phone.trim() || address.trim());
  const [expanded, setExpanded] = useState(hasValue);

  useEffect(() => {
    if (hasValue) setExpanded(true);
  }, [hasValue]);

  const inputClass = compact ? 'h-9 text-xs' : 'min-h-11 text-sm';
  const labelClass = compact ? 'text-xs text-muted-foreground' : 'text-[11px] text-muted-foreground';

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex min-h-9 w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <span>
          Add customer details <span className="font-normal">(optional)</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={labelClass}>
          Customer <span className="font-normal">(optional)</span>
        </p>
        {!hasValue && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Hide
          </button>
        )}
      </div>
      <Input
        placeholder="Name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className={inputClass}
        autoComplete="name"
      />
      <Input
        placeholder="Phone"
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        className={inputClass}
        autoComplete="tel"
      />
      <Textarea
        placeholder="Address"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        rows={2}
        className={compact ? 'min-h-[52px] resize-y text-xs' : 'min-h-[52px] resize-y text-xs'}
      />
    </div>
  );
}

const cashPaymentOptions: Array<{
  id: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}> = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'mpesa', label: 'M-Pesa / Paybill', icon: Smartphone },
  { id: 'card', label: 'Direct Bank', icon: Landmark },
];

function CartPaymentMethodSection({
  method,
  onMethodChange,
  reference,
  onReferenceChange,
}: {
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  reference: string;
  onReferenceChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink-2">Payment method</p>
      <div className="grid grid-cols-3 gap-2">
        {cashPaymentOptions.map(({ id, label, icon: Icon }) => {
          const selected = method === id;
          return (
          <button
            key={id}
            type="button"
            onClick={() => onMethodChange(id)}
            aria-pressed={selected}
            className={cn(
              'focus-ring relative flex min-h-[var(--tap-min)] flex-col items-center justify-center gap-1 rounded-[var(--radius)] border-2 px-1 py-2 text-center active:scale-95',
              selected
                ? 'border-primary bg-[hsl(var(--accent-soft))] text-ink'
                : 'border-hairline bg-surface text-ink-2 hover:border-primary/40',
            )}
          >
            {selected && (
              <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-primary" aria-hidden />
            )}
            <Icon className={cn('h-4 w-4', selected ? 'text-primary' : 'text-ink-2')} />
            <span className="text-[10px] font-semibold leading-tight">{label}</span>
          </button>
          );
        })}
      </div>
      {(method === 'mpesa' || method === 'card') && (
        <Input
          placeholder={
            method === 'mpesa'
              ? 'M-Pesa confirmation code (optional)'
              : 'Bank reference / transaction ID (optional)'
          }
          value={reference}
          onChange={(e) => onReferenceChange(e.target.value)}
          className="min-h-11 text-sm"
        />
      )}
    </div>
  );
}

/** +/- quantity control — min 36×36 touch target (min-h-9 / min-w-9). */
function CartQtyControl({
  productId,
  quantity,
  editingValue,
  onEditingChange,
  onCommit,
  onStep,
}: {
  productId: string;
  quantity: number;
  editingValue: string | undefined;
  onEditingChange: (productId: string, value: string) => void;
  onCommit: (productId: string) => void;
  onStep: (productId: string, nextQty: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onStep(productId, quantity - 1)}
        className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-paper text-ink active:scale-95"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Quantity"
        value={editingValue ?? quantity}
        onChange={(e) => onEditingChange(productId, e.target.value)}
        onBlur={() => onCommit(productId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(productId);
        }}
        className="h-[var(--tap-min)] min-h-[var(--tap-min)] w-12 rounded-[var(--radius)] border border-hairline bg-paper text-center font-mono text-sm font-semibold text-ink num focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onStep(productId, quantity + 1)}
        className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-paper text-ink active:scale-95"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Cash / Credit segmented control — muted tab style so it doesn't compete with the CTA. */
function SaleTypeTabs({
  saleType,
  onCash,
  onCredit,
}: {
  saleType: SaleType;
  onCash: () => void;
  onCredit: () => void;
}) {
  return (
    <div className="flex gap-2">
      {(
        [
          { id: 'cash' as const, label: 'Cash Sale', icon: Banknote, onClick: onCash },
          { id: 'credit' as const, label: 'Credit Sale', icon: FileText, onClick: onCredit },
        ] as const
      ).map(({ id, label, icon: Icon, onClick }) => {
        const selected = saleType === id;
        return (
          <button
            key={id}
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
              'focus-ring relative flex min-h-[var(--tap-min)] flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] border-2 px-2 text-xs font-semibold active:scale-[0.98]',
              selected
                ? 'border-primary bg-[hsl(var(--accent-soft))] text-ink'
                : 'border-hairline bg-surface text-ink-2',
            )}
          >
            {selected && (
              <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary" aria-hidden />
            )}
            <Icon className={cn('h-3.5 w-3.5', selected ? 'text-primary' : 'text-ink-2')} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Credit-sale extras (UI only). Deposit fields collapse behind a toggle —
 * does not clear values or change submit/validation when collapsed.
 */
function CreditSaleExtras({
  total,
  recordDepositNow,
  onRecordDepositNowChange,
  creditDeposit,
  onCreditDepositChange,
  creditPaymentDescription,
  onCreditPaymentDescriptionChange,
  creditPaymentMethod,
  onCreditPaymentMethodChange,
  consignmentInfo,
  onConsignmentInfoChange,
  invoiceDate,
  onInvoiceDateChange,
}: {
  total: number;
  recordDepositNow: boolean;
  onRecordDepositNowChange: (value: boolean) => void;
  creditDeposit: string;
  onCreditDepositChange: (value: string) => void;
  creditPaymentDescription: string;
  onCreditPaymentDescriptionChange: (value: string) => void;
  creditPaymentMethod: CreditDepositMethod;
  onCreditPaymentMethodChange: (value: CreditDepositMethod) => void;
  consignmentInfo: string;
  onConsignmentInfoChange: (value: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
      <div>
        <p className="mb-0.5 text-sm font-medium text-foreground">Credit sale</p>
        <p className="leading-relaxed">
          An invoice will be added to the customer&apos;s balance. Optionally record a deposit
          now; the remainder stays on account.
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border/60 bg-background/60 px-2.5 py-2">
        <Checkbox
          checked={recordDepositNow}
          onCheckedChange={(checked) => onRecordDepositNowChange(checked === true)}
        />
        <span className="text-sm font-medium text-foreground">Record a deposit now?</span>
      </label>

      {/* Smooth expand/collapse — UI visibility only; field state is preserved when collapsed */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
          recordDepositNow ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-2 pb-1 pt-0.5">
            <Input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder={`Deposit amount (max ${fc(total)})`}
              value={creditDeposit}
              onChange={(e) => onCreditDepositChange(e.target.value)}
              className="h-9 min-h-9 border-border/70 bg-background text-xs"
            />
            <Input
              placeholder="Deposit note (optional)"
              value={creditPaymentDescription}
              onChange={(e) => onCreditPaymentDescriptionChange(e.target.value)}
              className="h-9 min-h-9 border-border/70 bg-background text-xs"
            />
            <p className="text-[11px] text-muted-foreground">Deposit paid as</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'cash' as const, icon: Banknote, label: 'Cash' },
                  { id: 'card' as const, icon: CreditCard, label: 'Card' },
                  { id: 'qr' as const, icon: QrCode, label: 'QR' },
                ]
              ).map(({ id, icon: Icon, label }) => {
                const selected = creditPaymentMethod === id;
                return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onCreditPaymentMethodChange(id)}
                  aria-pressed={selected}
                  className={cn(
                    'focus-ring relative flex min-h-[var(--tap-min)] items-center justify-center gap-1 rounded-[var(--radius)] border-2 text-[11px] font-semibold active:scale-95',
                    selected
                      ? 'border-primary bg-[hsl(var(--accent-soft))] text-ink'
                      : 'border-hairline bg-surface text-ink-2',
                  )}
                >
                  {selected && (
                    <Check className="absolute right-1 top-1 h-3 w-3 text-primary" aria-hidden />
                  )}
                  <Icon className={cn('h-3.5 w-3.5', selected ? 'text-primary' : 'text-ink-2')} />
                  {label}
                </button>
                );
              })}
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] text-muted-foreground">Consignment / plate no.</p>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex text-muted-foreground hover:text-foreground"
                        aria-label="About consignment / plate number"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px] text-xs">
                      Optional vehicle plate or consignment reference for delivery paperwork.
                      Leave blank if not applicable.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-[10px] text-muted-foreground/80">(optional)</span>
              </div>
              <Input
                placeholder="e.g. KDA 123X"
                value={consignmentInfo}
                onChange={(e) => onConsignmentInfoChange(e.target.value)}
                className="h-9 min-h-9 border-border/70 bg-background text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1 border-t border-border/50 pt-2">
        <p className="text-[11px] text-muted-foreground">Invoice Date</p>
        <Input
          type="date"
          value={invoiceDate}
          onChange={(e) => onInvoiceDateChange(e.target.value)}
          className="h-9 min-h-9 border-border/70 bg-background text-xs"
        />
      </div>
    </div>
  );
}

function CartTotalsSection({
  subtotal,
  discountMode,
  onDiscountModeChange,
  discountInput,
  onDiscountInputChange,
  discountAmount,
  total,
}: {
  subtotal: number;
  discountMode: DiscountMode;
  onDiscountModeChange: (mode: DiscountMode) => void;
  discountInput: string;
  onDiscountInputChange: (value: string) => void;
  discountAmount: number;
  total: number;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1.5 border-b border-hairline pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-2">Discount</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onDiscountModeChange('amount')}
              className={cn(
                'focus-ring min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-[var(--radius)] px-3 text-xs font-semibold active:scale-95',
                discountMode === 'amount'
                  ? 'border-2 border-primary bg-[hsl(var(--accent-soft))] text-ink'
                  : 'border border-hairline bg-surface text-ink-2',
              )}
            >
              {CURRENCY_SYMBOL}
            </button>
            <button
              type="button"
              onClick={() => onDiscountModeChange('percent')}
              className={cn(
                'focus-ring min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-[var(--radius)] px-3 text-xs font-semibold active:scale-95',
                discountMode === 'percent'
                  ? 'border-2 border-primary bg-[hsl(var(--accent-soft))] text-ink'
                  : 'border border-hairline bg-surface text-ink-2',
              )}
            >
              %
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*"
            min="0"
            placeholder={discountMode === 'percent' ? '0' : '0.00'}
            value={discountInput}
            onChange={(e) => onDiscountInputChange(e.target.value)}
            className="min-h-[var(--tap-min)] border-hairline bg-surface text-sm"
          />
        </div>
      </div>

      <div className="space-y-2 font-sans text-sm text-ink-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-mono text-ink num">{formatKES(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span className="font-mono text-ink num">−{formatKES(discountAmount)}</span>
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between border-t border-hairline pt-3">
        <span className="text-base font-semibold text-ink">Total</span>
        <span className="font-mono text-[2rem] font-bold leading-none text-ink num">
          {formatKES(total)}
        </span>
      </div>
    </div>
  );
}

function cartCheckoutDisabledHint(
  isProcessing: boolean,
  saleType: SaleType,
  selectedCustomer: Customer | null,
): string | null {
  if (isProcessing) return null;
  if (saleType === 'credit' && !selectedCustomer) {
    return 'Select a customer to continue';
  }
  return null;
}

function CartReceiptHeader({
  totalItems,
  onClear,
  showClear,
}: {
  totalItems: number;
  onClear?: () => void;
  showClear: boolean;
}) {
  const itemLabel = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
  return (
    <div className="shrink-0 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <ShoppingCart className="h-5 w-5" aria-hidden />
            Cart
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {totalItems > 0 ? (
              <>
                {itemLabel}
                <span aria-hidden> · </span>
                {formatDate(new Date())}
              </>
            ) : (
              formatDate(new Date())
            )}
          </p>
        </div>
        {showClear && onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-xs text-fail hover:text-fail"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function CartReceiptLine({
  item,
  unitPrice,
  editingPrice,
  editingQty,
  onPriceChange,
  onPriceCommit,
  onQtyEditingChange,
  onQtyCommit,
  onQtyStep,
  onRemove,
}: {
  item: CartItem;
  unitPrice: number;
  editingPrice: string | undefined;
  editingQty: string | undefined;
  onPriceChange: (productId: string, value: string) => void;
  onPriceCommit: (productId: string) => void;
  onQtyEditingChange: (productId: string, value: string) => void;
  onQtyCommit: (productId: string) => void;
  onQtyStep: (productId: string, nextQty: number) => void;
  onRemove: (productId: string) => void;
}) {
  const lineTotal = unitPrice * item.quantity;
  const productId = item.product.id;

  return (
    <div className="border-b border-hairline py-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-ink">{item.product.name}</p>
          <p className="mt-1 font-mono text-xs text-ink-2 num">
            {item.quantity} × {formatKES(unitPrice)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="relative w-[5.5rem]">
              <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-2">
                {CURRENCY_SYMBOL}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={editingPrice ?? unitPrice}
                onChange={(e) => onPriceChange(productId, e.target.value)}
                onBlur={() => onPriceCommit(productId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onPriceCommit(productId);
                }}
                className="h-[var(--tap-min)] min-h-[var(--tap-min)] w-full rounded-[var(--radius)] border border-hairline bg-paper pl-7 pr-1 font-mono text-xs text-ink num focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Unit price for ${item.product.name}`}
              />
            </div>
            <CartQtyControl
              productId={productId}
              quantity={item.quantity}
              editingValue={editingQty}
              onEditingChange={onQtyEditingChange}
              onCommit={onQtyCommit}
              onStep={onQtyStep}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="font-mono text-sm font-semibold text-ink num">
            {formatKES(lineTotal)}
          </span>
          <button
            type="button"
            aria-label={`Remove ${item.product.name}`}
            onClick={() => onRemove(productId)}
            className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] text-fail active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CartCheckoutFooter({
  saleType,
  total,
  isProcessing,
  disabled,
  disabledHint,
  onClick,
  lastOrder,
  onReprint,
}: {
  saleType: SaleType;
  total: number;
  isProcessing: boolean;
  disabled: boolean;
  disabledHint: string | null;
  onClick: () => void;
  lastOrder?: SaleOrder | null;
  onReprint?: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-hairline bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-float">
      {disabledHint && (
        <p className="mb-2 text-center text-xs text-ink-2">{disabledHint}</p>
      )}
      <Button
        className={cn(
          'min-h-[var(--tap-primary)] w-full text-base font-bold active:scale-95',
          saleType === 'credit' && 'bg-warning text-warning-foreground hover:bg-warning/90',
        )}
        onClick={onClick}
        disabled={disabled}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : saleType === 'credit' ? (
          <>
            <FileText className="mr-2 h-4 w-4" />
            Create Invoice — {formatKES(total)}
          </>
        ) : (
          `Complete Sale — ${formatKES(total)}`
        )}
      </Button>
      {lastOrder && onReprint && (
        <Button variant="outline" className="mt-2 w-full gap-2" size="sm" onClick={onReprint}>
          <Printer className="h-4 w-4" />
          Reprint #{lastOrder.invoice_number || lastOrder.order_number}
        </Button>
      )}
    </div>
  );
}

export default function RetailPOS({ onNavigate }: RetailPOSProps) {
  const { user } = useAuth();
  const retailCartStorageKey = useMemo(
    () => `insightful-pos:v1:retail-cart:${user?.id ?? 'guest'}`,
    [user?.id],
  );
  const posPrefsKey = useMemo(() => user?.id ?? 'guest', [user?.id]);
  const favoritesStorageKey = useMemo(
    () => `retail-pos:favorites:${posPrefsKey}`,
    [posPrefsKey],
  );
  const recentStorageKey = useMemo(
    () => `retail-pos:recent:${posPrefsKey}`,
    [posPrefsKey],
  );
  const {
    sellableRetailProducts,
    retailCategories,
    loading,
    refetch: refetchProducts,
    debugOfflineCacheKey,
    debugLastDataSource,
  } = useProducts();
  const { createOrder, recordPayment } = useOrders();
  const { customers, getCustomerDisplayName, refetch: refetchCustomers } = useCustomers();
  const { companyName } = useCompanySettings();
  // REVIEW: Connectivity for POS banner — wired to existing useSyncStatus (navigator.onLine + outbox).
  const { isOnline } = useSyncStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBrowseKey, setActiveBrowseKey] = useState('all');
  const [showOutOfStock, setShowOutOfStock] = useState(() =>
    getInitialShowOutOfStock(user?.id ?? 'guest'),
  );
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>(() =>
    readStoredIdList(`retail-pos:favorites:${user?.id ?? 'guest'}`),
  );
  const [recentProductIds, setRecentProductIds] = useState<string[]>(() =>
    readStoredIdList(`retail-pos:recent:${user?.id ?? 'guest'}`),
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const retailCartHydratedRef = useRef(false);
  const retailCartStorageKeySeenRef = useRef<string | null>(null);
  const [retailCartPersistenceReady, setRetailCartPersistenceReady] = useState(false);
  const [saleType, setSaleType] = useState<SaleType>('cash');
  const [consignmentInfo, setConsignmentInfo] = useState('');
  const [creditDeposit, setCreditDeposit] = useState('');
  const [creditPaymentDescription, setCreditPaymentDescription] = useState('');
  const [creditPaymentMethod, setCreditPaymentMethod] = useState<CreditDepositMethod>('cash');
  /** UI-only: hides deposit fields; does not clear values or change submit logic. */
  const [recordDepositNow, setRecordDepositNow] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('');
  const [walkInCustomerAddress, setWalkInCustomerAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isPostSalePaymentOpen, setIsPostSalePaymentOpen] = useState(false);
  const [postSalePaymentOrder, setPostSalePaymentOrder] = useState<SaleOrder | null>(null);
  const [lastOrder, setLastOrder] = useState<SaleOrder | null>(null);
  const [lastOrderCustomer, setLastOrderCustomer] = useState<Customer | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [productViewMode, setProductViewMode] = useState<ProductViewMode>(getInitialProductViewMode);
  const [discountMode, setDiscountMode] = useState<DiscountMode>('amount');
  const [discountInput, setDiscountInput] = useState('');
  const [cashPaymentMethod, setCashPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashPaymentReference, setCashPaymentReference] = useState('');
  const getMainStock = (product: Product) => product.mainStock ?? product.stock;

  // Reload POS prefs when user changes
  useEffect(() => {
    setShowOutOfStock(getInitialShowOutOfStock(posPrefsKey));
    setFavoriteProductIds(readStoredIdList(favoritesStorageKey));
    setRecentProductIds(readStoredIdList(recentStorageKey));
  }, [posPrefsKey, favoritesStorageKey, recentStorageKey]);

  const pushRecentProduct = useCallback(
    (productId: string) => {
      setRecentProductIds((prev) => {
        const next = [productId, ...prev.filter((id) => id !== productId)].slice(
          0,
          MAX_RECENT_PRODUCTS,
        );
        writeStoredIdList(recentStorageKey, next);
        return next;
      });
    },
    [recentStorageKey],
  );

  const toggleFavorite = useCallback(
    (productId: string) => {
      setFavoriteProductIds((prev) => {
        const next = prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId];
        writeStoredIdList(favoritesStorageKey, next);
        return next;
      });
    },
    [favoritesStorageKey],
  );

  const toggleShowOutOfStock = useCallback(() => {
    setShowOutOfStock((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`retail-pos:show-oos:${posPrefsKey}`, next ? '1' : '0');
      }
      return next;
    });
  }, [posPrefsKey]);

  const posCategoryChips = useMemo(() => {
    const counts = new Map<string, { name: string; icon: string; count: number }>();
    for (const product of sellableRetailProducts) {
      if (!product.isActive) continue;
      const slug = product.category || 'uncategorized';
      const meta = counts.get(slug);
      if (meta) {
        meta.count += 1;
      } else {
        const fromCatalog = retailCategories.find((c) => c.id === slug);
        counts.set(slug, {
          name:
            fromCatalog?.name ||
            (slug === 'uncategorized' ? 'Uncategorized' : slug.replace(/-/g, ' ')),
          icon: fromCatalog?.icon || '📦',
          count: 1,
        });
      }
    }
    return Array.from(counts.entries())
      .map(([slug, meta]) => ({ slug, ...meta }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sellableRetailProducts, retailCategories]);

  const hiddenOutOfStockCount = useMemo(
    () => sellableRetailProducts.filter((p) => p.isActive && p.stock <= 0).length,
    [sellableRetailProducts],
  );

  // When the storage key changes (different user), clear cart and re-run hydration.
  useEffect(() => {
    if (retailCartStorageKeySeenRef.current === null) {
      retailCartStorageKeySeenRef.current = retailCartStorageKey;
      return;
    }
    if (retailCartStorageKeySeenRef.current === retailCartStorageKey) return;
    retailCartStorageKeySeenRef.current = retailCartStorageKey;
    setCart([]);
    retailCartHydratedRef.current = false;
    setRetailCartPersistenceReady(false);
  }, [retailCartStorageKey]);

  // Restore cart from localStorage once we can resolve product ids (catalog loaded).
  useEffect(() => {
    if (loading || retailCartHydratedRef.current) return;

    let parsed: PersistedRetailCartLine[] | null = null;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(retailCartStorageKey);
        if (raw) parsed = JSON.parse(raw) as PersistedRetailCartLine[];
      }
    } catch {
      parsed = null;
    }

    const lines = Array.isArray(parsed) ? parsed : [];

    retailCartHydratedRef.current = true;

    try {
      const next: CartItem[] = [];
      for (const line of lines) {
        if (!line?.productId) continue;
        const p = sellableRetailProducts.find((x) => x.id === line.productId);
        if (!p || !p.isActive) continue;
        const stock = p.stock;
        const q = Math.floor(Number(line.quantity));
        if (!Number.isFinite(q) || q < 1) continue;
        const qty = Math.min(q, Math.max(stock, 0));
        if (qty < 1) continue;
        const entry: CartItem = { product: p, quantity: qty };
        if (
          typeof line.overridePrice === 'number' &&
          Number.isFinite(line.overridePrice) &&
          line.overridePrice >= 0
        ) {
          entry.overridePrice = line.overridePrice;
        }
        next.push(entry);
      }
      if (next.length > 0) setCart(next);
    } catch {
      /* ignore corrupt storage */
    } finally {
      setRetailCartPersistenceReady(true);
    }
  }, [loading, sellableRetailProducts, retailCartStorageKey]);

  // Persist cart (after hydration so we don't wipe storage on first paint).
  useEffect(() => {
    if (!retailCartPersistenceReady || typeof window === 'undefined') return;
    try {
      if (cart.length === 0) {
        localStorage.removeItem(retailCartStorageKey);
        return;
      }
      const payload: PersistedRetailCartLine[] = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        ...(item.overridePrice !== undefined ? { overridePrice: item.overridePrice } : {}),
      }));
      localStorage.setItem(retailCartStorageKey, JSON.stringify(payload));
    } catch {
      /* ignore quota / private mode */
    }
  }, [cart, retailCartPersistenceReady, retailCartStorageKey]);

  // Local editing state so inputs can be cleared / partially typed before committing
  const [editingQty, setEditingQty] = useState<Record<string, string>>({});
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});

  const commitQty = (productId: string) => {
    const raw = editingQty[productId];
    if (raw !== undefined) {
      const val = parseInt(raw, 10);
      if (!isNaN(val) && val > 0) {
        updateCartQuantity(productId, val);
      } else if (raw === '' || val <= 0) {
        // Treat empty or zero as remove
        updateCartQuantity(productId, 0);
      }
      setEditingQty((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    }
  };

  const commitPrice = (productId: string) => {
    const raw = editingPrice[productId];
    if (raw !== undefined) {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0) {
        updateCartPrice(productId, val);
      }
      setEditingPrice((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    }
  };

  // Customer search filter
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.filter(c => c.status !== 'inactive');
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.status !== 'inactive' &&
        (`${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)),
    );
  }, [customers, customerSearchQuery]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let products = sellableRetailProducts.filter((p) => p.isActive);

    if (!showOutOfStock) {
      products = products.filter((p) => p.stock > 0);
    }

    if (activeBrowseKey === 'recent') {
      const order = new Map(recentProductIds.map((id, index) => [id, index]));
      products = products
        .filter((p) => order.has(p.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } else if (activeBrowseKey === 'favorites') {
      const favSet = new Set(favoriteProductIds);
      products = products.filter((p) => favSet.has(p.id));
    } else if (activeBrowseKey !== 'all') {
      products = products.filter((p) => p.category === activeBrowseKey);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode?.includes(q),
      );
    }
    return products;
  }, [
    activeBrowseKey,
    favoriteProductIds,
    recentProductIds,
    searchQuery,
    sellableRetailProducts,
    showOutOfStock,
  ]);

  const emptyProductsMessage = useMemo(() => {
    if (searchQuery.trim()) return 'No products match your search';
    if (activeBrowseKey === 'favorites') {
      return 'No favorites yet — tap the star on a product to save it here';
    }
    if (activeBrowseKey === 'recent') {
      return 'No recent products — items appear here after you add them to a sale';
    }
    if (!showOutOfStock && hiddenOutOfStockCount > 0) {
      return `No in-stock products. ${hiddenOutOfStockCount} out-of-stock item${
        hiddenOutOfStockCount === 1 ? '' : 's'
      } hidden — tap "Show OOS" to view them.`;
    }
    return 'No products found';
  }, [activeBrowseKey, hiddenOutOfStockCount, searchQuery, showOutOfStock]);

  // Cart functions
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    pushRecentProduct(product.id);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Only ${product.stock} in stock`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const updateCartPrice = (productId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, overridePrice: price } : item
      )
    );
  };

  /** Effective unit price for a cart item (override or original) */
  const getUnitPrice = (item: CartItem) =>
    item.overridePrice !== undefined ? item.overridePrice : item.product.price;

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const resetDiscount = () => {
    setDiscountInput('');
    setDiscountMode('amount');
  };

  const resetCashPayment = () => {
    setCashPaymentMethod('cash');
    setCashPaymentReference('');
  };

  const clearCart = () => {
    setCart([]);
    resetDiscount();
    resetCashPayment();
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + getUnitPrice(item) * item.quantity,
    0,
  );

  const discountAmount = useMemo(() => {
    if (!discountInput.trim() || subtotal <= 0) return 0;
    const raw = parseFloat(discountInput);
    if (Number.isNaN(raw) || raw <= 0) return 0;
    if (discountMode === 'percent') {
      return Math.min(subtotal, (subtotal * Math.min(raw, 100)) / 100);
    }
    return Math.min(subtotal, raw);
  }, [discountInput, discountMode, subtotal]);

  const tax = 0;
  const total = Math.max(subtotal - discountAmount, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (saleType === 'credit' && !selectedCustomer) {
      toast.error('Please select a customer for credit sale');
      setShowCustomerPicker(true);
      return;
    }

    setIsProcessing(true);

    try {
      const paymentTimestamp = new Date(`${invoiceDate}T12:00:00`).toISOString();

      const creditDepositAmount =
        saleType === 'credit'
          ? Math.min(Math.max(parseFloat(creditDeposit) || 0, 0), total)
          : 0;

      const payments: Array<{
        method: PaymentMethod;
        amount: number;
        reference?: string;
        description?: string;
        paid_at?: string;
      }> =
        saleType === 'credit'
          ? creditDepositAmount > 0
            ? [
                {
                  method: creditPaymentMethod,
                  amount: creditDepositAmount,
                  description:
                    creditPaymentDescription.trim() || 'Deposit at invoice creation',
                  paid_at: paymentTimestamp,
                },
              ]
            : []
          : [
              {
                method: cashPaymentMethod,
                amount: total,
                reference: cashPaymentReference.trim() || undefined,
                paid_at: paymentTimestamp,
              },
            ];

      const dueDate = saleType === 'credit'
        ? new Date(new Date(`${invoiceDate}T12:00:00`).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const assignmentId = user?.id
        ? await resolveActiveAssignmentId(user.id, invoiceDate || format(new Date(), 'yyyy-MM-dd'))
        : null;

      const order = await createOrder({
        order_type: 'pos',
        sale_type: saleType,
        assignment_id: assignmentId || undefined,
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer
          ? getCustomerDisplayName(selectedCustomer)
          : walkInCustomerName.trim() || undefined,
        customer_email: selectedCustomer?.email,
        customer_phone: selectedCustomer
          ? selectedCustomer.phone
          : walkInCustomerPhone.trim() || undefined,
        customer_address: selectedCustomer
          ? formatStoredCustomerAddress(selectedCustomer)
          : walkInCustomerAddress.trim() || undefined,
        created_at: paymentTimestamp,
        due_date: dueDate,
        consignment_info: saleType === 'credit' ? consignmentInfo.trim() || undefined : undefined,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          product_image: item.product.image,
          unit_price: getUnitPrice(item),
          unit_cost: item.product.cost,
          quantity: item.quantity,
          sku: item.product.sku,
          barcode: item.product.barcode,
        })),
        payments,
      });

      if (order) {
        setLastOrder(order);

        // Refetch customers so credit_balance reflects the DB trigger update,
        // then grab the fresh customer object from the returned array
        let freshCustomer: Customer | null = null;
        if (selectedCustomer) {
          const freshList = await refetchCustomers();
          freshCustomer = freshList.find((c) => c.id === selectedCustomer.id) ?? selectedCustomer;
        }
        setLastOrderCustomer(freshCustomer);

        const label = saleType === 'credit' ? 'Credit invoice' : 'Sale';
        const paidVia =
          saleType === 'cash' && order.payments[0]
            ? ` · ${paymentMethodLabel(order.payments[0].method)}`
            : '';
        toast.success(
          `${label} #${order.invoice_number || order.order_number} — ${fc(order.total)}${paidVia}`,
        );

        // Send SMS notification for credit invoices (fire-and-forget)
        if (saleType === 'credit') {
          const overallBalance = freshCustomer?.credit_balance ?? order.total;
          const paidAtCreation = order.payments.reduce((s, p) => s + p.amount, 0);
          const netIncrease = Math.max(order.total - paidAtCreation, 0);
          const previousBalance = Math.max(overallBalance - netIncrease, 0);
          notifyInvoiceCreated(
            order,
            companyName,
            previousBalance,
            overallBalance,
            consignmentInfo,
          );
        }

        if (saleType === 'cash' && order.payment_status !== 'paid') {
          setPostSalePaymentOrder(order);
          setIsPostSalePaymentOpen(true);
        } else {
          setIsInvoiceOpen(true);
        }
        clearCart();
        setSelectedCustomer(null);
        setSaleType('cash');
        setConsignmentInfo('');
        setCreditDeposit('');
        setCreditPaymentDescription('');
        setCreditPaymentMethod('cash');
        setInvoiceDate(new Date().toISOString().slice(0, 10));
        setWalkInCustomerName('');
        setWalkInCustomerPhone('');
        setWalkInCustomerAddress('');
        refetchProducts();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sale');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReceiptData = (order: SaleOrder): ReceiptData => {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      date: new Date(order.created_at),
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerAddress: order.customer_address,
      items: order.items.map((item) => ({
        id: item.product_id || item.id,
        name: item.product_name,
        price: item.unit_price,
        category: '',
        image: item.product_image || '',
        quantity: item.quantity,
        modifiers: [],
        notes: item.notes,
      })) as any,
      subtotal: order.subtotal,
      tax: order.tax_amount,
      discount: order.discount_amount > 0 ? order.discount_amount : undefined,
      total: order.total,
      paymentMethod: order.payments[0]?.method
        ? paymentMethodLabel(order.payments[0].method)
        : 'Cash',
      type: 'dine-in', // Retail doesn't use this field, but type requires it
      staffName: order.staff_name,
    };
  };

  return (
    <PageLayout
      activeTab="pos"
      onNavigate={onNavigate}
      flexContent
      hideHeaderSearch
      // Hide bottom tabs while cart sheet is open so Complete Sale owns thumb space
      hideBottomNav={mobileCartOpen}
    >
          {/* Product Grid Area */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/*
              POS connectivity strip — always visible on mobile cashiers.
              REVIEW: Uses useSyncStatus (navigator.onLine). Replace/extend if a richer sync context lands.
            */}
            <div
              className={cn(
                'flex items-center gap-2 border-b px-3 py-2 text-xs lg:hidden',
                isOnline
                  ? 'border-border bg-muted/40 text-muted-foreground'
                  : 'border-destructive/20 bg-destructive/10 text-destructive',
              )}
              role="status"
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5 shrink-0 text-success" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <CloudOff className="h-3.5 w-3.5 shrink-0" />
                  <span>Offline — sale will sync when reconnected</span>
                </>
              )}
            </div>

            {/* Search + scan + view mode */}
            <div className="flex gap-2 p-2 pb-2 sm:gap-3 sm:p-3 lg:p-4 lg:pb-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, SKU, or barcode…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  // Keep text keyboard so cashiers can search by product name;
                  // barcode wedges still type into this field. Quantity fields use inputMode=numeric.
                  className="min-h-11 pl-10 text-base"
                />
              </div>
              {/*
                STUB: Camera barcode scan affordance only — no scanner SDK wired yet.
                TODO: Wire to a camera barcode scanner (e.g. BarcodeDetector / html5-qrcode) and set searchQuery / add-to-cart on hit.
              */}
              <button
                type="button"
                aria-label="Scan barcode"
                title="Scan barcode"
                onClick={() => {
                  // TODO: Implement camera-based barcode scanning
                  console.log('[RetailPOS] Barcode scan button tapped — scanner not implemented yet');
                }}
                className="focus-ring flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors duration-200 hover:bg-muted/60 active:scale-95 active:bg-muted"
              >
                <ScanBarcode className="h-5 w-5" />
              </button>
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-1">
                <button
                  type="button"
                  onClick={toggleShowOutOfStock}
                  className={cn(
                    'focus-ring flex min-h-11 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-200 active:scale-95',
                    showOutOfStock
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  title={
                    showOutOfStock
                      ? 'Hide out-of-stock products'
                      : `Show out-of-stock products (${hiddenOutOfStockCount})`
                  }
                >
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {showOutOfStock ? 'Hide OOS' : 'Show OOS'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProductViewMode('card');
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(PRODUCT_VIEW_STORAGE_KEY, 'card');
                    }
                  }}
                  className={cn(
                    'focus-ring flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-200 active:scale-95',
                    productViewMode === 'card'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProductViewMode('list');
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(PRODUCT_VIEW_STORAGE_KEY, 'list');
                    }
                  }}
                  className={cn(
                    'focus-ring flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors duration-200 active:scale-95',
                    productViewMode === 'list'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>

            {/* Browse: All / Recent / Favorites / categories */}
            <div className="flex gap-2 overflow-x-auto px-2 pb-2 sm:px-3 lg:px-4 scrollbar-hide">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'recent', label: 'Recent', icon: Clock },
                  { key: 'favorites', label: 'Favorites', icon: Star },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveBrowseKey(key)}
                  className={cn(
                    'focus-ring flex min-h-8 shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                    activeBrowseKey === key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {label}
                </button>
              ))}
              {posCategoryChips.map((chip) => (
                <button
                  key={chip.slug}
                  type="button"
                  onClick={() => setActiveBrowseKey(chip.slug)}
                  className={cn(
                    'focus-ring flex min-h-8 shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                    activeBrowseKey === chip.slug
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>{chip.icon}</span>
                  <span>{chip.name}</span>
                  <span className="opacity-70">({chip.count})</span>
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div
              className={cn(
                'flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4',
                // Clear sticky mini-cart + action bar on mobile while shopping
                totalItems > 0 && 'pb-28 lg:pb-4',
              )}
            >
              {/* Dev-only offline cache banner — stripped from production builds via Vite */}
              {import.meta.env.DEV && (
                <div className="mb-2 rounded border border-dashed border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
                  Cache: {debugOfflineCacheKey} | Source: {debugLastDataSource}
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading products...</p>
                  </div>
                </div>
              ) : (
              <>
              {productViewMode === 'card' ? (
                <div className="grid auto-rows-min content-start gap-2 sm:gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))] lg:[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]">
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find(
                      (c) => c.product.id === product.id
                    );
                    const inCart = cartItem ? cartItem.quantity : 0;
                    const isOutOfStock = product.stock <= 0;
                    const stockChipStatus = getStockStatus(product);
                    const mainStock = getMainStock(product);
                    const showsAllocatedStock = mainStock !== product.stock;
                    const isFavorite = favoriteProductIds.includes(product.id);

                    return (
                      <div
                        key={product.id}
                        role="button"
                        tabIndex={isOutOfStock ? -1 : 0}
                        onClick={() => {
                          if (!isOutOfStock) addToCart(product);
                        }}
                        onKeyDown={(e) => {
                          if (isOutOfStock) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            addToCart(product);
                          }
                        }}
                        className={cn(
                          'focus-ring group relative min-h-[7.5rem] cursor-pointer rounded-lg border bg-card p-2 text-left transition-all duration-200 active:scale-[0.98] sm:min-h-0 sm:p-3',
                          inCart > 0
                            ? 'border-primary shadow-md'
                            : 'border-border hover:border-primary/40',
                          isOutOfStock && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <div className="relative aspect-square rounded overflow-hidden bg-muted mb-2">
                          <button
                            type="button"
                            aria-label={
                              isFavorite ? 'Remove from favorites' : 'Add to favorites'
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(product.id);
                            }}
                            className="focus-ring absolute top-1 right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background/85 shadow-sm transition-transform duration-200 active:scale-95"
                          >
                            <Star
                              className={cn(
                                'h-3.5 w-3.5',
                                isFavorite
                                  ? 'fill-warning text-warning'
                                  : 'text-muted-foreground',
                              )}
                            />
                          </button>
                          <img
                            src={product.image || generatePlaceholderUrl(product.name)}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isOutOfStock && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/60" aria-hidden />
                          )}
                          {inCart > 0 && (
                            <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center">
                              {inCart}
                            </div>
                          )}
                          {product.discount && (
                            <div className="absolute bottom-1 left-1">
                              <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                                {product.discount}% OFF
                              </Badge>
                            </div>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-1 sm:line-clamp-2 mb-0.5">
                          {product.name}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-bold text-foreground">
                            {fc(product.price)}
                          </span>
                          <div className="flex min-w-0 flex-col items-end gap-0.5">
                            {stockChipStatus && (
                              <StatusChip status={stockChipStatus} size="sm" />
                            )}
                            <span className="font-mono text-[10px] text-ink-2 num sm:text-xs">
                              {product.stock} {product.unit}
                            </span>
                          </div>
                        </div>
                        {showsAllocatedStock && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Main: {mainStock} {product.unit}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find((c) => c.product.id === product.id);
                    const inCart = cartItem ? cartItem.quantity : 0;
                    const isOutOfStock = product.stock <= 0;
                    const stockChipStatus = getStockStatus(product);
                    const mainStock = getMainStock(product);
                    const showsAllocatedStock = mainStock !== product.stock;
                    const isFavorite = favoriteProductIds.includes(product.id);

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          'flex items-center gap-2 rounded-md border bg-card py-1.5 pl-1.5 pr-2',
                          inCart > 0 ? 'border-primary' : 'border-border',
                          isOutOfStock && 'opacity-60',
                        )}
                      >
                        <button
                          type="button"
                          aria-label={
                            isFavorite ? 'Remove from favorites' : 'Add to favorites'
                          }
                          onClick={() => toggleFavorite(product.id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md active:scale-95"
                        >
                          <Star
                            className={cn(
                              'h-3.5 w-3.5',
                              isFavorite
                                ? 'fill-warning text-warning'
                                : 'text-muted-foreground',
                            )}
                          />
                        </button>
                        <img
                          src={product.image || generatePlaceholderUrl(product.name)}
                          alt={product.name}
                          className="h-9 w-9 shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                              {product.name}
                            </p>
                            {stockChipStatus && (
                              <StatusChip status={stockChipStatus} size="sm" className="shrink-0" />
                            )}
                            {product.discount && (
                              <Badge className="bg-destructive px-1 py-0 text-[9px] text-destructive-foreground">
                                {product.discount}% OFF
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px]">
                            <span className="font-bold text-foreground">{fc(product.price)}</span>
                            <span className="font-mono text-ink-2 num">
                              {product.stock} {product.unit}
                            </span>
                            {showsAllocatedStock && (
                              <span className="text-muted-foreground">
                                Main: {mainStock}
                              </span>
                            )}
                            {inCart > 0 && (
                              <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                                ×{inCart}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          disabled={isOutOfStock}
                          className="h-8 min-h-8 shrink-0 px-2.5 text-xs font-semibold active:scale-95"
                        >
                          {isOutOfStock ? 'Out' : 'Add'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredProducts.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{emptyProductsMessage}</p>
                </div>
              )}
              </>
              )}
            </div>
          </div>

          {/* ── Mobile sticky mini-cart + checkout bar (always visible while cart has items) ── */}
          {totalItems > 0 && !mobileCartOpen && (
            <div
              className="lg:hidden fixed inset-x-0 z-50 flex h-[var(--tap-primary)] items-center gap-3 border-t border-hairline bg-surface px-3 shadow-float"
              style={{
                bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <p className="min-w-0 flex-1 truncate font-mono text-sm text-ink num">
                {totalItems} item{totalItems === 1 ? '' : 's'} · {formatKES(total)}
              </p>
              <button
                type="button"
                onClick={() => setMobileCartOpen(true)}
                className="focus-ring flex min-h-[var(--tap-min)] shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 text-sm font-semibold text-primary-foreground active:scale-95"
              >
                <ShoppingCart className="h-4 w-4" aria-hidden />
                Review Cart &amp; Checkout
              </button>
            </div>
          )}

          {/* Extra scroll padding removed — product list uses pb-28 when cart has items */}

          {/* ── Mobile Cart Overlay (slide-up panel) ── */}
          {mobileCartOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => { if (!isProcessing) setMobileCartOpen(false); }}
              />
              {/* Panel — fills above home indicator; Complete Sale sticks to bottom */}
              <div
                className="receipt-panel receipt-torn-bottom relative mt-auto flex max-h-[90vh] flex-col animate-in slide-in-from-bottom duration-200"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                <div className="shrink-0 border-b border-hairline px-3 py-2">
                  <div className="flex items-start gap-1">
                    <button
                      type="button"
                      onClick={() => { if (!isProcessing) setMobileCartOpen(false); }}
                      className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] shrink-0 items-center justify-center rounded-[var(--radius)] text-ink-2 active:scale-95"
                      disabled={isProcessing}
                      aria-label="Close cart"
                    >
                      <ChevronDown className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <CartReceiptHeader
                        totalItems={totalItems}
                        showClear={cart.length > 0}
                        onClear={clearCart}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-b border-hairline px-3 py-2">
                  <SaleTypeTabs
                    saleType={saleType}
                    onCash={() => {
                      setSaleType('cash');
                      setConsignmentInfo('');
                      setCreditDeposit('');
                      setCreditPaymentDescription('');
                      setCreditPaymentMethod('cash');
                      setRecordDepositNow(false);
                      setInvoiceDate(new Date().toISOString().slice(0, 10));
                      if (saleType === 'credit') setSelectedCustomer(null);
                    }}
                    onCredit={() => {
                      setSaleType('credit');
                      if (!selectedCustomer) setShowCustomerPicker(true);
                    }}
                  />
                  {/* Customer picker for credit sales */}
                  {saleType === 'credit' && !showCustomerPicker && (
                    <>
                      {selectedCustomer ? (
                        <div className="flex items-center justify-between rounded border border-border bg-muted/40 p-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                {getCustomerDisplayName(selectedCustomer)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Balance: {fc(selectedCustomer.credit_balance)}
                                {selectedCustomer.credit_limit > 0 &&
                                  ` / Limit: ${fc(selectedCustomer.credit_limit)}`}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(null);
                              setShowCustomerPicker(true);
                            }}
                            className="flex min-h-9 min-w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCustomerPicker(true)}
                          className="flex w-full min-h-9 items-center justify-center gap-1.5 rounded border border-dashed border-border p-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Select Customer
                        </button>
                      )}
                    </>
                  )}
                  {showCustomerPicker && (
                    <div className="max-h-48 overflow-hidden rounded border border-border bg-card shadow-lg">
                      <div className="border-b border-border p-2">
                        <Input
                          placeholder="Search customers..."
                          value={customerSearchQuery}
                          onChange={(e) => setCustomerSearchQuery(e.target.value)}
                          className="h-7 text-xs"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        {filteredCustomers.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">
                            No customers found
                          </p>
                        ) : (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setShowCustomerPicker(false);
                                setCustomerSearchQuery('');
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {getCustomerDisplayName(customer)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {customer.phone || customer.email || ''}
                                </p>
                              </div>
                              <div className="text-right">
                                {customer.credit_balance > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="border-border text-[10px] text-muted-foreground"
                                  >
                                    {fc(customer.credit_balance)}
                                  </Badge>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="border-t border-border p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-full text-xs"
                          onClick={() => {
                            setShowCustomerPicker(false);
                            setCustomerSearchQuery('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {saleType === 'cash' && (
                    <WalkInCustomerFields
                      name={walkInCustomerName}
                      phone={walkInCustomerPhone}
                      address={walkInCustomerAddress}
                      onNameChange={setWalkInCustomerName}
                      onPhoneChange={setWalkInCustomerPhone}
                      onAddressChange={setWalkInCustomerAddress}
                    />
                  )}
                </div>

                {/* Scrollable body: items + totals + credit form (whole cart, not items-only) */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="px-3 pt-1">
                  {cart.map((item) => {
                    const unitPrice = getUnitPrice(item);
                    return (
                      <CartReceiptLine
                        key={item.product.id}
                        item={item}
                        unitPrice={unitPrice}
                        editingPrice={editingPrice[item.product.id]}
                        editingQty={editingQty[item.product.id]}
                        onPriceChange={(id, value) =>
                          setEditingPrice((prev) => ({ ...prev, [id]: value }))
                        }
                        onPriceCommit={commitPrice}
                        onQtyEditingChange={(id, value) =>
                          setEditingQty((prev) => ({ ...prev, [id]: value }))
                        }
                        onQtyCommit={commitQty}
                        onQtyStep={(id, next) => {
                          setEditingQty((prev) => {
                            const n = { ...prev };
                            delete n[id];
                            return n;
                          });
                          updateCartQuantity(id, next);
                        }}
                        onRemove={removeFromCart}
                      />
                    );
                  })}
                  </div>

                  <div className="space-y-3 border-t border-hairline p-3">
                  <CartTotalsSection
                    subtotal={subtotal}
                    discountMode={discountMode}
                    onDiscountModeChange={setDiscountMode}
                    discountInput={discountInput}
                    onDiscountInputChange={setDiscountInput}
                    discountAmount={discountAmount}
                    total={total}
                  />

                  {saleType === 'cash' && (
                    <CartPaymentMethodSection
                      method={cashPaymentMethod}
                      onMethodChange={setCashPaymentMethod}
                      reference={cashPaymentReference}
                      onReferenceChange={setCashPaymentReference}
                    />
                  )}

                  {saleType === 'credit' && (
                    <CreditSaleExtras
                      total={total}
                      recordDepositNow={recordDepositNow}
                      onRecordDepositNowChange={setRecordDepositNow}
                      creditDeposit={creditDeposit}
                      onCreditDepositChange={setCreditDeposit}
                      creditPaymentDescription={creditPaymentDescription}
                      onCreditPaymentDescriptionChange={setCreditPaymentDescription}
                      creditPaymentMethod={creditPaymentMethod}
                      onCreditPaymentMethodChange={setCreditPaymentMethod}
                      consignmentInfo={consignmentInfo}
                      onConsignmentInfoChange={setConsignmentInfo}
                      invoiceDate={invoiceDate}
                      onInvoiceDateChange={setInvoiceDate}
                    />
                  )}
                  </div>

                  <CartCheckoutFooter
                    saleType={saleType}
                    total={total}
                    isProcessing={isProcessing}
                    disabled={isProcessing || (saleType === 'credit' && !selectedCustomer)}
                    disabledHint={cartCheckoutDisabledHint(
                      isProcessing,
                      saleType,
                      selectedCustomer,
                    )}
                    onClick={async () => {
                      await handleCompleteSale();
                      setMobileCartOpen(false);
                    }}
                  />
                </div>
                <div className="receipt-torn-edge shrink-0 pb-2" aria-hidden />
              </div>
            </div>
          )}

          {/* ── Desktop Cart Sidebar (hidden on mobile) ── */}
          <div className="receipt-panel receipt-torn-bottom hidden h-full w-96 shrink-0 flex-col lg:flex">
            <div className="shrink-0 border-b border-hairline">
              <CartReceiptHeader
                totalItems={totalItems}
                showClear={cart.length > 0}
                onClear={clearCart}
              />
            </div>

            <div className="shrink-0 border-b border-hairline px-4 pb-3 pt-1">
              <div className="mt-1">
                <SaleTypeTabs
                  saleType={saleType}
                  onCash={() => {
                    setSaleType('cash');
                    setConsignmentInfo('');
                    setCreditDeposit('');
                    setCreditPaymentDescription('');
                    setCreditPaymentMethod('cash');
                    setRecordDepositNow(false);
                    setInvoiceDate(new Date().toISOString().slice(0, 10));
                    if (saleType === 'credit') setSelectedCustomer(null);
                  }}
                  onCredit={() => {
                    setSaleType('credit');
                    if (!selectedCustomer) setShowCustomerPicker(true);
                  }}
                />
              </div>

              {/* Customer picker for credit sales */}
              {saleType === 'credit' && (
                <div className="mt-2">
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between rounded border border-border bg-muted/40 p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {getCustomerDisplayName(selectedCustomer)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Balance: {fc(selectedCustomer.credit_balance)}
                            {selectedCustomer.credit_limit > 0 &&
                              ` / Limit: ${fc(selectedCustomer.credit_limit)}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setShowCustomerPicker(true);
                        }}
                        className="flex min-h-9 min-w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCustomerPicker(true)}
                      className="flex w-full min-h-9 items-center justify-center gap-1.5 rounded border border-dashed border-border p-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Select Customer
                    </button>
                  )}
                </div>
              )}

              {/* Customer picker dropdown */}
              {showCustomerPicker && (
                <div className="mt-2 max-h-48 overflow-hidden rounded border border-border bg-card shadow-lg">
                  <div className="border-b border-border p-2">
                    <Input
                      placeholder="Search customers..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        No customers found
                      </p>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowCustomerPicker(false);
                            setCustomerSearchQuery('');
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {getCustomerDisplayName(customer)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {customer.phone || customer.email || ''}
                            </p>
                          </div>
                          <div className="text-right">
                            {customer.credit_balance > 0 && (
                              <Badge
                                variant="outline"
                                className="border-border text-[10px] text-muted-foreground"
                              >
                                {fc(customer.credit_balance)}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-border p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-full text-xs"
                      onClick={() => {
                        setShowCustomerPicker(false);
                        setCustomerSearchQuery('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {saleType === 'cash' && (
                <div className="mt-3">
                  <WalkInCustomerFields
                    compact
                    name={walkInCustomerName}
                    phone={walkInCustomerPhone}
                    address={walkInCustomerAddress}
                    onNameChange={setWalkInCustomerName}
                    onPhoneChange={setWalkInCustomerPhone}
                    onAddressChange={setWalkInCustomerAddress}
                  />
                </div>
              )}
            </div>

            {/* Scrollable body: items + totals + credit form (whole cart, not items-only) */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="px-4 pt-1">
              {cart.length === 0 && (
                <div className="py-12 text-center text-ink-2">
                  <ShoppingCart className="mx-auto mb-3 h-10 w-10 opacity-50" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="mt-1 text-xs">Tap a product or scan barcode</p>
                </div>
              )}

              {cart.map((item) => {
                const unitPrice = getUnitPrice(item);
                return (
                  <CartReceiptLine
                    key={item.product.id}
                    item={item}
                    unitPrice={unitPrice}
                    editingPrice={editingPrice[item.product.id]}
                    editingQty={editingQty[item.product.id]}
                    onPriceChange={(id, value) =>
                      setEditingPrice((prev) => ({ ...prev, [id]: value }))
                    }
                    onPriceCommit={commitPrice}
                    onQtyEditingChange={(id, value) =>
                      setEditingQty((prev) => ({ ...prev, [id]: value }))
                    }
                    onQtyCommit={commitQty}
                    onQtyStep={(id, next) => {
                      setEditingQty((prev) => {
                        const n = { ...prev };
                        delete n[id];
                        return n;
                      });
                      updateCartQuantity(id, next);
                    }}
                    onRemove={removeFromCart}
                  />
                );
              })}
              </div>

              {cart.length > 0 && (
                <>
                  <div className="space-y-4 border-t border-hairline p-4">
                    <CartTotalsSection
                      subtotal={subtotal}
                      discountMode={discountMode}
                      onDiscountModeChange={setDiscountMode}
                      discountInput={discountInput}
                      onDiscountInputChange={setDiscountInput}
                      discountAmount={discountAmount}
                      total={total}
                    />

                    {saleType === 'cash' && (
                      <CartPaymentMethodSection
                        method={cashPaymentMethod}
                        onMethodChange={setCashPaymentMethod}
                        reference={cashPaymentReference}
                        onReferenceChange={setCashPaymentReference}
                      />
                    )}

                    {saleType === 'credit' && (
                      <CreditSaleExtras
                        total={total}
                        recordDepositNow={recordDepositNow}
                        onRecordDepositNowChange={setRecordDepositNow}
                        creditDeposit={creditDeposit}
                        onCreditDepositChange={setCreditDeposit}
                        creditPaymentDescription={creditPaymentDescription}
                        onCreditPaymentDescriptionChange={setCreditPaymentDescription}
                        creditPaymentMethod={creditPaymentMethod}
                        onCreditPaymentMethodChange={setCreditPaymentMethod}
                        consignmentInfo={consignmentInfo}
                        onConsignmentInfoChange={setConsignmentInfo}
                        invoiceDate={invoiceDate}
                        onInvoiceDateChange={setInvoiceDate}
                      />
                    )}
                  </div>

                  <CartCheckoutFooter
                    saleType={saleType}
                    total={total}
                    isProcessing={isProcessing}
                    disabled={isProcessing || (saleType === 'credit' && !selectedCustomer)}
                    disabledHint={cartCheckoutDisabledHint(
                      isProcessing,
                      saleType,
                      selectedCustomer,
                    )}
                    onClick={handleCompleteSale}
                    lastOrder={lastOrder}
                    onReprint={() => setIsInvoiceOpen(true)}
                  />
                </>
              )}
            </div>
            <div className="receipt-torn-edge shrink-0 pb-2" aria-hidden />
          </div>

      {/* Invoice/Receipt Dialog */}
      {isInvoiceOpen && lastOrder && (
        <InvoiceDialog
          open={isInvoiceOpen}
          onOpenChange={(open) => {
            setIsInvoiceOpen(open);
            if (!open) {
              setLastOrder(null);
              setLastOrderCustomer(null);
            }
          }}
          order={lastOrder}
          customer={lastOrderCustomer}
          receiptData={generateReceiptData(lastOrder)}
          defaultView={lastOrder.sale_type === 'credit' ? 'invoice' : 'receipt'}
        />
      )}

      {postSalePaymentOrder && (
        <PaymentDialog
          variant="methodOnly"
          open={isPostSalePaymentOpen}
          onOpenChange={(open) => {
            setIsPostSalePaymentOpen(open);
            if (!open) setPostSalePaymentOrder(null);
          }}
          order={postSalePaymentOrder}
          onRecordPayment={recordPayment}
          onPaymentComplete={() => {
            toast.success('Payment method recorded');
            setIsInvoiceOpen(true);
          }}
          companyName={companyName}
        />
      )}
    </PageLayout>
  );
}
