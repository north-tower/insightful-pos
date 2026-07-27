import { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Truck,
  Package,
  Users,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLayout } from '@/components/pos/PageLayout';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { cn } from '@/lib/utils';
import { usePurchases, type NewPurchaseItem } from '@/hooks/usePurchases';
import { useSuppliers, type Supplier } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, isAfter, isSameMonth } from 'date-fns';
import { consumePurchaseDraft } from '@/lib/purchaseDraft';

type PurchaseSortKey = 'purchase_number' | 'supplier' | 'date' | 'items' | 'status' | 'total';
type SortDirection = 'asc' | 'desc';

interface PurchasesProps {
  onNavigate: (tab: string) => void;
}

// ── Status badge helper ──────────────────────────────────────────────────────

const statusStyles: Record<string, { label: string; tableLabel: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', tableLabel: 'Pending', variant: 'secondary' },
  received: { label: 'Received', tableLabel: 'Received', variant: 'default' },
  cancelled: { label: 'Cancelled', tableLabel: 'Cancelled', variant: 'destructive' },
};

const spendChartConfig = {
  spend: { label: 'Spend', color: 'hsl(var(--primary))' },
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function Purchases({ onNavigate }: PurchasesProps) {
  const { purchases, loading: purchasesLoading, createPurchase, updatePurchase, receivePurchase, cancelPurchase, deletePurchase } = usePurchases();
  const { suppliers, loading: suppliersLoading, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { retailProducts, refetch: refetchProducts } = useProducts();

  // ── Tab state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortKey, setSortKey] = useState<PurchaseSortKey>('date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // ── Purchase order state ──────────────────────────────────────────────
  const [showPoDialog, setShowPoDialog] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null); // null = new, id = editing
  const [isCreating, setIsCreating] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poReference, setPoReference] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poReceiveNow, setPoReceiveNow] = useState(false);
  const [poItems, setPoItems] = useState<(NewPurchaseItem & { _key: number })[]>([]);
  const [nextKey, setNextKey] = useState(1);

  // ── View purchase detail ──────────────────────────────────────────────
  const [viewPurchase, setViewPurchase] = useState<(typeof purchases)[0] | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // ── Delete purchase ───────────────────────────────────────────────────
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Supplier dialog state ─────────────────────────────────────────────
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'USA',
    notes: '',
  });

  // ── Delete supplier ───────────────────────────────────────────────────
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);

  // ── Pagination state ───────────────────────────────────────────────────
  const [poPage, setPoPage] = useState(1);
  const [poPageSize, setPoPageSize] = useState(20);

  // ── Filtered purchases ────────────────────────────────────────────────

  const filteredPurchases = useMemo(() => {
    let list = [...purchases];
    const now = new Date();

    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (supplierFilter !== 'all') {
      list = list.filter((p) => p.supplier_id === supplierFilter);
    }
    if (dateFilter === 'last7') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 7);
      list = list.filter((p) => isAfter(new Date(p.order_date), cutoff));
    } else if (dateFilter === 'last30') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      list = list.filter((p) => isAfter(new Date(p.order_date), cutoff));
    } else if (dateFilter === 'this_month') {
      list = list.filter((p) => isSameMonth(new Date(p.order_date), now));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.purchase_number.toLowerCase().includes(q) ||
          (p.supplier_name || '').toLowerCase().includes(q) ||
          (p.reference || '').toLowerCase().includes(q),
      );
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'purchase_number':
          return a.purchase_number.localeCompare(b.purchase_number) * dir;
        case 'supplier':
          return (a.supplier_name || '').localeCompare(b.supplier_name || '') * dir;
        case 'date':
          return (new Date(a.order_date).getTime() - new Date(b.order_date).getTime()) * dir;
        case 'items':
          return ((a.items || []).length - (b.items || []).length) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'total':
          return (a.total - b.total) * dir;
        default:
          return 0;
      }
    });

    return list;
  }, [purchases, statusFilter, supplierFilter, dateFilter, searchQuery, sortKey, sortDir]);

  const toggleSort = (key: PurchaseSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'total' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ column }: { column: PurchaseSortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5" />
      : <ArrowDown className="w-3.5 h-3.5" />;
  };

  // Reset page when filters change
  useEffect(() => {
    setPoPage(1);
  }, [searchQuery, statusFilter, supplierFilter, dateFilter, sortKey, sortDir]);

  const poTotalPages = Math.ceil(filteredPurchases.length / poPageSize);
  const paginatedPurchases = useMemo(
    () => filteredPurchases.slice((poPage - 1) * poPageSize, poPage * poPageSize),
    [filteredPurchases, poPage, poPageSize],
  );

  // ── Filtered suppliers ────────────────────────────────────────────────

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contact_person || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q),
    );
  }, [suppliers, searchQuery]);

  // ── PO item helpers ───────────────────────────────────────────────────

  const addPoItem = () => {
    setPoItems((prev) => [
      ...prev,
      {
        _key: nextKey,
        product_id: null,
        product_name: '',
        product_sku: null,
        quantity: 1,
        unit_cost: 0,
      },
    ]);
    setNextKey((k) => k + 1);
  };

  const removePoItem = (key: number) => {
    setPoItems((prev) => prev.filter((i) => i._key !== key));
  };

  const updatePoItem = (key: number, field: string, value: any) => {
    setPoItems((prev) =>
      prev.map((i) => {
        if (i._key !== key) return i;
        const updated = { ...i, [field]: value };
        // If selecting a product from the dropdown, auto-fill details
        if (field === 'product_id' && value) {
          const product = retailProducts.find((p) => p.id === value);
          if (product) {
            updated.product_name = product.name;
            updated.product_sku = product.sku || null;
            updated.unit_cost = product.cost || 0;
          }
        }
        return updated;
      }),
    );
  };

  const poSubtotal = poItems.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  // ── Handle create / update purchase ──────────────────────────────────

  const handleSavePurchase = async () => {
    if (poItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    const invalidItems = poItems.filter((i) => !i.product_name || i.quantity <= 0 || i.unit_cost <= 0);
    if (invalidItems.length > 0) {
      toast.error('Fill in all item details (name, quantity, cost)');
      return;
    }

    setIsCreating(true);
    try {
      if (editingPurchaseId) {
        // ── Update existing purchase ──
        await updatePurchase(
          editingPurchaseId,
          poSupplierId || null,
          poItems.map(({ _key, ...rest }) => rest),
          { notes: poNotes || undefined, reference: poReference || undefined },
        );
        toast.success('Purchase order updated');
      } else {
        // ── Create new ──
        await createPurchase(
          poSupplierId || null,
          poItems.map(({ _key, ...rest }) => rest),
          {
            notes: poNotes || undefined,
            reference: poReference || undefined,
            receivedImmediately: poReceiveNow,
          },
        );
        if (poReceiveNow) {
          await refetchProducts();
        }
        toast.success(
          poReceiveNow
            ? 'Purchase created and stock updated!'
            : 'Purchase order created',
        );
      }
      resetPoForm();
      setShowPoDialog(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save purchase');
    } finally {
      setIsCreating(false);
    }
  };

  const resetPoForm = () => {
    setEditingPurchaseId(null);
    setPoSupplierId('');
    setPoReference('');
    setPoNotes('');
    setPoReceiveNow(false);
    setPoItems([]);
    setNextKey(1);
  };

  const openNewPurchase = () => {
    resetPoForm();
    setShowPoDialog(true);
  };

  const openPurchaseWithDraft = (draftItems: ReturnType<typeof consumePurchaseDraft>) => {
    resetPoForm();
    const items = draftItems.map((item, idx) => ({
      _key: idx + 1,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      quantity: item.quantity,
      unit_cost: item.unit_cost > 0 ? item.unit_cost : 0,
    }));
    setPoItems(items);
    setNextKey(items.length + 1);
    setPoNotes('Restock from dashboard stock alerts');
    setShowPoDialog(true);
    toast.success(`Loaded ${items.length} item${items.length === 1 ? '' : 's'} from stock alerts`);
  };

  useEffect(() => {
    const draftItems = consumePurchaseDraft();
    if (draftItems.length > 0) {
      openPurchaseWithDraft(draftItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const openEditPurchase = (po: (typeof purchases)[0]) => {
    setEditingPurchaseId(po.id);
    setPoSupplierId(po.supplier_id || '');
    setPoReference(po.reference || '');
    setPoNotes(po.notes || '');
    setPoReceiveNow(false);
    // Populate items from the existing purchase
    const items = (po.items || []).map((item, idx) => ({
      _key: idx + 1,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    }));
    setPoItems(items);
    setNextKey(items.length + 1);
    setViewPurchase(null); // Close detail dialog if open
    setShowPoDialog(true);
  };

  // ── Handle receive purchase ───────────────────────────────────────────

  const handleReceive = async (purchaseId: string) => {
    setIsReceiving(true);
    try {
      await receivePurchase(purchaseId);
      await refetchProducts();
      toast.success('Purchase received — stock updated!');
      setViewPurchase(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to receive purchase');
    } finally {
      setIsReceiving(false);
    }
  };

  // ── Handle cancel purchase ────────────────────────────────────────────

  const handleCancel = async (purchaseId: string) => {
    setIsCancelling(true);
    try {
      await cancelPurchase(purchaseId);
      toast.success('Purchase cancelled');
      setViewPurchase(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel purchase');
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Handle delete purchase ────────────────────────────────────────────

  const handleDeletePurchase = async () => {
    if (!deletingPurchaseId) return;
    setIsDeleting(true);
    try {
      await deletePurchase(deletingPurchaseId);
      toast.success('Purchase deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete purchase');
    } finally {
      setIsDeleting(false);
      setDeletingPurchaseId(null);
    }
  };

  // ── Handle save supplier ──────────────────────────────────────────────

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    setIsSavingSupplier(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: supplierForm.name,
          contact_person: supplierForm.contact_person || null,
          email: supplierForm.email || null,
          phone: supplierForm.phone || null,
          address: supplierForm.address || null,
          city: supplierForm.city || null,
          country: supplierForm.country || null,
          notes: supplierForm.notes || null,
        });
        toast.success('Supplier updated');
      } else {
        await addSupplier({
          name: supplierForm.name,
          contact_person: supplierForm.contact_person || null,
          email: supplierForm.email || null,
          phone: supplierForm.phone || null,
          address: supplierForm.address || null,
          city: supplierForm.city || null,
          country: supplierForm.country || null,
          status: 'active',
          notes: supplierForm.notes || null,
        });
        toast.success('Supplier added');
      }
      setShowSupplierDialog(false);
      setEditingSupplier(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save supplier');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const openAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'USA',
      notes: '',
    });
    setShowSupplierDialog(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      country: supplier.country || 'USA',
      notes: supplier.notes || '',
    });
    setShowSupplierDialog(true);
  };

  // ── Handle delete supplier ────────────────────────────────────────────

  const handleDeleteSupplier = async () => {
    if (!deletingSupplierId) return;
    setIsDeletingSupplier(true);
    try {
      await deleteSupplier(deletingSupplierId);
      toast.success('Supplier deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete supplier');
    } finally {
      setIsDeletingSupplier(false);
      setDeletingSupplierId(null);
    }
  };

  // ── Purchase summary stats ────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = purchases.length;
    const draft = purchases.filter((p) => p.status === 'draft').length;
    const received = purchases.filter((p) => p.status === 'received').length;
    const outstandingValue = purchases
      .filter((p) => p.status === 'draft')
      .reduce((s, p) => s + p.total, 0);
    const receivedValue = purchases
      .filter((p) => p.status === 'received')
      .reduce((s, p) => s + p.total, 0);
    return { total, draft, received, outstandingValue, receivedValue };
  }, [purchases]);

  const topSuppliers = useMemo(() => {
    const totals = new Map<string, number>();
    purchases
      .filter((p) => p.status === 'received')
      .forEach((p) => {
        const name = p.supplier_name || 'Unknown supplier';
        totals.set(name, (totals.get(name) || 0) + p.total);
      });
    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [purchases]);

  const monthlySpend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    return months.map((monthStart) => {
      const total = purchases
        .filter((p) => p.status === 'received' && isSameMonth(new Date(p.order_date), monthStart))
        .reduce((s, p) => s + p.total, 0);
      return { month: format(monthStart, 'MMM'), spend: total };
    });
  }, [purchases]);

  const recentActivity = useMemo(() => {
    return [...purchases]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6);
  }, [purchases]);

  const topSupplierMax = topSuppliers[0]?.total || 1;

  // ── RENDER ────────────────────────────────────────────────────────────

  return (
    <PageLayout activeTab="purchases" onNavigate={onNavigate}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
            Purchases
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage supplier orders and restock inventory
          </p>
        </div>
        <Button onClick={openNewPurchase}>
          <Plus className="w-4 h-4 mr-2" />
          New Purchase
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
            <p className="text-2xl font-bold tabular-nums truncate">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Pending</p>
            <p className="text-2xl font-bold text-warning tabular-nums truncate">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Received</p>
            <p className="text-2xl font-bold text-success tabular-nums truncate">{stats.received}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Outstanding Value</p>
            <p className="text-2xl font-bold text-warning tabular-nums truncate">
              {formatCurrency(stats.outstandingValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Orders / Suppliers */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="orders" className="gap-1.5">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Purchase Orders</span>
              <span className="sm:hidden">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-1.5">
              <Users className="w-4 h-4" />
              Suppliers
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════════════ Purchase Orders Tab ═══════════════════════════ */}
        <TabsContent value="orders" className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search PO, supplier, reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="last7">Last 7 days</SelectItem>
                <SelectItem value="last30">Last 30 days</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Pending</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders table */}
          <Card>
            <CardContent className="p-0">
              {purchasesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading purchases...</p>
                  </div>
                </div>
              ) : filteredPurchases.length === 0 ? (
                <div className="text-center py-20">
                  <Truck className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                  <p className="text-muted-foreground">No purchase orders found</p>
                  <Button variant="outline" className="mt-4" onClick={openNewPurchase}>
                    Create your first purchase
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('purchase_number')}>
                            PO No <SortIcon column="purchase_number" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('supplier')}>
                            Supplier <SortIcon column="supplier" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('date')}>
                            Date <SortIcon column="date" />
                          </button>
                        </TableHead>
                        <TableHead className="text-center">
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground mx-auto" onClick={() => toggleSort('items')}>
                            Items <SortIcon column="items" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('status')}>
                            Status <SortIcon column="status" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => toggleSort('total')}>
                            Total <SortIcon column="total" />
                          </button>
                        </TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPurchases.map((po) => {
                        const style = statusStyles[po.status] || statusStyles.draft;
                        return (
                          <TableRow key={po.id} className="cursor-pointer" onClick={() => setViewPurchase(po)}>
                            <TableCell className="font-semibold">{po.purchase_number}</TableCell>
                            <TableCell className="max-w-[180px] truncate">
                              {po.supplier_name || '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(po.order_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {(po.items || []).length}
                            </TableCell>
                            <TableCell>
                              <Badge variant={style.variant}>{style.tableLabel}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatCurrency(po.total)}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-0.5">
                                <Button size="sm" variant="ghost" onClick={() => setViewPurchase(po)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openEditPurchase(po)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => setDeletingPurchaseId(po.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="p-4 border-t">
                    <PaginationControls
                      currentPage={poPage}
                      totalPages={poTotalPages}
                      totalItems={filteredPurchases.length}
                      pageSize={poPageSize}
                      onPageChange={setPoPage}
                      onPageSizeChange={(size) => { setPoPageSize(size); setPoPage(1); }}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Suppliers</CardTitle>
                <CardDescription>By received spend</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topSuppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No received purchases yet</p>
                ) : (
                  topSuppliers.map((s) => (
                    <div key={s.name} className="space-y-1">
                      <div className="flex justify-between text-sm gap-2">
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="tabular-nums text-muted-foreground shrink-0">
                          {formatCurrency(s.total)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.max(4, (s.total / topSupplierMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly Spend</CardTitle>
                <CardDescription>Received orders, last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={spendChartConfig} className="h-[220px] w-full">
                  <BarChart data={monthlySpend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      width={36}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                      }
                    />
                    <Bar dataKey="spend" fill="var(--color-spend)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest purchase updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                ) : (
                  recentActivity.map((po) => {
                    const style = statusStyles[po.status] || statusStyles.draft;
                    return (
                      <button
                        key={po.id}
                        type="button"
                        className="w-full flex items-start gap-3 text-left rounded-md p-2 hover:bg-muted/50 transition-colors"
                        onClick={() => setViewPurchase(po)}
                      >
                        <div className="mt-0.5 p-1.5 rounded-md bg-muted shrink-0">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {po.purchase_number}
                            {po.supplier_name ? ` · ${po.supplier_name}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {style.tableLabel} · {formatCurrency(po.total)} ·{' '}
                            {format(new Date(po.updated_at), 'dd MMM yyyy')}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Suppliers Tab ═════════════════════════════════ */}
        <TabsContent value="suppliers">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button size="sm" onClick={openAddSupplier}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Supplier
            </Button>
          </div>

          {suppliersLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading suppliers...</p>
              </div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">No suppliers found</p>
              <Button variant="outline" className="mt-4" onClick={openAddSupplier}>
                Add your first supplier
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSuppliers.map((supplier) => (
                <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">
                          {supplier.name}
                        </p>
                        {supplier.contact_person && (
                          <p className="text-sm text-muted-foreground truncate">
                            {supplier.contact_person}
                          </p>
                        )}
                        <div className="flex flex-col gap-0.5 mt-2 text-xs text-muted-foreground">
                          {supplier.phone && <span>📞 {supplier.phone}</span>}
                          {supplier.email && <span>✉️ {supplier.email}</span>}
                          {supplier.city && <span>📍 {supplier.city}{supplier.country ? `, ${supplier.country}` : ''}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditSupplier(supplier)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeletingSupplierId(supplier.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ════════════════════ New / Edit Purchase Dialog ═══════════════════════ */}
      <Dialog open={showPoDialog} onOpenChange={(open) => { if (!open) { setShowPoDialog(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPurchaseId ? 'Edit Purchase Order' : 'New Purchase Order'}</DialogTitle>
            <DialogDescription>
              {editingPurchaseId
                ? 'Update the purchase order details and items'
                : 'Record a purchase from a supplier to restock inventory'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Supplier + Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Supplier</Label>
                <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select supplier (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference / Invoice #</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. SUP-INV-1234"
                  value={poReference}
                  onChange={(e) => setPoReference(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Input
                className="mt-1"
                placeholder="Optional notes..."
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
              />
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Items</Label>
                <Button size="sm" variant="outline" onClick={addPoItem}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Item
                </Button>
              </div>

              {poItems.length === 0 ? (
                <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No items yet — click "Add Item" to begin</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Desktop header */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase px-1">
                    <div className="col-span-5">Product</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-2">Unit Cost</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-1" />
                  </div>

                  {poItems.map((item) => (
                    <div
                      key={item._key}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 rounded-lg border bg-card"
                    >
                      {/* Product select */}
                      <div className="sm:col-span-5">
                        <Label className="sm:hidden text-xs mb-1 block">Product</Label>
                        <Select
                          value={item.product_id || ''}
                          onValueChange={(val) => updatePoItem(item._key, 'product_id', val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {retailProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2">
                        <Label className="sm:hidden text-xs mb-1 block">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updatePoItem(item._key, 'quantity', parseInt(e.target.value) || 0)
                          }
                        />
                      </div>

                      {/* Unit cost */}
                      <div className="sm:col-span-2">
                        <Label className="sm:hidden text-xs mb-1 block">Unit Cost</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) =>
                            updatePoItem(item._key, 'unit_cost', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>

                      {/* Line total */}
                      <div className="sm:col-span-2 text-right min-w-0">
                        <Label className="sm:hidden text-xs mb-1 block">Total</Label>
                        <p className="text-sm font-semibold py-2 tabular-nums truncate">
                          {formatCurrency(item.quantity * item.unit_cost)}
                        </p>
                      </div>

                      {/* Remove */}
                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive h-8 w-8 p-0"
                          onClick={() => removePoItem(item._key)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Subtotal */}
                  <div className="flex justify-end pr-12 pt-2 border-t">
                    <div className="text-right min-w-0">
                      <p className="text-sm text-muted-foreground">Subtotal</p>
                      <p className="text-lg font-bold tabular-nums">
                        {formatCurrency(poSubtotal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Receive immediately toggle (only for new purchases) */}
            {!editingPurchaseId && (
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={poReceiveNow}
                  onChange={(e) => setPoReceiveNow(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <div>
                  <p className="text-sm font-medium">Receive immediately</p>
                  <p className="text-xs text-muted-foreground">
                    Stock will be updated right away
                  </p>
                </div>
              </label>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowPoDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSavePurchase}
              disabled={isCreating || poItems.length === 0}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {editingPurchaseId ? 'Saving…' : 'Creating…'}
                </>
              ) : editingPurchaseId ? (
                'Save Changes'
              ) : poReceiveNow ? (
                'Create & Receive'
              ) : (
                'Create Purchase Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════ View Purchase Detail Dialog ═════════════════════ */}
      <Dialog open={!!viewPurchase} onOpenChange={(open) => { if (!open) setViewPurchase(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {viewPurchase && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewPurchase.purchase_number}
                  <Badge variant={statusStyles[viewPurchase.status]?.variant || 'secondary'}>
                    {statusStyles[viewPurchase.status]?.label || viewPurchase.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {viewPurchase.supplier_name && `Supplier: ${viewPurchase.supplier_name} • `}
                  {format(new Date(viewPurchase.order_date), 'MMM dd, yyyy h:mm a')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Reference */}
                {viewPurchase.reference && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reference: </span>
                    <span className="font-medium">{viewPurchase.reference}</span>
                  </div>
                )}

                {/* Items */}
                <div>
                  <p className="text-sm font-medium mb-2">Items</p>
                  <div className="border rounded-lg divide-y">
                    {(viewPurchase.items || []).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                          {item.product_sku && (
                            <p className="text-xs text-muted-foreground font-mono truncate">{item.product_sku}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium tabular-nums whitespace-nowrap">
                            {formatCurrency(item.line_total)}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {item.quantity.toLocaleString()} × {formatCurrency(item.unit_cost)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center gap-4 p-3 rounded-lg bg-muted">
                  <span className="font-medium shrink-0">Total</span>
                  <span className="text-lg font-bold tabular-nums text-right">
                    {formatCurrency(viewPurchase.total)}
                  </span>
                </div>

                {/* Notes */}
                {viewPurchase.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes: </span>
                    <span>{viewPurchase.notes}</span>
                  </div>
                )}

                {/* Received date */}
                {viewPurchase.received_date && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Received: </span>
                    <span className="font-medium">
                      {format(new Date(viewPurchase.received_date), 'MMM dd, yyyy h:mm a')}
                    </span>
                  </div>
                )}

                {/* Staff */}
                {viewPurchase.staff_name && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Created by: </span>
                    <span>{viewPurchase.staff_name}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
                {/* Cancel — only for draft orders */}
                {viewPurchase.status === 'draft' && (
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={() => handleCancel(viewPurchase.id)}
                    disabled={isReceiving || isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Cancelling…
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel Order
                      </>
                    )}
                  </Button>
                )}

                {/* Delete */}
                <Button
                  variant="outline"
                  className="w-full sm:w-auto text-destructive hover:text-destructive"
                  onClick={() => { setViewPurchase(null); setDeletingPurchaseId(viewPurchase.id); }}
                  disabled={isReceiving || isCancelling}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>

                {/* Edit — available for all statuses */}
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => openEditPurchase(viewPurchase)}
                  disabled={isReceiving || isCancelling}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>

                {/* Receive — only for draft orders */}
                {viewPurchase.status === 'draft' && (
                  <Button
                    className="w-full sm:w-auto bg-success hover:bg-success/90"
                    onClick={() => handleReceive(viewPurchase.id)}
                    disabled={isReceiving || isCancelling}
                  >
                    {isReceiving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Receiving…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Mark as Received
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════ Supplier Dialog ═════════════════════════════════ */}
      <Dialog open={showSupplierDialog} onOpenChange={(open) => { if (!open) setShowSupplierDialog(false); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier ? 'Update supplier details' : 'Add a new supplier to your list'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="sup-name">Name *</Label>
              <Input
                id="sup-name"
                className="mt-1"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Supplier name"
              />
            </div>
            <div>
              <Label htmlFor="sup-contact">Contact Person</Label>
              <Input
                id="sup-contact"
                className="mt-1"
                value={supplierForm.contact_person}
                onChange={(e) => setSupplierForm((f) => ({ ...f, contact_person: e.target.value }))}
                placeholder="Contact name"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sup-email">Email</Label>
                <Input
                  id="sup-email"
                  className="mt-1"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label htmlFor="sup-phone">Phone</Label>
                <Input
                  id="sup-phone"
                  className="mt-1"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 (555) ..."
                />
              </div>
            </div>
            <div>
              <Label htmlFor="sup-address">Address</Label>
              <Input
                id="sup-address"
                className="mt-1"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sup-city">City</Label>
                <Input
                  id="sup-city"
                  className="mt-1"
                  value={supplierForm.city}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="sup-country">Country</Label>
                <Input
                  id="sup-country"
                  className="mt-1"
                  value={supplierForm.country}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, country: e.target.value }))}
                  placeholder="Country"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="sup-notes">Notes</Label>
              <Input
                id="sup-notes"
                className="mt-1"
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowSupplierDialog(false)}
              disabled={isSavingSupplier}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveSupplier}
              disabled={isSavingSupplier}
            >
              {isSavingSupplier ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : editingSupplier ? (
                'Save Changes'
              ) : (
                'Add Supplier'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════ Delete Purchase Confirm ═════════════════════════ */}
      <AlertDialog open={!!deletingPurchaseId} onOpenChange={(open) => { if (!open) setDeletingPurchaseId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePurchase}
              className="bg-destructive hover:bg-destructive/90"
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════════════ Delete Supplier Confirm ═════════════════════════ */}
      <AlertDialog open={!!deletingSupplierId} onOpenChange={(open) => { if (!open) setDeletingSupplierId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier? Existing purchases linked to this supplier will keep their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSupplier}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplier}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeletingSupplier}
            >
              {isDeletingSupplier ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
