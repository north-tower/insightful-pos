import { useState, useMemo } from 'react';
import {
  Search,
  Package,
  XCircle,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Minus,
  Plus,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/pos/PageLayout';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/hooks/useProducts';
import { useStockAdjustments, type StockAdjustmentRow } from '@/hooks/useStockAdjustments';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface RetailInventoryProps {
  onNavigate: (tab: string) => void;
}

type StockFilter = 'all' | 'in-stock' | 'out';

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
};

export default function RetailInventory({ onNavigate }: RetailInventoryProps) {
  const { retailProducts, loading, refetch: refetchProducts } = useProducts();
  const {
    adjustments,
    loading: adjustmentsLoading,
    adjustStock,
  } = useStockAdjustments(30);

  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Stock summary
  const stockSummary = useMemo(() => {
    const totalProducts = retailProducts.length;
    const totalUnits = retailProducts.reduce((sum, p) => sum + p.stock, 0);
    const totalValue = retailProducts.reduce(
      (sum, p) => sum + p.cost * p.stock,
      0
    );
    const inStock = retailProducts.filter((p) => p.stock > 0);
    const outOfStock = retailProducts.filter((p) => p.stock <= 0);

    return { totalProducts, totalUnits, totalValue, inStock, outOfStock };
  }, [retailProducts]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let products = [...retailProducts];

    // Filter by stock status
    switch (stockFilter) {
      case 'in-stock':
        products = products.filter((p) => p.stock > 0);
        break;
      case 'out':
        products = products.filter((p) => p.stock <= 0);
        break;
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q)
      );
    }

    // Sort: out of stock first, then by stock ascending
    products.sort((a, b) => {
      if (a.stock === 0 && b.stock !== 0) return -1;
      if (a.stock !== 0 && b.stock === 0) return 1;
      return a.stock - b.stock;
    });

    return products;
  }, [stockFilter, searchQuery, retailProducts]);

  const openAdjustDialog = (product: Product) => {
    setAdjustProduct(product);
    setAdjustType('add');
    setAdjustQty('');
    setAdjustNote('');
    setShowAdjustDialog(true);
  };

  const handleAdjustment = async () => {
    if (!adjustProduct || !adjustQty) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    setIsAdjusting(true);
    try {
      const effectiveQty = adjustType === 'add' ? qty : -qty;
      const type = adjustType === 'add' ? 'restock' : 'adjustment';

      await adjustStock(
        adjustProduct.id,
        type,
        effectiveQty,
        adjustNote || undefined,
      );

      // Refresh product list so stock numbers update
      await refetchProducts();

      const action = adjustType === 'add' ? 'added to' : 'removed from';
      toast.success(`${qty} units ${action} ${adjustProduct.name}`);
      setShowAdjustDialog(false);
    } catch (err: any) {
      console.error('Stock adjustment failed:', err);
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <PageLayout activeTab="inventory" onNavigate={onNavigate}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Inventory
              </h1>
              <p className="text-muted-foreground">
                {stockSummary.totalProducts} products •{' '}
                {stockSummary.totalUnits} total units
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
            <Card
              className={cn(
                'cursor-pointer transition-all',
                stockFilter === 'all' && 'ring-2 ring-primary'
              )}
              onClick={() => setStockFilter('all')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Total Products
                    </p>
                    <p className="text-2xl font-bold">
                      {stockSummary.totalProducts}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${stockSummary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} value
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'cursor-pointer transition-all',
                stockFilter === 'in-stock' && 'ring-2 ring-success'
              )}
              onClick={() => setStockFilter('in-stock')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      In Stock
                    </p>
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
                'cursor-pointer transition-all',
                stockFilter === 'out' && 'ring-2 ring-destructive'
              )}
              onClick={() => setStockFilter('out')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Out of Stock
                    </p>
                    <p className="text-2xl font-bold text-destructive">
                      {stockSummary.outOfStock.length}
                    </p>
                    <p className="text-xs text-destructive mt-1">
                      Need restock
                    </p>
                  </div>
                  <XCircle className="w-8 h-8 text-destructive opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stock Levels Table - 2 cols */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Stock Levels</CardTitle>
                    <div className="relative w-full sm:w-48 lg:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Loading inventory...</p>
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-1 min-w-[500px]">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase">
                      <div className="col-span-5">Product</div>
                      <div className="col-span-3">SKU</div>
                      <div className="col-span-2 text-center">Stock</div>
                      <div className="col-span-2 text-right">Action</div>
                    </div>

                    {/* Rows */}
                    {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          className="grid grid-cols-12 gap-3 items-center px-3 py-3 rounded hover:bg-muted/30 transition-colors"
                        >
                          {/* Product */}
                          <div className="col-span-5 flex items-center gap-3">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-9 h-9 rounded object-cover"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {product.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.brand || product.category}
                              </p>
                            </div>
                          </div>

                          {/* SKU */}
                          <div className="col-span-3">
                            <span className="text-xs font-mono">
                              {product.sku}
                            </span>
                          </div>

                          {/* Stock count */}
                          <div className="col-span-2 text-center">
                            <Badge
                              variant={product.stock <= 0 ? 'destructive' : 'secondary'}
                              className="font-bold"
                            >
                              {product.stock} {product.unit}
                            </Badge>
                          </div>

                          {/* Action */}
                          <div className="col-span-2 flex justify-end gap-1">
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
                    ))}

                    {filteredProducts.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No products match this filter</p>
                      </div>
                    )}
                  </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Adjustments - 1 col */}
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
                        Stock changes from purchases and manual adjustments will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {adjustments.map((adj) => {
                        const style = adjustmentTypeStyles[adj.type];
                        const Icon = style.icon;
                        return (
                          <div
                            key={adj.id}
                            className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
                          >
                            <div
                              className={cn(
                                'p-2 rounded bg-muted shrink-0',
                                style.color
                              )}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {adj.product_name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn('text-xs', style.color)}
                                >
                                  {style.label}
                                </Badge>
                                <span
                                  className={cn(
                                    'text-xs font-mono font-bold',
                                    adj.quantity > 0
                                      ? 'text-success'
                                      : 'text-destructive'
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
                                <p className="text-xs text-muted-foreground mt-1">
                                  {adj.note}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{adj.staff_name}</span>
                                <span>•</span>
                                <span>
                                  {formatDistanceToNow(new Date(adj.created_at), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                            </div>
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
      <Dialog open={showAdjustDialog} onOpenChange={(open) => !isAdjusting && setShowAdjustDialog(open)}>
        <DialogContent className="max-w-sm">
          {adjustProduct && (
            <>
              <DialogHeader>
                <DialogTitle>Adjust Stock</DialogTitle>
                <DialogDescription>
                  {adjustProduct.name} — Current: {adjustProduct.stock}{' '}
                  {adjustProduct.unit}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Add / Subtract toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustType('add')}
                    disabled={isAdjusting}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-3 rounded text-sm font-medium transition-all',
                      adjustType === 'add'
                        ? 'bg-success/10 text-success ring-2 ring-success'
                        : 'bg-muted text-muted-foreground'
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
                        : 'bg-muted text-muted-foreground'
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

                {adjustQty && parseInt(adjustQty) > 0 && (
                  <div className="p-3 rounded bg-muted text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current</span>
                      <span className="font-medium">
                        {adjustProduct.stock} {adjustProduct.unit}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground">Change</span>
                      <span
                        className={cn(
                          'font-medium',
                          adjustType === 'add'
                            ? 'text-success'
                            : 'text-destructive'
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
                          ? adjustProduct.stock + parseInt(adjustQty)
                          : Math.max(
                              0,
                              adjustProduct.stock - parseInt(adjustQty)
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
                  disabled={isAdjusting || !adjustQty || parseInt(adjustQty) <= 0}
                  className={cn(
                    adjustType === 'add'
                      ? 'bg-success hover:bg-success/90'
                      : 'bg-destructive hover:bg-destructive/90'
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
