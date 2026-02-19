import { useState, useMemo } from 'react';
import {
  Search,
  Package,
  AlertTriangle,
  XCircle,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Minus,
  Plus,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  Filter,
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
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import { cn } from '@/lib/utils';
import {
  retailProducts,
  recentStockAdjustments,
  Product,
  StockAdjustment,
} from '@/data/productData';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface RetailInventoryProps {
  onNavigate: (tab: string) => void;
}

type StockFilter = 'all' | 'low' | 'out' | 'healthy';

const adjustmentTypeStyles: Record<
  StockAdjustment['type'],
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
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // Stock summary
  const stockSummary = useMemo(() => {
    const totalProducts = retailProducts.length;
    const totalUnits = retailProducts.reduce((sum, p) => sum + p.stock, 0);
    const totalValue = retailProducts.reduce(
      (sum, p) => sum + p.cost * p.stock,
      0
    );
    const lowStock = retailProducts.filter(
      (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
    );
    const outOfStock = retailProducts.filter((p) => p.stock <= 0);
    const healthy = retailProducts.filter(
      (p) => p.stock > p.lowStockThreshold
    );

    return { totalProducts, totalUnits, totalValue, lowStock, outOfStock, healthy };
  }, []);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let products = [...retailProducts];

    // Filter by stock status
    switch (stockFilter) {
      case 'low':
        products = products.filter(
          (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
        );
        break;
      case 'out':
        products = products.filter((p) => p.stock <= 0);
        break;
      case 'healthy':
        products = products.filter((p) => p.stock > p.lowStockThreshold);
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

    // Sort: out of stock first, then low stock, then by stock asc
    products.sort((a, b) => {
      if (a.stock === 0 && b.stock !== 0) return -1;
      if (a.stock !== 0 && b.stock === 0) return 1;
      if (
        a.stock <= a.lowStockThreshold &&
        b.stock > b.lowStockThreshold
      )
        return -1;
      if (
        a.stock > a.lowStockThreshold &&
        b.stock <= b.lowStockThreshold
      )
        return 1;
      return a.stock - b.stock;
    });

    return products;
  }, [stockFilter, searchQuery]);

  const openAdjustDialog = (product: Product) => {
    setAdjustProduct(product);
    setAdjustType('add');
    setAdjustQty('');
    setAdjustNote('');
    setShowAdjustDialog(true);
  };

  const handleAdjustment = () => {
    if (!adjustProduct || !adjustQty) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    const action = adjustType === 'add' ? 'added to' : 'removed from';
    toast.success(
      `${qty} units ${action} ${adjustProduct.name}`
    );
    setShowAdjustDialog(false);
  };

  const getStockBarWidth = (product: Product) => {
    // Visual stock level relative to threshold * 3 (assumed "good" level)
    const maxReference = product.lowStockThreshold * 3;
    return Math.min((product.stock / maxReference) * 100, 100);
  };

  const getStockBarColor = (product: Product) => {
    if (product.stock <= 0) return 'bg-destructive';
    if (product.stock <= product.lowStockThreshold) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab="inventory" onTabChange={onNavigate} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Inventory
              </h1>
              <p className="text-muted-foreground">
                {stockSummary.totalProducts} products •{' '}
                {stockSummary.totalUnits} total units
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                      ${stockSummary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} inventory value
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'cursor-pointer transition-all',
                stockFilter === 'healthy' && 'ring-2 ring-success'
              )}
              onClick={() => setStockFilter('healthy')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      In Stock
                    </p>
                    <p className="text-2xl font-bold text-success">
                      {stockSummary.healthy.length}
                    </p>
                    <p className="text-xs text-success mt-1">Stock healthy</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-success opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'cursor-pointer transition-all',
                stockFilter === 'low' && 'ring-2 ring-warning'
              )}
              onClick={() => setStockFilter('low')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Low Stock
                    </p>
                    <p className="text-2xl font-bold text-warning">
                      {stockSummary.lowStock.length}
                    </p>
                    <p className="text-xs text-warning mt-1">
                      Need restocking
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-warning opacity-50" />
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
                      Urgent reorder
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
                    <div className="relative w-64">
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
                <CardContent>
                  <div className="space-y-1">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase">
                      <div className="col-span-4">Product</div>
                      <div className="col-span-2">SKU</div>
                      <div className="col-span-1 text-center">Stock</div>
                      <div className="col-span-3">Level</div>
                      <div className="col-span-2 text-right">Action</div>
                    </div>

                    {/* Rows */}
                    {filteredProducts.map((product) => {
                      const barWidth = getStockBarWidth(product);
                      const barColor = getStockBarColor(product);

                      return (
                        <div
                          key={product.id}
                          className="grid grid-cols-12 gap-3 items-center px-3 py-3 rounded hover:bg-muted/30 transition-colors"
                        >
                          {/* Product */}
                          <div className="col-span-4 flex items-center gap-3">
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
                          <div className="col-span-2">
                            <span className="text-xs font-mono">
                              {product.sku}
                            </span>
                          </div>

                          {/* Stock count */}
                          <div className="col-span-1 text-center">
                            <span
                              className={cn(
                                'text-sm font-bold',
                                product.stock <= 0
                                  ? 'text-destructive'
                                  : product.stock <= product.lowStockThreshold
                                  ? 'text-warning'
                                  : 'text-foreground'
                              )}
                            >
                              {product.stock}
                            </span>
                          </div>

                          {/* Stock bar */}
                          <div className="col-span-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    barColor
                                  )}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-12 text-right">
                                / {product.lowStockThreshold * 3}
                              </span>
                            </div>
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
                      );
                    })}

                    {filteredProducts.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No products match this filter</p>
                      </div>
                    )}
                  </div>
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
                  <div className="space-y-4">
                    {recentStockAdjustments.map((adj) => {
                      const style = adjustmentTypeStyles[adj.type];
                      const Icon = style.icon;
                      return (
                        <div
                          key={adj.id}
                          className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
                        >
                          <div
                            className={cn(
                              'p-2 rounded bg-muted',
                              style.color
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {adj.productName}
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
                            </div>
                            {adj.note && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {adj.note}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{adj.staffName}</span>
                              <span>•</span>
                              <span>
                                {formatDistanceToNow(adj.date, {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
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
                  />
                </div>

                <div>
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="e.g. Weekly restock, damaged, etc."
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    className="mt-1"
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
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAdjustment}
                  className={cn(
                    adjustType === 'add'
                      ? 'bg-success hover:bg-success/90'
                      : 'bg-destructive hover:bg-destructive/90'
                  )}
                >
                  {adjustType === 'add' ? 'Add Stock' : 'Remove Stock'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
