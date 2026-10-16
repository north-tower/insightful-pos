import { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react';
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
  Info,
  Star,
  Clock,
  Check,
  Layers,
} from 'lucide-react';
import { fc, CURRENCY_SYMBOL } from '@/lib/currency';
import { formatKES } from '@/lib/formatKES';
import { formatDate } from '@/lib/formatDate';
import { getStockStatus } from '@/lib/stockStatus';
import { formatQty, formatQtyAmount, isDecimalUnit, normalizeUnit } from '@/lib/units';
import type { ProductCategory } from '@/data/productData';
import { parseCommittedCartQuantity } from '@/lib/retailCartQty';
import {
  QuantityKeypad,
  type QuantityKeypadMode,
} from '@/components/pos/QuantityKeypad';
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
  const stored = window.localStorage.getItem(PRODUCT_VIEW_STORAGE_KEY);
  if (stored === 'list' || stored === 'card') return stored;
  return window.innerWidth >= 1024 ? 'list' : 'card';
}

function hashCategorySlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

const CATEGORY_BLOCK_CLASSES = [
  'bg-[hsl(var(--accent-soft))] text-ink',
  'bg-secondary text-secondary-foreground',
  'bg-muted text-ink',
] as const;

function getCategoryPlaceholderMeta(
  product: Product,
  categories: ProductCategory[],
): { initial: string; blockClass: string } {
  const slug = product.category || 'uncategorized';
  const fromCatalog = categories.find((c) => c.id === slug);
  const name =
    fromCatalog?.name ||
    (slug === 'uncategorized' ? 'Uncategorized' : slug.replace(/-/g, ' '));
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  const blockClass = CATEGORY_BLOCK_CLASSES[hashCategorySlug(slug) % CATEGORY_BLOCK_CLASSES.length];
  return { initial, blockClass };
}

function formatPricePerUnit(price: number, unit: string): string {
  return `${formatKES(price)} / ${normalizeUnit(unit)}`;
}

function PosProductStockHint({ status }: { status: 'low' | 'out' }) {
  const label = status === 'low' ? 'Low stock' : 'Out';
  const dotClass =
    status === 'low' ? 'bg-[hsl(var(--wait))]' : 'bg-[hsl(var(--fail))]';
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-ink">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function hasProductImage(product: Product): boolean {
  return Boolean(product.image?.trim());
}

function showPosCategoryChips(
  chips: Array<{ slug: string; name: string; icon: string; count: number }>,
): boolean {
  if (chips.length === 0) return false;
  if (chips.length > 1) return true;
  const only = chips[0];
  return only.slug !== 'uncategorized' && only.name !== 'Uncategorized';
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
  compact = false,
}: {
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  reference: string;
  onReferenceChange: (value: string) => void;
  compact?: boolean;
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
              'focus-ring relative flex min-h-[var(--tap-min)] rounded-[var(--radius)] border-2 px-2 active:scale-95',
              compact
                ? 'flex-row items-center justify-center gap-2 py-1 text-left'
                : 'min-h-[var(--tap-primary)] flex-col items-center justify-center gap-1 py-2 text-center',
              selected
                ? 'border-primary bg-[hsl(var(--accent-soft))] text-ink'
                : 'border-hairline bg-surface text-ink-2 hover:border-primary/40',
            )}
          >
            {selected && (
              <Check className="absolute right-1.5 top-1.5 h-4 w-4 text-primary" aria-hidden />
            )}
            <Icon className={cn(compact ? 'h-5 w-5 shrink-0' : 'h-5 w-5', selected ? 'text-primary' : 'text-ink-2')} />
            <span className={cn('font-semibold leading-tight', compact ? 'text-xs' : 'text-sm')}>{label}</span>
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

/** +/- quantity control with tappable quantity (opens keypad). */
function CartQtyControl({
  productId,
  quantity,
  unit,
  onStep,
  onEditQuantity,
}: {
  productId: string;
  quantity: number;
  unit: string;
  onStep: (productId: string, nextQty: number) => void;
  onEditQuantity: (productId: string) => void;
}) {
  const qtyLabel = formatQty(quantity, unit);
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
      <button
        type="button"
        data-testid={`cart-qty-edit-${productId}`}
        aria-label={`Quantity ${qtyLabel}, tap to edit`}
        onClick={() => onEditQuantity(productId)}
        className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-paper px-2 font-mono text-sm font-semibold text-ink num active:scale-95"
      >
        {formatQtyAmount(quantity)}
      </button>
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

      <label className="flex min-h-[var(--tap-min)] cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-hairline bg-surface px-3">
        <Checkbox
          checked={recordDepositNow}
          onCheckedChange={(checked) => onRecordDepositNowChange(checked === true)}
          className="h-6 w-6"
        />
        <span className="text-sm font-medium text-ink">Record a deposit now?</span>
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
  const [discountOpen, setDiscountOpen] = useState(
    () => discountAmount > 0 || discountInput.trim().length > 0,
  );

  useEffect(() => {
    if (discountAmount > 0 || discountInput.trim().length > 0) {
      setDiscountOpen(true);
    }
  }, [discountAmount, discountInput]);

  return (
    <div className="space-y-3 text-sm">
      {!discountOpen ? (
        <button
          type="button"
          onClick={() => setDiscountOpen(true)}
          className="focus-ring min-h-[var(--tap-min)] text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Add discount
        </button>
      ) : (
        <div className="space-y-1.5 border-b border-dotted border-hairline pb-3">
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
                    : 'border border-hairline bg-paper text-ink-2',
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
                    : 'border border-hairline bg-paper text-ink-2',
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
              className="min-h-[var(--tap-min)] border-hairline bg-paper text-sm"
            />
          </div>
        </div>
      )}

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

      <div
        className="flex items-baseline justify-between border-t-4 border-double border-hairline pt-3"
        role="group"
        aria-label="Order total"
      >
        <span className="text-base font-semibold text-ink">Total</span>
        <span className="font-sans text-[clamp(2rem,5vw,2.5rem)] font-bold leading-none tracking-tight text-ink tabular-nums">
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
  cartLineCount,
  onClear,
  showClear,
}: {
  cartLineCount: number;
  onClear?: () => void;
  showClear: boolean;
}) {
  const itemLabel = `${cartLineCount} item${cartLineCount === 1 ? '' : 's'}`;
  return (
    <div className="shrink-0 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <ShoppingCart className="h-5 w-5" aria-hidden />
            Cart
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {cartLineCount > 0 ? (
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
  onPriceChange,
  onPriceCommit,
  onQtyStep,
  onEditQuantity,
  onRemove,
}: {
  item: CartItem;
  unitPrice: number;
  editingPrice: string | undefined;
  onPriceChange: (productId: string, value: string) => void;
  onPriceCommit: (productId: string) => void;
  onQtyStep: (productId: string, nextQty: number) => void;
  onEditQuantity: (productId: string) => void;
  onRemove: (productId: string) => void;
}) {
  const lineTotal = unitPrice * item.quantity;
  const productId = item.product.id;
  const [priceExpanded, setPriceExpanded] = useState(false);

  return (
    <div className="min-h-[6.25rem] border-b border-dotted border-hairline py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <p
          className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-ink"
          title={item.product.name}
        >
          {item.product.name}
        </p>
        <span className="shrink-0 font-mono text-sm font-semibold text-ink num">
          {formatKES(lineTotal)}
        </span>
      </div>
      {!priceExpanded ? (
        <button
          type="button"
          onClick={() => setPriceExpanded(true)}
          className="focus-ring mt-0.5 flex min-h-[var(--tap-min)] items-center rounded-[var(--radius)] font-mono text-xs text-ink-2 num active:scale-[0.99]"
        >
          {formatQty(item.quantity, item.product.unit)} × {formatKES(unitPrice)}
        </button>
      ) : (
        <div className="relative mt-0.5 max-w-[9rem]">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-2">
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
            className="h-[var(--tap-min)] min-h-[var(--tap-min)] w-full rounded-[var(--radius)] border border-hairline bg-paper pl-7 pr-2 font-mono text-sm text-ink num focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Unit price for ${item.product.name}`}
          />
        </div>
      )}
      <div className="mt-1 flex items-center gap-2">
        <CartQtyControl
          productId={productId}
          quantity={item.quantity}
          unit={item.product.unit}
          onStep={onQtyStep}
          onEditQuantity={onEditQuantity}
        />
        <div className="min-w-0 flex-1" aria-hidden />
        <button
          type="button"
          aria-label={`Remove ${item.product.name}`}
          onClick={() => onRemove(productId)}
          className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] shrink-0 items-center justify-center rounded-[var(--radius)] border border-hairline bg-paper text-fail active:scale-95"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Scrollable receipt lines inside torn paper; totals render outside via CartPinnedTotalsSection. */
function CartReceiptPaper({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'receipt-paper-block receipt-torn-bottom flex min-h-40 min-w-0 flex-1 flex-col overflow-hidden',
        className,
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1">
        {children}
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
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-hairline bg-paper p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      {disabledHint && (
        <p className="mb-2 text-center text-xs text-ink-2">{disabledHint}</p>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(
          'focus-ring flex min-h-[var(--tap-primary)] w-full items-center justify-center rounded-[var(--radius)] text-base font-bold active:scale-[0.98]',
          disabled
            ? 'cursor-not-allowed border border-hairline bg-[hsl(var(--hairline))] text-ink-2'
            : 'bg-primary text-primary-foreground',
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : saleType === 'credit' ? (
          <>
            <FileText className="mr-2 h-4 w-4" aria-hidden />
            Create Invoice — {formatKES(total)}
          </>
        ) : (
          `Complete Sale — ${formatKES(total)}`
        )}
      </button>
      {lastOrder && onReprint && (
        <Button variant="outline" className="mt-2 w-full gap-2" size="sm" onClick={onReprint}>
          <Printer className="h-4 w-4" />
          Reprint #{lastOrder.invoice_number || lastOrder.order_number}
        </Button>
      )}
    </div>
  );
}

const LIST_PRICE_COL = 'w-[6.25rem]';
const LIST_STEPPER_COL = 'w-[8.75rem]';

function ProductListStepperSlot({
  product,
  inCart,
  isOutOfStock,
  onStep,
  onEditQuantity,
  onAdd,
}: {
  product: Product;
  inCart: number;
  isOutOfStock: boolean;
  onStep: (productId: string, nextQty: number) => void;
  onEditQuantity: (productId: string) => void;
  onAdd: () => void;
}) {
  if (inCart > 0) {
    return (
      <div className={cn('flex shrink-0 justify-end', LIST_STEPPER_COL)}>
        <ProductListQtyStepper
          productId={product.id}
          quantity={inCart}
          unit={product.unit}
          onStep={onStep}
          onEditQuantity={onEditQuantity}
        />
      </div>
    );
  }

  return (
    <div
      className={cn('flex shrink-0 items-center justify-end gap-0.5', LIST_STEPPER_COL)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] shrink-0" aria-hidden />
      <button
        type="button"
        aria-label={`Add ${product.name}`}
        aria-disabled={isOutOfStock}
        disabled={isOutOfStock}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className={cn(
          'focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] shrink-0 items-center justify-center rounded-[var(--radius)] border border-hairline bg-paper text-ink active:scale-95',
          isOutOfStock && 'cursor-not-allowed opacity-100',
        )}
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
      <span className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] shrink-0" aria-hidden />
    </div>
  );
}

function ProductListQtyStepper({
  productId,
  quantity,
  unit,
  onStep,
  onEditQuantity,
}: {
  productId: string;
  quantity: number;
  unit: string;
  onStep: (productId: string, nextQty: number) => void;
  onEditQuantity: (productId: string) => void;
}) {
  const qtyLabel = formatQty(quantity, unit);
  return (
    <div
      className="flex shrink-0 items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onStep(productId, quantity - 1)}
        className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-paper text-ink active:scale-95"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        data-testid={`list-qty-edit-${productId}`}
        aria-label={`Quantity ${qtyLabel}, tap to edit`}
        onClick={() => onEditQuantity(productId)}
        className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-paper px-1.5 font-mono text-sm font-semibold text-ink num active:scale-95"
      >
        {formatQtyAmount(quantity)}
      </button>
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
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search or scan');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => {
      setSearchPlaceholder(
        mq.matches ? 'Search name, SKU or barcode' : 'Search or scan',
      );
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!mobileCartOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        setMobileCartOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileCartOpen, isProcessing]);

  useEffect(() => {
    if (mobileCartOpen) {
      setShowCustomerPicker(false);
      setCustomerSearchQuery('');
    }
  }, [mobileCartOpen]);

  useEffect(() => {
    console.debug('[RetailPOS products cache]', {
      cache: debugOfflineCacheKey,
      source: debugLastDataSource,
    });
  }, [debugOfflineCacheKey, debugLastDataSource]);
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

  const categoryChipsVisible = useMemo(
    () => showPosCategoryChips(posCategoryChips),
    [posCategoryChips],
  );

  const quickKeyProducts = useMemo(() => {
    const seen = new Set<string>();
    const orderedIds: string[] = [];
    for (const id of favoriteProductIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      orderedIds.push(id);
      if (orderedIds.length >= 8) break;
    }
    if (orderedIds.length < 8) {
      for (const id of recentProductIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        orderedIds.push(id);
        if (orderedIds.length >= 8) break;
      }
    }
    const byId = new Map(sellableRetailProducts.map((p) => [p.id, p]));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p));
  }, [favoriteProductIds, recentProductIds, sellableRetailProducts]);

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
        const q = Number(line.quantity);
        if (!Number.isFinite(q) || q <= 0) continue;
        const qtyRaw = isDecimalUnit(p.unit)
          ? Math.round(q * 1000) / 1000
          : Math.floor(q);
        if (qtyRaw <= 0) continue;
        const qty = Math.min(qtyRaw, Math.max(stock, 0));
        if (qty <= 0) continue;
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

  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});

  type QtyKeypadSession = {
    product: Product;
    mode: QuantityKeypadMode;
  } | null;
  const [qtyKeypadSession, setQtyKeypadSession] = useState<QtyKeypadSession>(null);
  const [qtyKeypadInput, setQtyKeypadInput] = useState('');
  const qtyKeypadReturnFocusRef = useRef<HTMLElement | null>(null);
  const productRowFocusRefs = useRef<Map<string, HTMLElement>>(new Map());

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
      } hidden — turn on Out of stock to view them.`;
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

  /** Set line quantity with the same positive-qty rules as commit / keypad confirm. */
  const setCartLineQuantity = (product: Product, quantity: number) => {
    const unit = product.unit;
    const normalized = isDecimalUnit(unit)
      ? Math.round(quantity * 1000) / 1000
      : Math.floor(quantity);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      updateCartQuantity(product.id, 0);
      return;
    }
    updateCartQuantity(product.id, normalized);
  };

  const openQtyKeypadForProduct = (
    product: Product,
    mode: QuantityKeypadMode,
    returnFocus?: HTMLElement | null,
  ) => {
    qtyKeypadReturnFocusRef.current = returnFocus ?? null;
    const existing = cart.find((c) => c.product.id === product.id);
    const initialQty =
      mode === 'edit' && existing
        ? existing.quantity
        : mode === 'add' && existing
          ? existing.quantity
          : null;
    setQtyKeypadInput(
      initialQty !== null && initialQty > 0 ? formatQtyAmount(initialQty) : '',
    );
    setQtyKeypadSession({ product, mode });
  };

  const closeQtyKeypad = () => {
    setQtyKeypadSession(null);
    setQtyKeypadInput('');
  };

  const confirmQtyKeypad = (quantity: number) => {
    if (!qtyKeypadSession) return;
    const { product, mode } = qtyKeypadSession;
    const parsed = parseCommittedCartQuantity(String(quantity), product.unit);
    if (parsed === null) return;

    if (mode === 'add') {
      if (product.stock <= 0) {
        toast.error(`${product.name} is out of stock`);
        return;
      }
      pushRecentProduct(product.id);
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id ? { ...item, quantity: parsed } : item,
          );
        }
        return [...prev, { product, quantity: parsed }];
      });
    } else {
      setCartLineQuantity(product, parsed);
    }
    closeQtyKeypad();
    requestAnimationFrame(() => qtyKeypadReturnFocusRef.current?.focus());
  };

  const handleProductRowActivate = (product: Product, rowEl?: HTMLElement | null) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    if (isDecimalUnit(product.unit)) {
      openQtyKeypadForProduct(product, 'add', rowEl ?? null);
      return;
    }
    addToCart(product);
  };

  const openQtyKeypadFromCartLine = (productId: string) => {
    const item = cart.find((c) => c.product.id === productId);
    if (!item) return;
    openQtyKeypadForProduct(item.product, 'edit', null);
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
  const cartLineCount = cart.length;

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
            {/* Search + scan + view mode */}
            <div className="flex gap-2 p-2 pb-2 sm:gap-3 sm:p-3 lg:p-4 lg:pb-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden />
                <Input
                  placeholder={searchPlaceholder}
                  aria-label="Search name, SKU or barcode"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[var(--tap-min)] border-hairline bg-surface pl-10 text-base"
                />
              </div>
              {/*
                STUB: Camera barcode scan affordance only — no scanner SDK wired yet.
                TODO: Wire to a camera barcode scanner (e.g. BarcodeDetector / html5-qrcode) and set searchQuery / add-to-cart on hit.
              */}
              <button
                type="button"
                aria-label="Scan barcode"
                onClick={() => {
                  // TODO: Implement camera-based barcode scanning
                  console.log('[RetailPOS] Barcode scan button tapped — scanner not implemented yet');
                }}
                className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] shrink-0 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface text-ink active:scale-95"
              >
                <ScanBarcode className="h-5 w-5" />
              </button>
              <div
                className="flex h-[var(--tap-min)] shrink-0 items-stretch overflow-hidden rounded-[var(--radius)] border border-hairline bg-surface p-0.5"
                role="group"
                aria-label="Product density"
              >
                <button
                  type="button"
                  onClick={() => {
                    setProductViewMode('card');
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(PRODUCT_VIEW_STORAGE_KEY, 'card');
                    }
                  }}
                  className={cn(
                    'focus-ring flex min-h-[var(--tap-min)] items-center justify-center gap-1 rounded-[calc(var(--radius)-2px)] px-2 text-xs font-semibold active:scale-95 sm:min-w-[var(--tap-min)]',
                    productViewMode === 'card'
                      ? 'border-2 border-primary bg-[hsl(var(--accent-soft))] text-ink'
                      : 'border border-transparent text-ink-2',
                  )}
                  aria-pressed={productViewMode === 'card'}
                  title="Large tiles"
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Large tiles</span>
                  <span className="sr-only sm:hidden">Large tiles</span>
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
                    'focus-ring flex min-h-[var(--tap-min)] items-center justify-center gap-1 rounded-[calc(var(--radius)-2px)] px-2 text-xs font-semibold active:scale-95 sm:min-w-[var(--tap-min)]',
                    productViewMode === 'list'
                      ? 'border-2 border-primary bg-[hsl(var(--accent-soft))] text-ink'
                      : 'border border-transparent text-ink-2',
                  )}
                  aria-pressed={productViewMode === 'list'}
                  title="Compact list"
                >
                  <List className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Compact list</span>
                  <span className="sr-only sm:hidden">Compact list</span>
                </button>
              </div>
            </div>

            {/* Browse: All / Recent / Favorites / categories + OOS */}
            <div className="flex flex-nowrap snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-2 sm:px-3 lg:px-4 scrollbar-hide">
              {(
                [
                  { key: 'all', label: 'All', icon: Layers },
                  { key: 'recent', label: 'Recent', icon: Clock },
                  { key: 'favorites', label: 'Favorites', icon: Star },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveBrowseKey(key)}
                  aria-pressed={activeBrowseKey === key}
                  className={cn(
                    'focus-ring flex min-h-[var(--tap-min)] shrink-0 snap-start items-center gap-1.5 rounded-[var(--radius)] border px-3 text-sm font-semibold active:scale-[0.98]',
                    activeBrowseKey === key
                      ? 'border-primary bg-[hsl(var(--accent-soft))] text-ink'
                      : 'border-hairline bg-surface text-ink-2',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </button>
              ))}
              {categoryChipsVisible &&
                posCategoryChips.map((chip) => (
                  <button
                    key={chip.slug}
                    type="button"
                    onClick={() => setActiveBrowseKey(chip.slug)}
                    aria-pressed={activeBrowseKey === chip.slug}
                    className={cn(
                      'focus-ring flex min-h-[var(--tap-min)] shrink-0 snap-start items-center gap-1.5 rounded-[var(--radius)] border px-3 text-sm font-semibold active:scale-[0.98]',
                      activeBrowseKey === chip.slug
                        ? 'border-primary bg-[hsl(var(--accent-soft))] text-ink'
                        : 'border-hairline bg-surface text-ink-2',
                    )}
                  >
                    <Package className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{chip.name}</span>
                    <span className="font-mono text-xs text-ink-2 num">({chip.count})</span>
                  </button>
                ))}
              <button
                type="button"
                onClick={toggleShowOutOfStock}
                aria-pressed={showOutOfStock}
                className={cn(
                  'focus-ring flex min-h-[var(--tap-min)] shrink-0 snap-start items-center gap-1.5 rounded-[var(--radius)] border px-3 text-sm font-semibold active:scale-[0.98]',
                  showOutOfStock
                    ? 'border-primary bg-[hsl(var(--accent-soft))] text-ink'
                    : 'border-hairline bg-surface text-ink-2',
                )}
                title={
                  showOutOfStock
                    ? 'Hide out-of-stock products'
                    : `Include out-of-stock products (${hiddenOutOfStockCount})`
                }
              >
                <Package className="h-4 w-4 shrink-0" aria-hidden />
                Out of stock
              </button>
            </div>

            {quickKeyProducts.length > 0 && (
              <div className="shrink-0 border-b border-hairline px-2 pb-2 pt-0 sm:px-3 lg:px-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                  Quick keys
                </p>
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {quickKeyProducts.map((product) => {
                    const cartItem = cart.find((c) => c.product.id === product.id);
                    const inCart = cartItem ? cartItem.quantity : 0;
                    const showsImage = hasProductImage(product);
                    const { initial, blockClass } = getCategoryPlaceholderMeta(
                      product,
                      retailCategories,
                    );
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductRowActivate(product, null)}
                        className={cn(
                          'focus-ring relative flex min-h-[6rem] w-[7.5rem] shrink-0 snap-start flex-col rounded-[var(--radius)] border border-hairline bg-surface p-2 text-left active:scale-[0.98]',
                          inCart > 0 && 'border-2 border-primary',
                        )}
                      >
                        {inCart > 0 && (
                          <span
                            className="absolute right-1.5 top-1.5 z-10 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1 font-sans text-xs font-semibold text-paper num"
                            aria-hidden
                          >
                            {formatQtyAmount(inCart)}
                          </span>
                        )}
                        {showsImage ? (
                          <div className="mb-1.5 aspect-square w-full overflow-hidden rounded-[calc(var(--radius)-2px)]">
                            <img
                              src={product.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'mb-1.5 flex aspect-square w-full items-center justify-center rounded-[calc(var(--radius)-2px)] text-lg font-bold',
                              blockClass,
                            )}
                            aria-hidden
                          >
                            {initial}
                          </div>
                        )}
                        <p
                          className="line-clamp-2 min-w-0 flex-1 pr-7 text-base font-semibold leading-snug text-ink"
                          title={product.name}
                        >
                          {product.name}
                        </p>
                        <span className="mt-1 truncate font-mono text-xs font-semibold text-ink num">
                          {formatPricePerUnit(product.price, product.unit)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Product Grid */}
            <div
              className={cn(
                'flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4',
                // Clear sticky mini-cart + action bar on mobile while shopping
                cartLineCount > 0 &&
                  'pb-[calc(3.5rem+4rem+env(safe-area-inset-bottom,0px))] lg:pb-4',
              )}
            >
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
                <div className="grid auto-rows-min content-start gap-2 sm:gap-3 [grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))]">
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find((c) => c.product.id === product.id);
                    const inCart = cartItem ? cartItem.quantity : 0;
                    const stockChipStatus = getStockStatus(product);
                    const showsImage = hasProductImage(product);
                    const isFavorite = favoriteProductIds.includes(product.id);
                    const { initial, blockClass } = getCategoryPlaceholderMeta(
                      product,
                      retailCategories,
                    );

                    return (
                      <div
                        key={product.id}
                        ref={(el) => {
                          if (el) productRowFocusRefs.current.set(product.id, el);
                          else productRowFocusRefs.current.delete(product.id);
                        }}
                        role="button"
                        tabIndex={0}
                        data-testid={`product-row-${product.id}`}
                        onClick={() =>
                          handleProductRowActivate(
                            product,
                            productRowFocusRefs.current.get(product.id),
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleProductRowActivate(
                              product,
                              productRowFocusRefs.current.get(product.id),
                            );
                          }
                        }}
                        className={cn(
                          'focus-ring relative flex min-h-[6rem] cursor-pointer flex-col rounded-[var(--radius)] border border-hairline bg-surface p-2 text-left active:scale-[0.98]',
                          inCart > 0 && 'border-2 border-primary',
                        )}
                      >
                        <div className="relative z-10 mb-1 flex min-h-[var(--tap-min)] items-start justify-between gap-1">
                          <button
                            type="button"
                            aria-label={
                              isFavorite ? 'Remove from favorites' : 'Add to favorites'
                            }
                            aria-pressed={isFavorite}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(product.id);
                            }}
                            className="focus-ring -ml-1 -mt-1 flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] shrink-0 items-center justify-center rounded-[var(--radius)] active:scale-95"
                          >
                            <Star
                              className={cn(
                                'h-5 w-5',
                                isFavorite ? 'fill-ink text-ink' : 'text-ink-2',
                              )}
                            />
                          </button>
                          {inCart > 0 ? (
                            <span
                              className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-ink px-1.5 font-sans text-xs font-semibold text-paper num"
                              aria-hidden
                            >
                              {formatQtyAmount(inCart)}
                            </span>
                          ) : (
                            <span className="min-h-6 min-w-6 shrink-0" aria-hidden />
                          )}
                        </div>
                        {showsImage ? (
                          <div className="relative mb-2 aspect-square overflow-hidden rounded-[calc(var(--radius)-2px)]">
                            <img
                              src={product.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'mb-2 flex aspect-square w-full max-h-20 items-center justify-center rounded-[calc(var(--radius)-2px)] text-2xl font-bold',
                              blockClass,
                            )}
                            aria-hidden
                          >
                            {initial}
                          </div>
                        )}
                        <p
                          className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-ink"
                          title={product.name}
                        >
                          {product.name}
                        </p>
                        {stockChipStatus && (
                          <div className="mt-1">
                            <PosProductStockHint status={stockChipStatus} />
                          </div>
                        )}
                        <div className="mt-auto pt-2">
                          <span className="font-mono text-sm font-semibold text-ink num">
                            {formatPricePerUnit(product.price, product.unit)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y divide-hairline border-y border-hairline">
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find((c) => c.product.id === product.id);
                    const inCart = cartItem ? cartItem.quantity : 0;
                    const isOutOfStock = product.stock <= 0;
                    const stockChipStatus = getStockStatus(product);
                    const showsImage = hasProductImage(product);
                    const isFavorite = favoriteProductIds.includes(product.id);
                    const { initial, blockClass } = getCategoryPlaceholderMeta(
                      product,
                      retailCategories,
                    );

                    const handleListQtyStep = (productId: string, nextQty: number) => {
                      updateCartQuantity(productId, nextQty);
                    };

                    return (
                      <div
                        key={product.id}
                        ref={(el) => {
                          if (el) productRowFocusRefs.current.set(product.id, el);
                          else productRowFocusRefs.current.delete(product.id);
                        }}
                        role="button"
                        tabIndex={0}
                        data-testid={`product-row-${product.id}`}
                        onClick={() =>
                          handleProductRowActivate(
                            product,
                            productRowFocusRefs.current.get(product.id),
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleProductRowActivate(
                              product,
                              productRowFocusRefs.current.get(product.id),
                            );
                          }
                        }}
                        className="focus-ring grid min-h-[var(--tap-min)] cursor-pointer grid-cols-[minmax(0,1fr)_6.25rem_8.75rem_var(--tap-min)] items-center gap-x-2 border-b border-hairline py-2 pl-0 pr-0 active:bg-[hsl(var(--accent-soft))]/40"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {showsImage ? (
                            <img
                              src={product.image}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-[calc(var(--radius)-2px)] object-cover"
                            />
                          ) : (
                            <div
                              className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] text-sm font-bold',
                                blockClass,
                              )}
                              aria-hidden
                            >
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p
                              className="line-clamp-2 text-sm font-semibold leading-snug text-ink"
                              title={product.name}
                            >
                              {product.name}
                            </p>
                            {stockChipStatus && (
                              <div className="mt-0.5">
                                <PosProductStockHint status={stockChipStatus} />
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 truncate text-right font-mono text-xs font-semibold text-ink num sm:text-sm',
                            LIST_PRICE_COL,
                          )}
                        >
                          {formatPricePerUnit(product.price, product.unit)}
                        </span>
                        <ProductListStepperSlot
                          product={product}
                          inCart={inCart}
                          isOutOfStock={isOutOfStock}
                          onStep={handleListQtyStep}
                          onEditQuantity={(id) => {
                            openQtyKeypadForProduct(
                              product,
                              'edit',
                              productRowFocusRefs.current.get(id),
                            );
                          }}
                          onAdd={() =>
                            handleProductRowActivate(
                              product,
                              productRowFocusRefs.current.get(product.id),
                            )
                          }
                        />
                        <button
                          type="button"
                          aria-label={
                            isFavorite ? 'Remove from favorites' : 'Add to favorites'
                          }
                          aria-pressed={isFavorite}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(product.id);
                          }}
                          className="focus-ring flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] shrink-0 items-center justify-center justify-self-end rounded-[var(--radius)] border border-hairline bg-paper active:scale-95"
                        >
                          <Star
                            className={cn(
                              'h-4 w-4',
                              isFavorite ? 'fill-ink text-ink' : 'text-ink-2',
                            )}
                          />
                        </button>
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
          {cartLineCount > 0 && !mobileCartOpen && (
            <button
              type="button"
              onClick={() => setMobileCartOpen(true)}
              aria-label={`Open cart, ${cartLineCount} items, total ${formatKES(total)}`}
              className="focus-ring lg:hidden fixed inset-x-0 z-50 flex h-14 min-h-14 items-center justify-between gap-3 border-t border-hairline bg-surface px-4 pb-[env(safe-area-inset-bottom,0px)] active:scale-[0.99]"
              style={{ bottom: '4rem' }}
            >
              <div className="text-left">
                <p className="font-sans text-lg font-bold tabular-nums text-ink">
                  {formatKES(total)}
                </p>
                <p className="text-sm text-ink-2">
                  {cartLineCount} item{cartLineCount === 1 ? '' : 's'}
                </p>
              </div>
              <span className="pointer-events-none flex min-h-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-bold text-primary-foreground">
                Checkout
              </span>
            </button>
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
              <div className="relative mt-auto flex max-h-[90vh] min-h-0 flex-col bg-paper shadow-float motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200">
                <div className="flex h-14 min-h-14 shrink-0 items-center gap-1 border-b border-hairline px-2">
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
                    <h2 className="flex items-center gap-2 truncate text-base font-bold text-ink">
                      <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
                      Cart
                    </h2>
                    <p className="truncate text-xs text-ink-2">
                      {cartLineCount > 0
                        ? `${cartLineCount} item${cartLineCount === 1 ? '' : 's'} · ${formatDate(new Date())}`
                        : formatDate(new Date())}
                    </p>
                  </div>
                  {cart.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                      className="shrink-0 text-xs text-fail hover:text-fail"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <div className="shrink-0 space-y-2 border-b border-hairline px-3 py-2">
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
                          className="focus-ring flex min-h-[var(--tap-min)] w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98]"
                        >
                          <UserPlus className="h-4 w-4" aria-hidden />
                          Select Customer
                        </button>
                      )}
                    </>
                  )}
                  {showCustomerPicker && (
                    <div className="max-h-48 overflow-hidden rounded-[var(--radius)] border border-hairline bg-surface">
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
                  {saleType === 'cash' && !showCustomerPicker && (
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

                <div className="flex min-h-0 flex-1 flex-col px-3 pt-2">
                  {cart.length > 0 && (
                    <>
                      <CartReceiptPaper className="mt-0">
                        {cart.map((item) => {
                          const unitPrice = getUnitPrice(item);
                          return (
                            <CartReceiptLine
                              key={item.product.id}
                              item={item}
                              unitPrice={unitPrice}
                              editingPrice={editingPrice[item.product.id]}
                              onPriceChange={(id, value) =>
                                setEditingPrice((prev) => ({ ...prev, [id]: value }))
                              }
                              onPriceCommit={commitPrice}
                              onQtyStep={(id, next) => updateCartQuantity(id, next)}
                              onEditQuantity={openQtyKeypadFromCartLine}
                              onRemove={removeFromCart}
                            />
                          );
                        })}
                      </CartReceiptPaper>
                      <div className="shrink-0 py-2">
                        <CartTotalsSection
                          subtotal={subtotal}
                          discountMode={discountMode}
                          onDiscountModeChange={setDiscountMode}
                          discountInput={discountInput}
                          onDiscountInputChange={setDiscountInput}
                          discountAmount={discountAmount}
                          total={total}
                        />
                      </div>
                      {saleType === 'credit' && (
                        <div className="max-h-28 shrink-0 overflow-y-auto pb-1">
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
                        </div>
                      )}
                    </>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="shrink-0 bg-paper">
                    {saleType === 'cash' && (
                      <div className="border-t border-hairline px-3 pt-2">
                        <CartPaymentMethodSection
                          compact
                          method={cashPaymentMethod}
                          onMethodChange={setCashPaymentMethod}
                          reference={cashPaymentReference}
                          onReferenceChange={setCashPaymentReference}
                        />
                      </div>
                    )}
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
                )}
              </div>
            </div>
          )}

          {/* ── Desktop Cart Sidebar (hidden on mobile) ── */}
          <div className="hidden h-full w-[380px] min-w-[360px] max-w-[380px] shrink-0 flex-col border-l border-hairline bg-paper lg:flex">
            <div className="shrink-0 border-b border-hairline">
              <CartReceiptHeader
                cartLineCount={cartLineCount}
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
              {saleType === 'credit' && !showCustomerPicker && (
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
                      className="focus-ring flex min-h-[var(--tap-min)] w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98]"
                    >
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Select Customer
                    </button>
                  )}
                </div>
              )}

              {/* Customer picker dropdown */}
              {showCustomerPicker && (
                <div className="mt-2 max-h-48 overflow-hidden rounded-[var(--radius)] border border-hairline bg-surface">
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
              {saleType === 'cash' && !showCustomerPicker && (
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

            <div className="flex min-h-0 flex-1 flex-col pb-2">
              {cart.length === 0 && (
                <div className="px-4 py-12 text-center text-ink-2">
                  <ShoppingCart className="mx-auto mb-3 h-10 w-10 opacity-50" aria-hidden />
                  <p className="text-sm">Cart is empty</p>
                  <p className="mt-1 text-xs">Tap a product or scan barcode</p>
                </div>
              )}

              {cart.length > 0 && (
                <>
                  <CartReceiptPaper className="mx-4 mt-2">
                    {cart.map((item) => {
                      const unitPrice = getUnitPrice(item);
                      return (
                        <CartReceiptLine
                          key={item.product.id}
                          item={item}
                          unitPrice={unitPrice}
                          editingPrice={editingPrice[item.product.id]}
                          onPriceChange={(id, value) =>
                            setEditingPrice((prev) => ({ ...prev, [id]: value }))
                          }
                          onPriceCommit={commitPrice}
                          onQtyStep={(id, next) => updateCartQuantity(id, next)}
                          onEditQuantity={openQtyKeypadFromCartLine}
                          onRemove={removeFromCart}
                        />
                      );
                    })}
                  </CartReceiptPaper>
                  <div className="shrink-0 px-4 py-2">
                    <CartTotalsSection
                      subtotal={subtotal}
                      discountMode={discountMode}
                      onDiscountModeChange={setDiscountMode}
                      discountInput={discountInput}
                      onDiscountInputChange={setDiscountInput}
                      discountAmount={discountAmount}
                      total={total}
                    />
                  </div>

                  {saleType === 'credit' && (
                    <div className="max-h-40 shrink-0 overflow-y-auto px-4 pb-2 pt-1">
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
                    </div>
                  )}
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="shrink-0 bg-paper">
                {saleType === 'cash' && (
                  <div className="border-t border-hairline px-4 pt-3">
                    <CartPaymentMethodSection
                      method={cashPaymentMethod}
                      onMethodChange={setCashPaymentMethod}
                      reference={cashPaymentReference}
                      onReferenceChange={setCashPaymentReference}
                    />
                  </div>
                )}
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
              </div>
            )}
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

      {qtyKeypadSession && (
        <QuantityKeypad
          open
          onOpenChange={(open) => {
            if (!open) closeQtyKeypad();
          }}
          product={qtyKeypadSession.product}
          mode={qtyKeypadSession.mode}
          unitPrice={
            cart.find((c) => c.product.id === qtyKeypadSession.product.id)
              ? getUnitPrice(
                  cart.find((c) => c.product.id === qtyKeypadSession.product.id)!,
                )
              : qtyKeypadSession.product.price
          }
          inputValue={qtyKeypadInput}
          onInputChange={setQtyKeypadInput}
          onConfirm={confirmQtyKeypad}
          onRemove={
            qtyKeypadSession.mode === 'edit'
              ? () => {
                  removeFromCart(qtyKeypadSession.product.id);
                  closeQtyKeypad();
                }
              : undefined
          }
          returnFocusRef={qtyKeypadReturnFocusRef}
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
