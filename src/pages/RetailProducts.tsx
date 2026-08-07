import { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Edit,
  Trash2,
  Package,
  ArrowUpDown,
  Eye,
  Loader2,
  FlaskConical,
  ShoppingBag,
  Upload,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PageLayout } from '@/components/pos/PageLayout';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import type { Product, ProductType } from '@/hooks/useProducts';
import EditProductDialog from '@/components/product/EditProductDialog';
import BulkImportProductsDialog from '@/components/product/BulkImportProductsDialog';
import ImageUploader from '@/components/product/ImageUploader';
import { generatePlaceholderUrl } from '@/lib/product-images';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { shouldHideSkuColumn, getDisplaySku } from '@/lib/productSku';

interface RetailProductsProps {
  onNavigate: (tab: string) => void;
}

type SortField = 'name' | 'price' | 'stock' | 'sku';
type SortDir = 'asc' | 'desc';
type ProductTypeTab = 'finished' | 'raw';
type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out';

/** Default low-stock threshold for catalog badges (units) */
const LOW_STOCK_UNITS = 5;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getStockTier(product: Product): 'out' | 'low' | 'in' {
  if (product.stock <= 0) return 'out';
  if (product.stock <= LOW_STOCK_UNITS) return 'low';
  return 'in';
}

function matchesStockFilter(product: Product, filter: StockFilter) {
  const tier = getStockTier(product);
  switch (filter) {
    case 'in-stock':
      return tier === 'in';
    case 'low-stock':
      return tier === 'low';
    case 'out':
      return tier === 'out';
    default:
      return true;
  }
}

function calcMarginPercent(price: number, cost: number): number | null {
  if (!price || price <= 0) return null;
  const margin = ((price - cost) / price) * 100;
  return Number.isFinite(margin) ? margin : null;
}

function formatMarginLabel(price: number, cost: number) {
  const margin = calcMarginPercent(price, cost);
  return margin === null ? '—' : `${Math.round(margin)}% margin`;
}

function getSubcategoryLabel(product: Product) {
  if (product.brand) return product.brand;
  if (product.category && product.category !== 'uncategorized') {
    return product.category;
  }
  return null;
}

function filterProducts(
  products: Product[],
  search: string,
  stockFilter: StockFilter,
) {
  let result = [...products];
  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q),
    );
  }
  if (stockFilter !== 'all') {
    result = result.filter((p) => matchesStockFilter(p, stockFilter));
  }
  return result;
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

function StockStatusBadge({ product, className }: { product: Product; className?: string }) {
  const tier = getStockTier(product);
  const styles = {
    out: 'bg-destructive text-destructive-foreground',
    low: 'bg-warning text-warning-foreground',
    in: 'bg-success text-success-foreground',
  };
  const labels = {
    out: 'Out of Stock',
    low: 'Low Stock',
    in: 'In Stock',
  };
  return (
    <Badge className={cn('text-xs border-0', styles[tier], className)}>
      {labels[tier]}
    </Badge>
  );
}

function StockPillBadge({ product }: { product: Product }) {
  const tier = getStockTier(product);
  if (tier === 'out') {
    return (
      <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-white shadow-sm">
        Out of stock
      </span>
    );
  }
  if (tier === 'low') {
    return (
      <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-white shadow-sm">
        {product.stock} left
      </span>
    );
  }
  return (
    <span className="rounded-full bg-success px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-white shadow-sm">
      {product.stock} left
    </span>
  );
}

const STOCK_FILTER_OPTIONS: { id: StockFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in-stock', label: 'In Stock' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'out', label: 'Out of Stock' },
];

export default function RetailProducts({ onNavigate }: RetailProductsProps) {
  const {
    finishedProducts,
    rawMaterialProducts,
    loading,
    rawCategories,
    slugToCategoryId,
    updateProduct,
    deleteProduct,
    addProduct,
    addProducts,
  } = useProducts();
  const [productTypeTab, setProductTypeTab] = useState<ProductTypeTab>('finished');
  const sourceProducts =
    productTypeTab === 'raw' ? rawMaterialProducts : finishedProducts;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'list'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Edit product state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Delete product state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Add product state
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    stock: '',
    lowStockThreshold: '10',
    unit: 'pcs',
    brand: '',
    categoryId: '',
    imageUrl: '',
    productType: 'finished' as ProductType,
  });

  const resetAddForm = (type: ProductType = productTypeTab === 'raw' ? 'raw' : 'finished') => {
    setAddForm({
      name: '',
      sku: '',
      barcode: '',
      price: '',
      cost: '',
      stock: '',
      lowStockThreshold: '10',
      unit: type === 'raw' ? 'kg' : 'pcs',
      brand: '',
      categoryId: '',
      imageUrl: '',
      productType: type,
    });
  };

  /** Get the product image URL, falling back to a generated placeholder */
  const getProductImage = (product: Product) =>
    product.image || generatePlaceholderUrl(product.name);

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsEditOpen(true);
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      await deleteProduct(deletingProduct.id);
      toast.success(`"${deletingProduct.name}" deleted`);
      setDeletingProduct(null);
      // If the deleted product was selected in the detail dialog, close it
      if (selectedProduct?.id === deletingProduct.id) {
        setSelectedProduct(null);
      }
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      toast.error(err.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddProduct = async () => {
    if (!addForm.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!addForm.price || parseFloat(addForm.price) < 0) {
      toast.error('Valid price is required');
      return;
    }
    setIsAdding(true);
    try {
      await addProduct({
        name: addForm.name.trim(),
        sku: addForm.sku.trim() || null,
        barcode: addForm.barcode.trim() || null,
        price: parseFloat(addForm.price),
        cost: addForm.cost ? parseFloat(addForm.cost) : 0,
        stock: addForm.stock ? parseFloat(addForm.stock) : 0,
        low_stock_threshold: addForm.lowStockThreshold ? parseFloat(addForm.lowStockThreshold) : 10,
        unit: addForm.unit.trim() || 'pcs',
        brand: addForm.brand.trim() || null,
        category_id: addForm.categoryId || null,
        image_url: addForm.imageUrl || null,
        is_active: true,
        product_type: addForm.productType,
      });
      toast.success(`"${addForm.name.trim()}" added successfully`);
      setShowAddDialog(false);
      resetAddForm();
    } catch (err: any) {
      console.error('Failed to add product:', err);
      toast.error(err.message || 'Failed to add product');
    } finally {
      setIsAdding(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    const products = filterProducts(sourceProducts, debouncedSearch, stockFilter);

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
  }, [debouncedSearch, stockFilter, sortField, sortDir, sourceProducts]);

  const finishedFilteredCount = useMemo(
    () => filterProducts(finishedProducts, debouncedSearch, stockFilter).length,
    [finishedProducts, debouncedSearch, stockFilter],
  );
  const rawFilteredCount = useMemo(
    () => filterProducts(rawMaterialProducts, debouncedSearch, stockFilter).length,
    [rawMaterialProducts, debouncedSearch, stockFilter],
  );

  const isFilterActive =
    stockFilter !== 'all' || debouncedSearch.trim().length > 0;

  const hideSkuColumn = useMemo(
    () => shouldHideSkuColumn(sourceProducts),
    [sourceProducts],
  );

  // Reset page on filter/search/tab change (not on view mode switch)
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, sortField, sortDir, productTypeTab, stockFilter]);

  // If SKU column is hidden but sort is still on sku, fall back to name
  useEffect(() => {
    if (hideSkuColumn && sortField === 'sku') {
      setSortField('name');
      setSortDir('asc');
    }
  }, [hideSkuColumn, sortField]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredProducts, currentPage, pageSize],
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const openAddDialog = () => {
    resetAddForm(productTypeTab === 'raw' ? 'raw' : 'finished');
    setShowAddDialog(true);
  };

  return (
    <TooltipProvider delayDuration={300}>
    <PageLayout activeTab="products" onNavigate={onNavigate} flexContent>
          {/* Product List Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Product type tabs */}
            <div className="px-3 sm:px-4 pt-3 sm:pt-4 border-b border-border">
              <Tabs
                value={productTypeTab}
                onValueChange={(v) => setProductTypeTab(v as ProductTypeTab)}
              >
                <TabsList>
                  <TabsTrigger value="finished" className="gap-1.5">
                    <ShoppingBag className="w-4 h-4" />
                    <span className="hidden sm:inline">Finished Goods</span>
                    <span className="sm:hidden">Finished</span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {isFilterActive
                        ? `${finishedFilteredCount} / ${finishedProducts.length}`
                        : finishedProducts.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="gap-1.5">
                    <FlaskConical className="w-4 h-4" />
                    <span className="hidden sm:inline">Raw Materials</span>
                    <span className="sm:hidden">Raw</span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {isFilterActive
                        ? `${rawFilteredCount} / ${rawMaterialProducts.length}`
                        : rawMaterialProducts.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Toolbar */}
            <div className="p-3 sm:p-4 border-b border-border">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={
                      productTypeTab === 'raw'
                        ? 'Search raw materials...'
                        : 'Search finished goods...'
                    }
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

                  <Button variant="outline" onClick={() => setShowBulkImport(true)} size="sm">
                    <Upload className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Bulk import</span>
                    <span className="sm:hidden">Bulk</span>
                  </Button>
                  <Button onClick={openAddDialog} size="sm">
                    <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {productTypeTab === 'raw' ? 'Add Raw Material' : 'Add Product'}
                    </span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </div>
              </div>

              {/* Stock filter bar */}
              <div className="flex flex-wrap gap-2 mt-3">
                {STOCK_FILTER_OPTIONS.map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
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
            </div>

            {/* Results count */}
            <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <span>
                {loading
                  ? 'Loading products...'
                  : `Showing ${filteredProducts.length} of ${sourceProducts.length} ${
                      productTypeTab === 'raw' ? 'raw materials' : 'finished goods'
                    }`}
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
                  <div className={cn(hideSkuColumn ? 'col-span-5' : 'col-span-4', 'flex items-center gap-1')}>
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                      Product <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </div>
                  {!hideSkuColumn && (
                    <div className="col-span-2 flex items-center gap-1">
                      <button onClick={() => toggleSort('sku')} className="flex items-center gap-1 hover:text-foreground">
                        SKU <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
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
                  <div className={cn(hideSkuColumn ? 'col-span-3' : 'col-span-2')}>Status</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                {/* ── Mobile sort bar (hidden on desktop) ── */}
                <div className="flex md:hidden items-center gap-2 px-3 py-2 border-b border-border overflow-x-auto scrollbar-hide">
                  <span className="text-[10px] text-muted-foreground uppercase shrink-0">Sort:</span>
                  {(
                    (
                      hideSkuColumn
                        ? ([['name', 'Name'], ['price', 'Price'], ['stock', 'Stock']] as [SortField, string][])
                        : ([['name', 'Name'], ['price', 'Price'], ['stock', 'Stock'], ['sku', 'SKU']] as [SortField, string][])
                    )
                  ).map(([field, label]) => (
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
                  {paginatedProducts.map((product) => {
                    const categoryLabel = getSubcategoryLabel(product);
                    const marginLabel = formatMarginLabel(product.price, product.cost);
                    const stockTier = getStockTier(product);
                    const displaySku = getDisplaySku(product.sku);
                    return (
                      <div
                        key={product.id}
                        className="group px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-muted/30 transition-colors"
                      >
                        <div className={cn(hideSkuColumn ? 'col-span-5' : 'col-span-4', 'flex items-center gap-3')}>
                          <img src={getProductImage(product)} alt={product.name} className="w-10 h-10 rounded object-cover" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              <HighlightText text={product.name} query={debouncedSearch} />
                            </p>
                            {categoryLabel && (
                              <p className="text-xs text-muted-foreground">{categoryLabel}</p>
                            )}
                          </div>
                        </div>
                        {!hideSkuColumn && (
                          <div className="col-span-2">
                            <span className={cn('text-sm font-mono', displaySku ? 'text-foreground' : 'text-muted-foreground')}>
                              {displaySku || '—'}
                            </span>
                            {product.barcode && <p className="text-xs text-muted-foreground font-mono">{product.barcode}</p>}
                          </div>
                        )}
                        <div className="col-span-1">
                          <span className="text-base font-bold text-foreground">{formatCurrency(product.price)}</span>
                        </div>
                        <div className="col-span-1">
                          <span className="text-sm text-foreground">{formatCurrency(product.cost)}</span>
                          <p className={cn('text-xs', marginLabel === '—' ? 'text-muted-foreground' : 'text-success')}>
                            {marginLabel === '—' ? '—' : marginLabel}
                          </p>
                        </div>
                        <div className="col-span-1">
                          <span className={cn('text-sm font-semibold', stockTier === 'out' ? 'text-destructive' : stockTier === 'low' ? 'text-warning' : 'text-foreground')}>
                            {product.stock}
                          </span>
                          <p className="text-xs text-muted-foreground">{product.unit}</p>
                        </div>
                        <div className={cn(hideSkuColumn ? 'col-span-3' : 'col-span-2', 'flex items-center gap-2')}>
                          <StockStatusBadge product={product} />
                          {product.variants && <Badge variant="outline" className="text-xs">{product.variants.length} variants</Badge>}
                        </div>
                        <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedProduct(product)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenEdit(product)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingProduct(product)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Mobile card rows (hidden on desktop) ── */}
                <div className="md:hidden divide-y divide-border">
                  {paginatedProducts.map((product) => {
                    const categoryLabel = getSubcategoryLabel(product);
                    const marginLabel = formatMarginLabel(product.price, product.cost);
                    const displaySku = getDisplaySku(product.sku);
                    return (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 px-3 py-2.5 active:bg-muted/40 transition-colors"
                        onClick={() => setSelectedProduct(product)}
                      >
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground truncate">
                              <HighlightText text={product.name} query={debouncedSearch} />
                            </p>
                            <StockStatusBadge product={product} className="text-[10px] px-1.5 py-0 shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {!hideSkuColumn && displaySku && (
                              <>
                                <span className="text-xs font-mono text-muted-foreground">
                                  {displaySku}
                                </span>
                                {categoryLabel && (
                                  <span className="text-muted-foreground">·</span>
                                )}
                              </>
                            )}
                            {categoryLabel && (
                              <span className="text-xs text-muted-foreground truncate">{categoryLabel}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-foreground">{formatCurrency(product.price)}</p>
                          <p className={cn('text-[10px]', marginLabel === '—' ? 'text-muted-foreground' : 'text-success')}>
                            {marginLabel === '—' ? '—' : marginLabel}
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
                  {paginatedProducts.map((product) => {
                    const marginLabel = formatMarginLabel(product.price, product.cost);
                    const isOutOfStock = product.stock <= 0;
                    return (
                      <div
                        key={product.id}
                        className="bg-card border border-border rounded-lg p-2 sm:p-3 group hover:border-primary/40 active:bg-muted/30 transition-all cursor-pointer"
                        onClick={() => setSelectedProduct(product)}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative aspect-square rounded-md overflow-hidden bg-muted mb-2 sm:mb-3">
                              <img
                                src={getProductImage(product)}
                                alt={product.name}
                                className={cn(
                                  'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300',
                                  isOutOfStock && 'opacity-40 grayscale',
                                )}
                              />
                              {isOutOfStock && (
                                <div className="absolute inset-0 bg-gray-500/25 pointer-events-none" />
                              )}
                              <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                                <StockPillBadge product={product} />
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-center">
                            {product.name}
                          </TooltipContent>
                        </Tooltip>
                        <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-1 sm:line-clamp-2 mb-0.5">
                          {product.name}
                        </p>
                        <p className="text-sm sm:text-base font-bold text-foreground mb-0.5">
                          {formatCurrency(product.price)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">
                          {product.stock} {product.unit}
                          <span className="mx-1.5">•</span>
                          {marginLabel}
                        </p>
                        <div className="flex items-center justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(product); }}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeletingProduct(product); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pagination */}
            {!loading && filteredProducts.length > 0 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredProducts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              />
            )}

            {!loading && filteredProducts.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">
                    {productTypeTab === 'raw'
                      ? 'No raw materials found'
                      : 'No finished goods found'}
                  </p>
                  <p className="text-sm mt-1">
                    {debouncedSearch || stockFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : productTypeTab === 'raw'
                        ? 'Add raw materials used in production'
                        : 'Add sellable products to your catalog'}
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
                  {getDisplaySku(selectedProduct.sku)
                    ? `SKU: ${getDisplaySku(selectedProduct.sku)}`
                    : null}
                  {selectedProduct.barcode &&
                    `${getDisplaySku(selectedProduct.sku) ? ' • ' : ''}Barcode: ${selectedProduct.barcode}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 sm:space-y-4">
                <img
                  src={selectedProduct.image || generatePlaceholderUrl(selectedProduct.name)}
                  alt={selectedProduct.name}
                  className="w-full h-36 sm:h-48 object-cover rounded"
                />

                <div className="grid grid-cols-3 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-bold text-base sm:text-lg">
                      {formatCurrency(selectedProduct.price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="font-bold text-base sm:text-lg">
                      {formatCurrency(selectedProduct.cost)}
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
                              <span>{formatCurrency(v.price)}</span>
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
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setDeletingProduct(selectedProduct);
                    setSelectedProduct(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-initial"
                    onClick={() => setSelectedProduct(null)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1 sm:flex-initial"
                    onClick={() => {
                      handleOpenEdit(selectedProduct);
                      setSelectedProduct(null);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(v) => { if (!isAdding) { setShowAddDialog(v); if (!v) resetAddForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {addForm.productType === 'raw' ? 'Add Raw Material' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {addForm.productType === 'raw'
                ? 'Raw materials are used in production and are not sold at POS.'
                : 'Fill in the product details to add to your catalog.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <Label>Product Name *</Label>
                <Input
                  placeholder="e.g. Wireless Earbuds Pro"
                  className="mt-1"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  placeholder="e.g. ELC-005"
                  className="mt-1 font-mono"
                  value={addForm.sku}
                  onChange={(e) => setAddForm((f) => ({ ...f, sku: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label>Barcode</Label>
                <Input
                  placeholder="Scan or enter"
                  className="mt-1 font-mono"
                  value={addForm.barcode}
                  onChange={(e) => setAddForm((f) => ({ ...f, barcode: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label>Product type</Label>
                <Select
                  value={addForm.productType}
                  onValueChange={(v) =>
                    setAddForm((f) => ({ ...f, productType: v as ProductType }))
                  }
                  disabled={isAdding}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finished">Finished good (sellable)</SelectItem>
                    <SelectItem value="raw">Raw material (production only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Selling Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="mt-1"
                  value={addForm.price}
                  onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="mt-1"
                  value={addForm.cost}
                  onChange={(e) => setAddForm((f) => ({ ...f, cost: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label>Stock Quantity</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="0"
                  className="mt-1"
                  value={addForm.stock}
                  onChange={(e) => setAddForm((f) => ({ ...f, stock: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label>Low Stock Alert</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="10"
                  className="mt-1"
                  value={addForm.lowStockThreshold}
                  onChange={(e) => setAddForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  placeholder="pcs, kg, ltr..."
                  className="mt-1"
                  value={addForm.unit}
                  onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label>Brand</Label>
                <Input
                  placeholder="Brand name"
                  className="mt-1"
                  value={addForm.brand}
                  onChange={(e) => setAddForm((f) => ({ ...f, brand: e.target.value }))}
                  disabled={isAdding}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Category</Label>
                <Select
                  value={addForm.categoryId}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, categoryId: v }))}
                  disabled={isAdding}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Image uploader in collapsible accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="image" className="border rounded-lg">
                <AccordionTrigger className="px-3 py-2.5 text-sm font-medium hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span>📷</span>
                    <span>Product Image</span>
                    {addForm.imageUrl && (
                      <span className="text-[10px] text-success font-normal bg-success/10 px-1.5 py-0.5 rounded-full">
                        Uploaded
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-0">
                  <ImageUploader
                    value={addForm.imageUrl}
                    onChange={(url) => setAddForm((f) => ({ ...f, imageUrl: url }))}
                    productName={addForm.name}
                    disabled={isAdding}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => { setShowAddDialog(false); resetAddForm(); }}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleAddProduct}
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding…
                </>
              ) : (
                'Add Product'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <BulkImportProductsDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        productType={productTypeTab === 'raw' ? 'raw' : 'finished'}
        categories={rawCategories}
        onImport={addProducts}
      />

      {/* Edit Product Dialog */}
      <EditProductDialog
        product={editingProduct}
        open={isEditOpen}
        onOpenChange={(v) => {
          setIsEditOpen(v);
          if (!v) setEditingProduct(null);
        }}
        rawCategories={rawCategories}
        slugToCategoryId={slugToCategoryId}
        onUpdate={updateProduct}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingProduct} onOpenChange={(v) => { if (!v && !isDeleting) setDeletingProduct(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deletingProduct?.name}"</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => setDeletingProduct(null)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
    </TooltipProvider>
  );
}
