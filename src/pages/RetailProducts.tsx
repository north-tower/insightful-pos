import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  MoreVertical,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  XCircle,
  ArrowUpDown,
  Eye,
  Copy,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PageLayout } from '@/components/pos/PageLayout';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import type { Product, ProductCategory } from '@/hooks/useProducts';
import { toast } from 'sonner';

interface RetailProductsProps {
  onNavigate: (tab: string) => void;
}

type SortField = 'name' | 'price' | 'stock' | 'sku';
type SortDir = 'asc' | 'desc';

export default function RetailProducts({ onNavigate }: RetailProductsProps) {
  const { retailProducts, retailCategories, loading } = useProducts();
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'list'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    let products = [...retailProducts];

    // Filter by category
    if (activeCategory !== 'all') {
      products = products.filter((p) => p.category === activeCategory);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.barcode?.includes(q)
      );
    }

    // Sort
    products.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'price':
          return (a.price - b.price) * dir;
        case 'stock':
          return (a.stock - b.stock) * dir;
        case 'sku':
          return a.sku.localeCompare(b.sku) * dir;
        default:
          return 0;
      }
    });

    return products;
  }, [activeCategory, searchQuery, sortField, sortDir, retailProducts]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.stock <= 0)
      return { label: 'Out of Stock', color: 'bg-destructive/10 text-destructive' };
    if (product.stock <= product.lowStockThreshold)
      return { label: 'Low Stock', color: 'bg-warning/10 text-warning' };
    return { label: 'In Stock', color: 'bg-success/10 text-success' };
  };

  const categoryStats = useMemo(() => {
    const total = retailProducts.length;
    const active = retailProducts.filter((p) => p.isActive).length;
    const lowStock = retailProducts.filter(
      (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
    ).length;
    const outOfStock = retailProducts.filter((p) => p.stock <= 0).length;
    return { total, active, lowStock, outOfStock };
  }, [retailProducts]);

  return (
    <PageLayout activeTab="products" onNavigate={onNavigate} flexContent>
          {/* Category Sidebar — compact horizontal strip on mobile, vertical on lg+ */}
          <div className="lg:w-64 bg-card border-b lg:border-b-0 lg:border-r border-border flex lg:flex-col shrink-0">
            <div className="hidden lg:block p-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Categories</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {categoryStats.total} products • {categoryStats.lowStock} low
                stock
              </p>
            </div>

            <div className="flex lg:flex-1 overflow-x-auto lg:overflow-y-auto px-2 py-1.5 lg:p-3 gap-1 lg:gap-0 lg:space-y-1 scrollbar-hide">
              {retailCategories.map((category) => {
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      'flex items-center gap-1.5 lg:gap-3 lg:justify-between px-2.5 lg:px-4 py-1.5 lg:py-3 rounded text-xs lg:text-sm font-medium transition-all whitespace-nowrap shrink-0 lg:w-full',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <span className="hidden lg:inline text-lg">{category.icon}</span>
                    <span>{category.name}</span>
                    <span
                      className={cn(
                        'text-[10px] lg:text-xs px-1.5 lg:px-2 py-0.5 rounded-full',
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {category.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick stats at bottom — hidden on mobile */}
            <div className="hidden lg:block p-4 border-t border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium text-foreground">
                  {categoryStats.active}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-warning">Low Stock</span>
                <span className="font-medium text-warning">
                  {categoryStats.lowStock}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-destructive">Out of Stock</span>
                <span className="font-medium text-destructive">
                  {categoryStats.outOfStock}
                </span>
              </div>
            </div>
          </div>

          {/* Product List Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Toolbar */}
            <div className="p-3 sm:p-4 border-b border-border">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-muted p-1 rounded">
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        'p-2 rounded transition-colors',
                        viewMode === 'list'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        'p-2 rounded transition-colors',
                        viewMode === 'grid'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>

                  <Button onClick={() => setShowAddDialog(true)} size="sm">
                    <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Add Product</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Results count */}
            <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <span>
                {loading ? 'Loading products...' : `Showing ${filteredProducts.length} of ${retailProducts.length} products`}
              </span>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex-1 flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Loading products...</p>
                </div>
              </div>
            )}

            {/* List View */}
            {!loading && viewMode === 'list' && (
              <div className="flex-1 overflow-y-auto">
                {/* ── Desktop table header (hidden on mobile) ── */}
                <div className="hidden md:grid sticky top-0 bg-muted/50 backdrop-blur-sm px-4 py-2 grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase">
                  <div className="col-span-4 flex items-center gap-1">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                      Product <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <button onClick={() => toggleSort('sku')} className="flex items-center gap-1 hover:text-foreground">
                      SKU <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="col-span-1 flex items-center gap-1">
                    <button onClick={() => toggleSort('price')} className="flex items-center gap-1 hover:text-foreground">
                      Price <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="col-span-1">Cost</div>
                  <div className="col-span-1 flex items-center gap-1">
                    <button onClick={() => toggleSort('stock')} className="flex items-center gap-1 hover:text-foreground">
                      Stock <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                {/* ── Mobile sort bar (hidden on desktop) ── */}
                <div className="flex md:hidden items-center gap-2 px-3 py-2 border-b border-border overflow-x-auto scrollbar-hide">
                  <span className="text-[10px] text-muted-foreground uppercase shrink-0">Sort:</span>
                  {([['name', 'Name'], ['price', 'Price'], ['stock', 'Stock'], ['sku', 'SKU']] as [SortField, string][]).map(([field, label]) => (
                    <button
                      key={field}
                      onClick={() => toggleSort(field)}
                      className={cn(
                        'text-[11px] font-medium px-2 py-1 rounded-full shrink-0 flex items-center gap-0.5 transition-colors',
                        sortField === field
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                      {sortField === field && <ArrowUpDown className="w-2.5 h-2.5" />}
                    </button>
                  ))}
                </div>

                {/* ── Desktop rows (hidden on mobile) ── */}
                <div className="hidden md:block divide-y divide-border">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product);
                    return (
                      <div
                        key={product.id}
                        className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-muted/30 transition-colors"
                      >
                        <div className="col-span-4 flex items-center gap-3">
                          <img src={product.image} alt={product.name} className="w-10 h-10 rounded object-cover" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.brand || product.category}</p>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm font-mono text-foreground">{product.sku}</span>
                          {product.barcode && <p className="text-xs text-muted-foreground font-mono">{product.barcode}</p>}
                        </div>
                        <div className="col-span-1">
                          <span className="text-sm font-semibold">${product.price.toFixed(2)}</span>
                        </div>
                        <div className="col-span-1">
                          <span className="text-sm text-muted-foreground">${product.cost.toFixed(2)}</span>
                          <p className="text-xs text-success">{Math.round(((product.price - product.cost) / product.price) * 100)}% margin</p>
                        </div>
                        <div className="col-span-1">
                          <span className={cn('text-sm font-semibold', product.stock <= 0 ? 'text-destructive' : product.stock <= product.lowStockThreshold ? 'text-warning' : 'text-foreground')}>
                            {product.stock}
                          </span>
                          <p className="text-xs text-muted-foreground">{product.unit}</p>
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                          <Badge className={cn('text-xs', status.color)}>{status.label}</Badge>
                          {product.variants && <Badge variant="outline" className="text-xs">{product.variants.length} variants</Badge>}
                        </div>
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedProduct(product)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toast.info(`Edit ${product.name}`)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Mobile card rows (hidden on desktop) ── */}
                <div className="md:hidden divide-y divide-border">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product);
                    return (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 px-3 py-2.5 active:bg-muted/40 transition-colors"
                        onClick={() => setSelectedProduct(product)}
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                            <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', status.color)}>
                              {product.stock <= 0 ? 'Out' : product.stock <= product.lowStockThreshold ? 'Low' : product.stock}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground font-mono">{product.sku}</span>
                            {product.brand && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground truncate">{product.brand}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">${product.price.toFixed(2)}</p>
                          <p className="text-[10px] text-success">
                            {Math.round(((product.price - product.cost) / product.price) * 100)}% margin
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grid View */}
            {!loading && viewMode === 'grid' && (
              <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product);
                    return (
                      <div
                        key={product.id}
                        className="bg-card border border-border rounded-lg p-2 sm:p-3 group hover:border-primary/40 active:bg-muted/30 transition-all cursor-pointer"
                        onClick={() => setSelectedProduct(product)}
                      >
                        <div className="relative aspect-square rounded-md overflow-hidden bg-muted mb-2 sm:mb-3">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                            <Badge className={cn('text-[10px] sm:text-xs px-1.5 sm:px-2', status.color)}>
                              {product.stock} left
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-1 sm:line-clamp-2 mb-0.5 sm:mb-1">
                          {product.name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2 truncate">
                          {product.sku}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base font-bold">
                            ${product.price.toFixed(2)}
                          </span>
                          <div className="hidden sm:flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); toast.info(`Edit ${product.name}`); }}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!loading && filteredProducts.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No products found</p>
                  <p className="text-sm mt-1">
                    Try adjusting your search or category filter
                  </p>
                </div>
              </div>
            )}
          </div>

      {/* Product Detail Dialog */}
      <Dialog
        open={!!selectedProduct}
        onOpenChange={() => setSelectedProduct(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">{selectedProduct.name}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  SKU: {selectedProduct.sku}
                  {selectedProduct.barcode &&
                    ` • Barcode: ${selectedProduct.barcode}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 sm:space-y-4">
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-full h-36 sm:h-48 object-cover rounded"
                />

                <div className="grid grid-cols-3 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-bold text-base sm:text-lg">
                      ${selectedProduct.price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="font-bold text-base sm:text-lg">
                      ${selectedProduct.cost.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margin</p>
                    <p className="font-bold text-base sm:text-lg text-success">
                      {Math.round(
                        ((selectedProduct.price - selectedProduct.cost) /
                          selectedProduct.price) *
                          100
                      )}
                      %
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stock</p>
                    <p
                      className={cn(
                        'font-bold text-base sm:text-lg',
                        selectedProduct.stock <= 0
                          ? 'text-destructive'
                          : selectedProduct.stock <=
                            selectedProduct.lowStockThreshold
                          ? 'text-warning'
                          : 'text-foreground'
                      )}
                    >
                      {selectedProduct.stock} {selectedProduct.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="font-medium capitalize text-sm">
                      {selectedProduct.category}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Brand</p>
                    <p className="font-medium text-sm">
                      {selectedProduct.brand || '—'}
                    </p>
                  </div>
                </div>

                {selectedProduct.variants &&
                  selectedProduct.variants.length > 0 && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                        Variants
                      </p>
                      <div className="space-y-1.5 sm:space-y-2">
                        {selectedProduct.variants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-2 rounded border border-border text-xs sm:text-sm"
                          >
                            <span className="font-medium">{v.name}</span>
                            <div className="flex items-center gap-2 sm:gap-4">
                              <span className="font-mono text-[10px] sm:text-xs hidden sm:inline">
                                {v.sku}
                              </span>
                              <span>${v.price.toFixed(2)}</span>
                              <span className="text-muted-foreground">
                                {v.stock} pcs
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setSelectedProduct(null)}
                >
                  Close
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    toast.info(`Edit ${selectedProduct.name}`);
                    setSelectedProduct(null);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Product
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Fill in the product details to add to your catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <Label>Product Name</Label>
                <Input placeholder="e.g. Wireless Earbuds Pro" className="mt-1" />
              </div>
              <div>
                <Label>SKU</Label>
                <Input placeholder="e.g. ELC-005" className="mt-1 font-mono" />
              </div>
              <div>
                <Label>Barcode</Label>
                <Input
                  placeholder="Scan or enter"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Selling Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Stock Quantity</Label>
                <Input
                  type="number"
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Low Stock Alert</Label>
                <Input
                  type="number"
                  placeholder="10"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                toast.success('Product added');
                setShowAddDialog(false);
              }}
            >
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
