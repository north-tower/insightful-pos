import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLayout } from '@/components/pos/PageLayout';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/hooks/useProducts';
import { useStockAdjustments, type StockAdjustmentRow } from '@/hooks/useStockAdjustments';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { generatePlaceholderUrl } from '@/lib/product-images';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  enqueueOperation,
  getPendingOperations,
  markOperationFailed,
  markOperationSynced,
  updateOperationStatus,
} from '@/lib/offline/outbox';

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
  const { user } = useAuth();
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [staffAllocations, setStaffAllocations] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Array<{
    id: string;
    cashier_id: string;
    product_id: string;
    assigned_qty: number;
    sold_qty: number;
    is_active: boolean;
  }>>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [assignedQty, setAssignedQty] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const getMainStock = (product: Product) => product.mainStock ?? product.stock;
  const canManageCashierStock = user?.role === 'admin' || user?.role === 'manager';
  const staffAllocationReport = useMemo(() => {
    const grouped = new Map<string, {
      cashierName: string;
      cashierEmail: string;
      assigned: number;
      sold: number;
      remaining: number;
      lines: Array<{
        allocationId: string;
        productName: string;
        assigned: number;
        sold: number;
        remaining: number;
        isActive: boolean;
      }>;
    }>();

    allocations.forEach((a) => {
      const cashier = staffAllocations.find((c) => c.id === a.cashier_id);
      const product = retailProducts.find((p) => p.id === a.product_id);
      const remaining = Math.max(a.assigned_qty - a.sold_qty, 0);
      const key = a.cashier_id;
      const current = grouped.get(key) || {
        cashierName: cashier?.full_name || 'Unknown cashier',
        cashierEmail: cashier?.email || '',
        assigned: 0,
        sold: 0,
        remaining: 0,
        lines: [],
      };

      current.assigned += a.assigned_qty;
      current.sold += a.sold_qty;
      current.remaining += remaining;
      current.lines.push({
        allocationId: a.id,
        productName: product?.name || a.product_id,
        assigned: a.assigned_qty,
        sold: a.sold_qty,
        remaining,
        isActive: a.is_active,
      });

      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => a.cashierName.localeCompare(b.cashierName));
  }, [allocations, staffAllocations, retailProducts]);

  const loadCashierData = useCallback(async () => {
    if (!canManageCashierStock) return;
    const { data: storeData } = await supabase.rpc('current_store_id');
    let resolvedStoreId: string | null = storeData || null;

    // Fallback: if no default store is set, use the first assigned store.
    if (!resolvedStoreId && user?.id) {
      const { data: fallbackStore } = await supabase
        .from('profile_stores')
        .select('store_id, is_default_store')
        .eq('profile_id', user.id)
        .order('is_default_store', { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedStoreId = fallbackStore?.store_id || null;
    }

    if (!resolvedStoreId) {
      setStaffAllocations([]);
      setAllocations([]);
      return;
    }
    setStoreId(resolvedStoreId);

    const [cashierRes, allocationRes] = await Promise.all([
      supabase
        .from('profile_stores')
        .select('profile_id')
        .eq('store_id', resolvedStoreId)
        .in('role_in_store', ['cashier', 'manager']),
      supabase
        .from('cashier_stock_allocations')
        .select('id, cashier_id, product_id, assigned_qty, sold_qty, is_active')
        .eq('store_id', resolvedStoreId)
        .order('updated_at', { ascending: false }),
    ]);

    if (!cashierRes.error) {
      const cashierIds = Array.from(new Set((cashierRes.data || []).map((row) => row.profile_id)));
      let mapped: Array<{ id: string; full_name: string; email: string }> = [];

      if (cashierIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', cashierIds);

        if (profileData && profileData.length > 0) {
          const profileMap = new Map(
            profileData.map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
          );
          mapped = cashierIds.map((id) => {
            const prof = profileMap.get(id);
            return {
              id,
              full_name: prof?.full_name || id,
              email: prof?.email || '',
            };
          });
        } else {
          // If profile rows are not readable by policy, still show selectable IDs.
          mapped = cashierIds.map((id) => ({
            id,
            full_name: id,
            email: '',
          }));
        }
      }

      setStaffAllocations(mapped);
    }

    if (!allocationRes.error) {
      setAllocations(allocationRes.data || []);
    }
  }, [canManageCashierStock, user?.id]);

  const assignCashierStockRemote = useCallback(async () => {
    if (!storeId || !selectedStaffId || !selectedProductId || !assignedQty) {
      throw new Error('Select staff, product and quantity');
    }

    const qty = parseInt(assignedQty, 10);
    if (isNaN(qty) || qty < 0) {
      throw new Error('Enter a valid quantity');
    }

    const { data: activeAllocation, error: activeLookupError } = await supabase
      .from('cashier_stock_allocations')
      .select('id')
      .eq('store_id', storeId)
      .eq('cashier_id', selectedStaffId)
      .eq('product_id', selectedProductId)
      .eq('is_active', true)
      .maybeSingle();

    if (activeLookupError) throw activeLookupError;

    if (activeAllocation) {
      const { error: deactivateError } = await supabase
        .from('cashier_stock_allocations')
        .update({ is_active: false })
        .eq('id', activeAllocation.id);
      if (deactivateError) throw deactivateError;
    }

    const { error } = await supabase
      .from('cashier_stock_allocations')
      .insert([{
        store_id: storeId,
        cashier_id: selectedStaffId,
        product_id: selectedProductId,
        assigned_qty: qty,
        assigned_by: user?.id,
        is_active: true,
      }]);

    if (error) throw error;
    return qty;
  }, [assignedQty, selectedStaffId, selectedProductId, storeId, user?.id]);

  const returnAllocationRemote = useCallback(async (allocationId: string) => {
    const { error } = await supabase
      .from('cashier_stock_allocations')
      .update({ is_active: false })
      .eq('id', allocationId);
    if (error) throw error;
  }, []);

  const syncQueuedCashierAllocations = useCallback(async (operationId?: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const pending = await getPendingOperations();
    const cashierOps = pending.filter(
      (op) => op.entity === 'cashier_stock_allocations',
    );
    const selectedOps = operationId ? cashierOps.filter((op) => op.id === operationId) : cashierOps;

    for (const op of selectedOps) {
      try {
        await updateOperationStatus(op.id, 'processing');
        if (op.action === 'assign_stock') {
          const payload = op.payload as {
            storeId: string;
            cashierId: string;
            productId: string;
            qty: number;
            assignedBy?: string;
          };
          if (!payload?.storeId || !payload?.cashierId || !payload?.productId) {
            throw new Error('Invalid assign_stock payload');
          }

          const { data: activeAllocation, error: activeLookupError } = await supabase
            .from('cashier_stock_allocations')
            .select('id')
            .eq('store_id', payload.storeId)
            .eq('cashier_id', payload.cashierId)
            .eq('product_id', payload.productId)
            .eq('is_active', true)
            .maybeSingle();
          if (activeLookupError) throw activeLookupError;

          if (activeAllocation) {
            const { error: deactivateError } = await supabase
              .from('cashier_stock_allocations')
              .update({ is_active: false })
              .eq('id', activeAllocation.id);
            if (deactivateError) throw deactivateError;
          }

          const { error } = await supabase
            .from('cashier_stock_allocations')
            .insert([{
              store_id: payload.storeId,
              cashier_id: payload.cashierId,
              product_id: payload.productId,
              assigned_qty: payload.qty,
              assigned_by: payload.assignedBy || null,
              is_active: true,
            }]);
          if (error) throw error;
        } else if (op.action === 'return_stock') {
          const payload = op.payload as { allocationId: string };
          if (!payload?.allocationId) throw new Error('Invalid return_stock payload');
          await returnAllocationRemote(payload.allocationId);
        }

        await markOperationSynced(op.id);
      } catch (err: any) {
        await markOperationFailed(
          op.id,
          err?.message || 'Failed to sync cashier stock allocation',
        );
      }
    }

    await loadCashierData();
  }, [loadCashierData, returnAllocationRemote]);

  useEffect(() => {
    void loadCashierData();
  }, [loadCashierData]);

  useEffect(() => {
    const onOnline = () => {
      void syncQueuedCashierAllocations();
    };
    const onSyncRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ operationId?: string }>;
      void syncQueuedCashierAllocations(customEvent.detail?.operationId);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline-sync-request', onSyncRequest);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void syncQueuedCashierAllocations();
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline-sync-request', onSyncRequest);
    };
  }, [syncQueuedCashierAllocations]);

  // Stock summary
  const stockSummary = useMemo(() => {
    const totalProducts = retailProducts.length;
    const totalUnits = retailProducts.reduce((sum, p) => sum + getMainStock(p), 0);
    const totalValue = retailProducts.reduce(
      (sum, p) => sum + p.price * getMainStock(p),
      0
    );
    const inStock = retailProducts.filter((p) => getMainStock(p) > 0);
    const outOfStock = retailProducts.filter((p) => getMainStock(p) <= 0);

    return { totalProducts, totalUnits, totalValue, inStock, outOfStock };
  }, [retailProducts]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let products = [...retailProducts];

    // Filter by stock status
    switch (stockFilter) {
      case 'in-stock':
        products = products.filter((p) => getMainStock(p) > 0);
        break;
      case 'out':
        products = products.filter((p) => getMainStock(p) <= 0);
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
      const aStock = getMainStock(a);
      const bStock = getMainStock(b);
      if (aStock === 0 && bStock !== 0) return -1;
      if (aStock !== 0 && bStock === 0) return 1;
      return aStock - bStock;
    });

    return products;
  }, [stockFilter, searchQuery, retailProducts]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, stockFilter]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredProducts, currentPage, pageSize],
  );

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

  const handleAssignCashierStock = async () => {
    if (!storeId || !selectedStaffId || !selectedProductId || !assignedQty) {
      toast.error('Select staff, product and quantity');
      return;
    }
    const qty = parseInt(assignedQty, 10);
    if (isNaN(qty) || qty < 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    setIsAssigning(true);
    try {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (isOnline) {
        await assignCashierStockRemote();
      } else {
        const localId = `local-allocation-${crypto.randomUUID()}`;
        const nextAllocations = allocations.map((a) =>
          a.cashier_id === selectedStaffId &&
          a.product_id === selectedProductId &&
          a.is_active
            ? { ...a, is_active: false }
            : a,
        );

        nextAllocations.unshift({
          id: localId,
          cashier_id: selectedStaffId,
          product_id: selectedProductId,
          assigned_qty: qty,
          sold_qty: 0,
          is_active: true,
        });

        setAllocations(nextAllocations);

        await enqueueOperation({
          entity: 'cashier_stock_allocations',
          action: 'assign_stock',
          payload: {
            storeId,
            cashierId: selectedStaffId,
            productId: selectedProductId,
            qty,
            assignedBy: user?.id,
          },
        });
      }

      toast.success('Staff stock assigned');
      setAssignedQty('');
      if (isOnline) {
        await loadCashierData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign staff stock');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReturnAllocation = async (allocationId: string) => {
    setIsAssigning(true);
    try {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (isOnline) {
        await returnAllocationRemote(allocationId);
      } else {
        setAllocations((prev) =>
          prev.map((a) => (a.id === allocationId ? { ...a, is_active: false } : a)),
        );
        await enqueueOperation({
          entity: 'cashier_stock_allocations',
          action: 'return_stock',
          payload: { allocationId },
        });
      }

      toast.success('Allocation returned to store pool');
      if (isOnline) {
        await loadCashierData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to return allocation');
    } finally {
      setIsAssigning(false);
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
                      {formatCurrency(stockSummary.totalValue)} value
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

          {canManageCashierStock && (
            <Card className="mb-6">
              <CardHeader>
                  <CardTitle>Assign Staff Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Staff (Manager/Cashier)</Label>
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                      <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                      <SelectContent>
                        {staffAllocations.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name || c.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Product</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {retailProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} (Main: {getMainStock(p)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assigned Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      value={assignedQty}
                      onChange={(e) => setAssignedQty(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={handleAssignCashierStock} disabled={isAssigning}>
                      {isAssigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Save Assignment
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {allocations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No staff allocations yet.</p>
                  ) : (
                    allocations.slice(0, 10).map((a) => {
                      const cashier = staffAllocations.find((c) => c.id === a.cashier_id);
                      const product = retailProducts.find((p) => p.id === a.product_id);
                      const remaining = Math.max(a.assigned_qty - a.sold_qty, 0);
                      return (
                        <div key={a.id} className="rounded border px-3 py-2 text-sm flex items-center justify-between">
                          <span>
                            {(cashier?.full_name || cashier?.email || a.cashier_id)} - {product?.name || a.product_id}
                          </span>
                          <div className="flex items-center gap-3">
                            {a.id.startsWith('local-allocation-') && (
                              <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                                Pending sync
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              Assigned {a.assigned_qty} | Sold {a.sold_qty} | Remaining {remaining}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isAssigning || !a.is_active}
                              onClick={() => handleReturnAllocation(a.id)}
                            >
                              {a.is_active ? 'Return' : 'Returned'}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </CardContent>
            </Card>
          )}

          {canManageCashierStock && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Per-Staff Inventory Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {staffAllocationReport.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No staff inventory data yet.</p>
                ) : (
                  staffAllocationReport.map((entry) => (
                    <div key={`${entry.cashierName}-${entry.cashierEmail}`} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-semibold">{entry.cashierName}</p>
                          {entry.cashierEmail && (
                            <p className="text-xs text-muted-foreground">{entry.cashierEmail}</p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          <p>Assigned: {entry.assigned}</p>
                          <p>Sold: {entry.sold}</p>
                          <p className="font-semibold text-foreground">Remaining: {entry.remaining}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {entry.lines.map((line) => (
                          <div key={line.allocationId} className="text-xs flex items-center justify-between">
                            <span className="text-muted-foreground">{line.productName}</span>
                            <div className="flex items-center gap-2">
                              {line.allocationId.startsWith('local-allocation-') && (
                                <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                                  Pending sync
                                </Badge>
                              )}
                              <span className="text-muted-foreground">
                                {line.assigned} / {line.sold} / {line.remaining}
                                {!line.isActive ? ' (returned)' : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

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
                    {paginatedProducts.map((product) => (
                        (() => {
                          const mainStock = getMainStock(product);
                          const allocatedStock = product.stock;
                          const isAllocationView = mainStock !== allocatedStock;
                          return (
                        <div
                          key={product.id}
                          className="grid grid-cols-12 gap-3 items-center px-3 py-3 rounded hover:bg-muted/30 transition-colors"
                        >
                          {/* Product */}
                          <div className="col-span-5 flex items-center gap-3">
                            <img
                              src={product.image || generatePlaceholderUrl(product.name)}
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
                              variant={mainStock <= 0 ? 'destructive' : 'secondary'}
                              className="font-bold"
                            >
                              {mainStock} {product.unit}
                            </Badge>
                            {isAllocationView && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Allocated: {allocatedStock}
                              </p>
                            )}
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
                        })()
                    ))}

                    {filteredProducts.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No products match this filter</p>
                      </div>
                    )}

                    {/* Pagination */}
                    {filteredProducts.length > 0 && (
                      <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredProducts.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                      />
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
