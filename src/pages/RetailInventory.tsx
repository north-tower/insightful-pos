import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Package,
  XCircle,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Minus,
  Plus,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/pos/PageLayout';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/hooks/useProducts';
import { useStockAdjustments, type StockAdjustmentRow } from '@/hooks/useStockAdjustments';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { fc } from '@/lib/currency';
import { generatePlaceholderUrl } from '@/lib/product-images';

interface RetailInventoryProps {
  onNavigate: (tab: string) => void;
}

type StockFilter = 'all' | 'in-stock' | 'out' | 'low-stock';
type SortField = 'name' | 'sku' | 'stock';
type SortDir = 'asc' | 'desc';

const BANNER_DISMISS_KEY = 'inventory-oos-banner-dismissed';

const adjustmentTypeStyles: Record<
  StockAdjustmentRow['type'],
  { label: string; color: string; icon: typeof TrendingUp }
> = {
  restock: { label: 'Restocked', color: 'text-success', icon: PackagePlus },
  damaged: { label: 'Damaged', color: 'text-destructive', icon: PackageMinus },
  returned: { label: 'Returned', color: 'text-info', icon: RotateCcw },
  sold: { label: 'Sold', color: 'text-muted-foreground', icon: TrendingDown },
  adjustment: {
    label: 'Adjusted',
    color: 'text-warning',
    icon: ClipboardList,
  },
  production_in: { label: 'Produced', color: 'text-success', icon: PackagePlus },
  production_out: { label: 'Production use', color: 'text-warning', icon: PackageMinus },
  staff_assign_out: { label: 'Staff assign out', color: 'text-warning', icon: PackageMinus },
  staff_assign_return: { label: 'Staff assign return', color: 'text-info', icon: RotateCcw },
};

interface AdjustmentGroup {
  key: string;
  product_id: string;
  product_name: string;
  type: StockAdjustmentRow['type'];
  items: StockAdjustmentRow[];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLowStock(product: Product, stock: number) {
  if (stock <= 0) return false;
  const threshold = product.lowStockThreshold ?? 10;
  const tenPercent = Math.max(1, Math.floor(threshold * 0.1));
  return stock < 5 || stock <= tenPercent || stock <= threshold;
}

function getStockStatusLabel(stock: number, product: Product) {
  if (stock <= 0) return 'Out of stock';
  if (isLowStock(product, stock)) return 'Low stock';
  return 'In stock';
}

function groupConsecutiveAdjustments(rows: StockAdjustmentRow[]): AdjustmentGroup[] {
  const groups: AdjustmentGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.product_id === row.product_id && last.type === row.type) {
      last.items.push(row);
    } else {
      groups.push({
        key: `${row.id}-${row.product_id}-${row.type}`,
        product_id: row.product_id,
        product_name: row.product_name || 'Unknown Product',
        type: row.type,
        items: [row],
      });
    }
  }
  return groups;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-warning/30 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function exportInventoryCsv(products: Product[], getMainStock: (p: Product) => number) {
  const header = ['Product name', 'SKU', 'Stock quantity', 'Unit', 'Stock status'];
  const rows = products.map((p) => {
    const stock = getMainStock(p);
    return [
      p.name,
      p.sku || '',
      String(stock),
      p.unit,
      getStockStatusLabel(stock, p),
    ];
  });
  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventory-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function RetailInventory({ onNavigate }: RetailInventoryProps) {
  const { retailProducts, loading, refetch: refetchProducts } = useProducts();
  const {
    adjustments,
    loading: adjustmentsLoading,
    adjustStock,
  } = useStockAdjustments(30);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('out');
  const [sortField, setSortField] = useState<SortField>('stock');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [bulkAdjustProducts, setBulkAdjustProducts] = useState<Product[]>([]);
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem(BANNER_DISMISS_KEY) === '1',
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [reversingId, setReversingId] = useState<string | null>(null);

  const getMainStock = useCallback(
    (product: Product) => product.mainStock ?? product.stock,
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const stockSummary = useMemo(() => {
    const totalProducts = retailProducts.length;
    const totalUnits = retailProducts.reduce((sum, p) => sum + getMainStock(p), 0);
    const totalValue = retailProducts.reduce(
      (sum, p) => sum + p.price * getMainStock(p),
      0,
    );
    const inStock = retailProducts.filter((p) => getMainStock(p) > 0);
    const outOfStock = retailProducts.filter((p) => getMainStock(p) <= 0);
    const lowStock = retailProducts.filter((p) =>
      isLowStock(p, getMainStock(p)),
    );

    return { totalProducts, totalUnits, totalValue, inStock, outOfStock, lowStock };
  }, [retailProducts, getMainStock]);

  const recentlyDroppedToZero = useMemo(() => {
    const ids = new Set<string>();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const adj of adjustments) {
      if (
        adj.new_stock === 0 &&
        adj.previous_stock > 0 &&
        new Date(adj.created_at).getTime() > cutoff
      ) {
        ids.add(adj.product_id);
      }
    }
    return ids;
  }, [adjustments]);

  const hideSkuColumn = useMemo(() => {
    if (retailProducts.length === 0) return false;
    const emptyCount = retailProducts.filter((p) => !p.sku?.trim()).length;
    return emptyCount / retailProducts.length > 0.8;
  }, [retailProducts]);

  const filteredProducts = useMemo(() => {
    let products = [...retailProducts];

    switch (stockFilter) {
      case 'in-stock':
        products = products.filter((p) => getMainStock(p) > 0);
        break;
      case 'out':
        products = products.filter((p) => getMainStock(p) <= 0);
        break;
      case 'low-stock':
        products = products.filter((p) => isLowStock(p, getMainStock(p)));
        break;
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q),
      );
    }

    products.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'sku':
          return (a.sku || '').localeCompare(b.sku || '') * dir;
        case 'stock':
          return (getMainStock(a) - getMainStock(b)) * dir;
        default:
          return 0;
      }
    });

    return products;
  }, [stockFilter, debouncedSearch, retailProducts, sortField, sortDir, getMainStock]);

  const adjustmentGroups = useMemo(
    () => groupConsecutiveAdjustments(adjustments),
    [adjustments],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, stockFilter, sortField, sortDir]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [stockFilter, debouncedSearch, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(
    () =>
      filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredProducts, currentPage, pageSize],
  );

  const allPageSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((p) => selectedIds.has(p.id));
  const somePageSelected =
    paginatedProducts.some((p) => selectedIds.has(p.id)) && !allPageSelected;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'stock' ? 'asc' : 'asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    sessionStorage.setItem(BANNER_DISMISS_KEY, '1');
  };

  const openAdjustDialog = (product: Product, bulk?: Product[]) => {
    setAdjustProduct(product);
    setBulkAdjustProducts(bulk || []);
    setAdjustType('add');
    setAdjustQty('');
    setAdjustNote('');
    setShowAdjustDialog(true);
  };

  const handleAdjustment = async () => {
    const targets =
      bulkAdjustProducts.length > 0
        ? bulkAdjustProducts
        : adjustProduct
          ? [adjustProduct]
          : [];
    if (targets.length === 0 || !adjustQty) return;

    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    setIsAdjusting(true);
    try {
      const effectiveQty = adjustType === 'add' ? qty : -qty;
      const type = adjustType === 'add' ? 'restock' : 'adjustment';

      for (const product of targets) {
        await adjustStock(product.id, type, effectiveQty, adjustNote || undefined);
      }

      await refetchProducts();

      const action = adjustType === 'add' ? 'added to' : 'removed from';
      if (targets.length === 1) {
        toast.success(`${qty} units ${action} ${targets[0].name}`);
      } else {
        toast.success(`${qty} units ${action} ${targets.length} products`);
      }
      setShowAdjustDialog(false);
      setBulkAdjustProducts([]);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Stock adjustment failed:', err);
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleReverseAdjustment = async (adj: StockAdjustmentRow) => {
    setReversingId(adj.id);
    try {
      await adjustStock(
        adj.product_id,
        'adjustment',
        -adj.quantity,
        `Reversed: ${adj.note || adjustmentTypeStyles[adj.type].label}`,
      );
      await refetchProducts();
      toast.success(`Reversed adjustment for ${adj.product_name}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse adjustment');
    } finally {
      setReversingId(null);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedProducts.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleMarkForPurchase = () => {
    const selected = retailProducts.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;
    toast.info(
      `${selected.length} product${selected.length > 1 ? 's' : ''} marked for purchase`,
      {
        description: selected.map((p) => p.name).slice(0, 3).join(', ') +
          (selected.length > 3 ? ` +${selected.length - 3} more` : ''),
      },
    );
    onNavigate('purchases');
  };

  const renderStockBadge = (product: Product, mainStock: number) => {
    if (mainStock <= 0) {
      const recentlyDropped = recentlyDroppedToZero.has(product.id);
      return (
        <Badge
          variant="outline"
          className={cn(
            'font-medium',
            recentlyDropped
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-muted-foreground/30 bg-muted text-muted-foreground',
          )}
        >
          {recentlyDropped ? 'Recently out' : 'Out of stock'}
        </Badge>
      );
    }
    if (isLowStock(product, mainStock)) {
      return (
        <Badge className="font-bold bg-warning/15 text-warning border-warning/30 hover:bg-warning/15">
          {mainStock} {product.unit}
        </Badge>
      );
    }
    return (
      <Badge className="font-bold bg-success/15 text-success border-success/30 hover:bg-success/15">
        {mainStock} {product.unit}
      </Badge>
    );
  };

  const ReverseButton = ({ adj }: { adj: StockAdjustmentRow }) => {
    const [open, setOpen] = useState(false);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={reversingId === adj.id}
          >
            {reversingId === adj.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="end">
          <p className="text-sm font-medium mb-3">Reverse this adjustment?</p>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await handleReverseAdjustment(adj);
                setOpen(false);
              }}
              disabled={reversingId === adj.id}
            >
              Confirm
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderAdjustmentEntry = (adj: StockAdjustmentRow, compact?: boolean) => {
    const style = adjustmentTypeStyles[adj.type];
    const Icon = style.icon;
    return (
      <div
        key={adj.id}
        className={cn(
          'group flex items-start gap-3',
          compact ? 'py-2' : 'pb-4 border-b border-border last:border-0 last:pb-0',
        )}
      >
        <div className={cn('p-2 rounded bg-muted shrink-0', style.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          {!compact && (
            <p className="text-sm font-semibold text-foreground truncate">
              {adj.product_name}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={cn('text-xs', style.color)}>
              {style.label}
            </Badge>
            <span
              className={cn(
                'text-xs font-mono font-bold',
                adj.quantity > 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {adj.quantity > 0 ? '+' : ''}
              {adj.quantity}
            </span>
            <span className="text-xs text-muted-foreground">
              ({adj.previous_stock} → {adj.new_stock})
            </span>
          </div>
          {adj.note && (
            <p className="text-xs text-muted-foreground mt-1">{adj.note}</p>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{adj.staff_name}</span>
            <span>•</span>
            <span>
              {formatDistanceToNow(new Date(adj.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        <ReverseButton adj={adj} />
      </div>
    );
  };

  const filterButtons: { id: StockFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'in-stock', label: 'In Stock' },
    { id: 'out', label: 'Out of Stock' },
    { id: 'low-stock', label: 'Low Stock' },
  ];

  const selectedProducts = retailProducts.filter((p) => selectedIds.has(p.id));

  return (
    <PageLayout activeTab="inventory" onNavigate={onNavigate}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Inventory
          </h1>
          <p className="text-muted-foreground">
            {stockSummary.totalProducts} products • {stockSummary.totalUnits} total
            units
          </p>
        </div>
      </div>

      {/* Out-of-stock alert banner */}
      {stockSummary.outOfStock.length > 0 && !bannerDismissed && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-warning-foreground">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {stockSummary.outOfStock.length} product
              {stockSummary.outOfStock.length !== 1 ? 's are' : ' is'} out of stock
              and need restocking.
            </p>
            <Button
              variant="link"
              className="h-auto p-0 text-sm text-warning font-semibold"
              onClick={() => setStockFilter('out')}
            >
              View out-of-stock items
            </Button>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={dismissBanner}
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Card
          className={cn(
            'cursor-pointer transition-all hover:shadow-sm',
            stockFilter === 'all' && 'ring-2 ring-primary bg-primary/5 shadow-sm',
          )}
          onClick={() => setStockFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Products</p>
                <p className="text-2xl font-bold">{stockSummary.totalProducts}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fc(stockSummary.totalValue)} value
                </p>
              </div>
              <Package className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-all hover:shadow-sm',
            stockFilter === 'in-stock' && 'ring-2 ring-success bg-success/5 shadow-sm',
          )}
          onClick={() => setStockFilter('in-stock')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">In Stock</p>
                <p className="text-2xl font-bold text-success">
                  {stockSummary.inStock.length}
                </p>
                <p className="text-xs text-success mt-1">Available</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-all hover:shadow-sm',
            stockFilter === 'out' && 'ring-2 ring-destructive bg-destructive/5 shadow-sm',
          )}
          onClick={() => setStockFilter('out')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Out of Stock</p>
                <p className="text-2xl font-bold text-destructive">
                  {stockSummary.outOfStock.length}
                </p>
                <p className="text-xs text-destructive mt-1">Need restock</p>
                {stockSummary.lowStock.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    and {stockSummary.lowStock.length} item
                    {stockSummary.lowStock.length !== 1 ? 's' : ''} low stock
                  </p>
                )}
              </div>
              <XCircle className="w-8 h-8 text-destructive opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Levels Table */}
        <div className="lg:col-span-2 relative">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle>Stock Levels</CardTitle>
                  {hideSkuColumn && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[10px] text-muted-foreground cursor-help border border-dashed border-muted-foreground/40 rounded px-1.5 py-0.5">
                            No SKU
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            SKU column hidden — over 80% of products have no SKU
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48 lg:w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => exportInventoryCsv(filteredProducts, getMainStock)}
                    disabled={filteredProducts.length === 0}
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </div>
              </div>

              {/* Filter bar */}
              <div className="flex flex-wrap gap-2 mt-3">
                {filterButtons.map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setStockFilter(btn.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      stockFilter === btn.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="overflow-x-auto pb-16">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Loading inventory...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 min-w-[500px]">
                  {/* Table header */}
                  <div
                    className={cn(
                      'grid gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase',
                      hideSkuColumn
                        ? 'grid-cols-[2rem_1fr_5rem_5rem]'
                        : 'grid-cols-[2rem_1fr_6rem_5rem_5rem]',
                    )}
                  >
                    <div className="flex items-center">
                      <Checkbox
                        checked={
                          somePageSelected ? 'indeterminate' : allPageSelected
                        }
                        onCheckedChange={(v) => toggleSelectAll(!!v)}
                        aria-label="Select all"
                      />
                    </div>
                    <button
                      onClick={() => toggleSort('name')}
                      className="flex items-center gap-1 hover:text-foreground text-left"
                    >
                      Product <SortIcon field="name" />
                    </button>
                    {!hideSkuColumn && (
                      <button
                        onClick={() => toggleSort('sku')}
                        className="flex items-center gap-1 hover:text-foreground text-left"
                      >
                        SKU <SortIcon field="sku" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleSort('stock')}
                      className="flex items-center justify-center gap-1 hover:text-foreground"
                    >
                      Stock <SortIcon field="stock" />
                    </button>
                    <div className="text-right">Action</div>
                  </div>

                  {/* Rows */}
                  {paginatedProducts.map((product) => {
                    const mainStock = getMainStock(product);
                    const allocatedStock = product.stock;
                    const isAllocationView = mainStock !== allocatedStock;

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          'grid gap-3 items-center px-3 py-3 rounded hover:bg-muted/30 transition-colors',
                          hideSkuColumn
                            ? 'grid-cols-[2rem_1fr_5rem_5rem]'
                            : 'grid-cols-[2rem_1fr_6rem_5rem_5rem]',
                          selectedIds.has(product.id) && 'bg-primary/5',
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(product.id)}
                          onCheckedChange={(v) =>
                            toggleSelectRow(product.id, !!v)
                          }
                          aria-label={`Select ${product.name}`}
                        />

                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={
                              product.image ||
                              generatePlaceholderUrl(product.name)
                            }
                            alt={product.name}
                            className="w-9 h-9 rounded object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              <HighlightText
                                text={product.name}
                                query={debouncedSearch}
                              />
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {product.brand || product.category}
                            </p>
                          </div>
                        </div>

                        {!hideSkuColumn && (
                          <div>
                            <span className="text-xs font-mono text-muted-foreground">
                              {product.sku?.trim() ? product.sku : '—'}
                            </span>
                          </div>
                        )}

                        <div className="text-center">
                          {renderStockBadge(product, mainStock)}
                          {isAllocationView && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Allocated: {allocatedStock}
                            </p>
                          )}
                        </div>

                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => openAdjustDialog(product)}
                          >
                            Adjust
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredProducts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No products match this filter</p>
                    </div>
                  )}

                  {filteredProducts.length > 0 && (
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredProducts.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                    />
                  )}
                </div>
              )}

              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div className="absolute bottom-0 left-0 right-0 mx-4 mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/95 backdrop-blur px-4 py-3 shadow-lg">
                  <span className="text-sm font-medium">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openAdjustDialog(selectedProducts[0], selectedProducts)
                      }
                    >
                      Adjust selected
                    </Button>
                    <Button size="sm" onClick={handleMarkForPurchase}>
                      <ShoppingCart className="w-4 h-4 mr-1.5" />
                      Mark for purchase
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Adjustments */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              {adjustmentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : adjustments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No adjustments yet</p>
                  <p className="text-xs mt-1">
                    Stock changes from purchases and manual adjustments will appear
                    here
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {adjustmentGroups.map((group) => {
                    const style = adjustmentTypeStyles[group.type];
                    const Icon = style.icon;
                    const isExpanded = expandedGroups.has(group.key);
                    const isGrouped = group.items.length > 1;
                    const totalQty = group.items.reduce(
                      (sum, item) => sum + item.quantity,
                      0,
                    );
                    const oldest = group.items[group.items.length - 1];
                    const newest = group.items[0];

                    if (!isGrouped) {
                      return renderAdjustmentEntry(group.items[0]);
                    }

                    return (
                      <div
                        key={group.key}
                        className="pb-4 border-b border-border last:border-0 last:pb-0"
                      >
                        <div className="group flex items-start gap-3">
                          <div
                            className={cn(
                              'p-2 rounded bg-muted shrink-0',
                              style.color,
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              className="flex items-center gap-1.5 text-left w-full"
                              onClick={() =>
                                setExpandedGroups((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(group.key)) next.delete(group.key);
                                  else next.add(group.key);
                                  return next;
                                })
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                              )}
                              <p className="text-sm font-semibold text-foreground truncate">
                                {group.product_name}
                              </p>
                            </button>
                            <div className="flex items-center gap-2 mt-0.5 ml-5">
                              <Badge
                                variant="outline"
                                className={cn('text-xs', style.color)}
                              >
                                {style.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {group.items.length} entries • net{' '}
                                {totalQty > 0 ? '+' : ''}
                                {totalQty}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ml-5">
                              {group.product_name} — {group.items.length}{' '}
                              {style.label.toLowerCase()}
                              {group.items.length !== 1 ? 's' : ''} over the past{' '}
                              {formatDistanceToNow(new Date(oldest.created_at), {
                                addSuffix: false,
                              })}
                            </p>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 ml-11 space-y-1 border-l border-border pl-3">
                            {group.items.map((adj) =>
                              renderAdjustmentEntry(adj, true),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stock Adjustment Dialog */}
      <Dialog
        open={showAdjustDialog}
        onOpenChange={(open) => {
          if (!isAdjusting) {
            setShowAdjustDialog(open);
            if (!open) setBulkAdjustProducts([]);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          {adjustProduct && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {bulkAdjustProducts.length > 1
                    ? `Adjust ${bulkAdjustProducts.length} Products`
                    : 'Adjust Stock'}
                </DialogTitle>
                <DialogDescription>
                  {bulkAdjustProducts.length > 1
                    ? `Apply the same change to ${bulkAdjustProducts.length} selected products`
                    : `${adjustProduct.name} — Current: ${getMainStock(adjustProduct)} ${adjustProduct.unit}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustType('add')}
                    disabled={isAdjusting}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-3 rounded text-sm font-medium transition-all',
                      adjustType === 'add'
                        ? 'bg-success/10 text-success ring-2 ring-success'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Add Stock
                  </button>
                  <button
                    onClick={() => setAdjustType('subtract')}
                    disabled={isAdjusting}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-3 rounded text-sm font-medium transition-all',
                      adjustType === 'subtract'
                        ? 'bg-destructive/10 text-destructive ring-2 ring-destructive'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Minus className="w-4 h-4" />
                    Remove Stock
                  </button>
                </div>

                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    placeholder="Enter quantity"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="mt-1 text-lg"
                    min="1"
                    disabled={isAdjusting}
                  />
                </div>

                <div>
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="e.g. Weekly restock, damaged, etc."
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    className="mt-1"
                    disabled={isAdjusting}
                  />
                </div>

                {bulkAdjustProducts.length <= 1 &&
                  adjustQty &&
                  parseInt(adjustQty) > 0 && (
                    <div className="p-3 rounded bg-muted text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current</span>
                        <span className="font-medium">
                          {getMainStock(adjustProduct)} {adjustProduct.unit}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-muted-foreground">Change</span>
                        <span
                          className={cn(
                            'font-medium',
                            adjustType === 'add'
                              ? 'text-success'
                              : 'text-destructive',
                          )}
                        >
                          {adjustType === 'add' ? '+' : '-'}
                          {adjustQty}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1 pt-1 border-t border-border">
                        <span className="font-medium">New Stock</span>
                        <span className="font-bold">
                          {adjustType === 'add'
                            ? getMainStock(adjustProduct) + parseInt(adjustQty)
                            : Math.max(
                                0,
                                getMainStock(adjustProduct) -
                                  parseInt(adjustQty),
                              )}{' '}
                          {adjustProduct.unit}
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAdjustDialog(false)}
                  disabled={isAdjusting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAdjustment}
                  disabled={
                    isAdjusting || !adjustQty || parseInt(adjustQty) <= 0
                  }
                  className={cn(
                    adjustType === 'add'
                      ? 'bg-success hover:bg-success/90'
                      : 'bg-destructive hover:bg-destructive/90',
                  )}
                >
                  {isAdjusting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : adjustType === 'add' ? (
                    'Add Stock'
                  ) : (
                    'Remove Stock'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
