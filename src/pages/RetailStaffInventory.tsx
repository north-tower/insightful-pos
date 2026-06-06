import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  Loader2,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLayout } from '@/components/pos/PageLayout';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/hooks/useProducts';
import { toast } from 'sonner';
import { format, isValid, parseISO } from 'date-fns';
import { fc } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  enqueueOperation,
  getPendingOperations,
  markOperationFailed,
  markOperationSynced,
  updateOperationStatus,
} from '@/lib/offline/outbox';

interface RetailStaffInventoryProps {
  onNavigate: (tab: string) => void;
}

interface AllocationFormLine {
  id: string;
  productId: string;
  qty: string;
}

interface AssignmentBatch {
  id: string;
  cashier_id: string;
  assignment_date: string;
  route_name: string;
  is_active: boolean;
  created_at?: string;
}

interface CashierAllocationRow {
  id: string;
  cashier_id: string;
  product_id: string;
  assigned_qty: number;
  sold_qty: number;
  is_active: boolean;
  created_at?: string;
  assignment_id?: string | null;
}

interface AssignBatchPayload {
  storeId: string;
  cashierId: string;
  assignmentDate: string;
  routeName: string;
  assignedBy?: string;
  products: Array<{ productId: string; qty: number }>;
}

function todayIsoDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function newAllocationFormLine(): AllocationFormLine {
  return { id: crypto.randomUUID(), productId: '', qty: '' };
}

function formatAssignmentDay(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = parseISO(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  return isValid(d) ? format(d, 'dd MMM yyyy') : '—';
}

function sumAssignmentValueKes(
  lines: CashierAllocationRow[],
  products: Product[],
): number {
  return lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.product_id);
    return sum + line.assigned_qty * Number(product?.price ?? 0);
  }, 0);
}

export default function RetailStaffInventory({ onNavigate }: RetailStaffInventoryProps) {
  const { user } = useAuth();
  const { retailProducts, refetch: refetchProducts } = useProducts();

  const [staffAllocations, setStaffAllocations] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [assignmentBatches, setAssignmentBatches] = useState<AssignmentBatch[]>([]);
  const [allocations, setAllocations] = useState<CashierAllocationRow[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(todayIsoDate);
  const [routeName, setRouteName] = useState('');
  const [allocationLines, setAllocationLines] = useState<AllocationFormLine[]>(() => [
    newAllocationFormLine(),
  ]);
  const [isAssigning, setIsAssigning] = useState(false);

  const getMainStock = (product: Product) => product.mainStock ?? product.stock;

  const assignmentDraftTotalKes = useMemo(() => {
    const merged = new Map<string, number>();
    for (const line of allocationLines) {
      if (!line.productId.trim()) continue;
      const q = parseInt(line.qty, 10);
      if (Number.isNaN(q) || q < 0) continue;
      merged.set(line.productId, (merged.get(line.productId) ?? 0) + q);
    }
    let total = 0;
    let hasPositive = false;
    for (const [pid, q] of merged) {
      if (q <= 0) continue;
      hasPositive = true;
      const p = retailProducts.find((x) => x.id === pid);
      if (p) total += q * p.price;
    }
    return hasPositive ? total : null;
  }, [allocationLines, retailProducts]);

  const assignmentHistory = useMemo(() => {
    const linesByAssignment = new Map<string, CashierAllocationRow[]>();
    for (const row of allocations) {
      const key = row.assignment_id || `legacy-${row.id}`;
      const list = linesByAssignment.get(key) ?? [];
      list.push(row);
      linesByAssignment.set(key, list);
    }

    const knownBatchIds = new Set(assignmentBatches.map((b) => b.id));
    const entries = assignmentBatches.map((batch) => {
      const lines = linesByAssignment.get(batch.id) ?? [];
      return {
        id: batch.id,
        cashierId: batch.cashier_id,
        assignmentDate: batch.assignment_date,
        routeName: batch.route_name,
        isActive: batch.is_active,
        createdAt: batch.created_at ?? '',
        lines,
        totalValueKes: sumAssignmentValueKes(lines, retailProducts),
        isPending: batch.id.startsWith('local-assignment-'),
      };
    });

    for (const [key, lines] of linesByAssignment) {
      if (knownBatchIds.has(key) || !key.startsWith('legacy-')) continue;
      const first = lines[0];
      entries.push({
        id: key,
        cashierId: first.cashier_id,
        assignmentDate: first.created_at?.slice(0, 10) ?? '',
        routeName: 'Unspecified route',
        isActive: lines.some((line) => line.is_active),
        createdAt: first.created_at ?? '',
        lines,
        totalValueKes: sumAssignmentValueKes(lines, retailProducts),
        isPending: first.id.startsWith('local-allocation-'),
      });
    }

    return entries
      .sort((a, b) => {
        const da = a.assignmentDate ? parseISO(`${a.assignmentDate}T00:00:00`) : null;
        const db = b.assignmentDate ? parseISO(`${b.assignmentDate}T00:00:00`) : null;
        const ta = da && isValid(da) ? da.getTime() : 0;
        const tb = db && isValid(db) ? db.getTime() : 0;
        if (tb !== ta) return tb - ta;
        const ca = a.createdAt ? parseISO(a.createdAt) : null;
        const cb = b.createdAt ? parseISO(b.createdAt) : null;
        return (cb && isValid(cb) ? cb.getTime() : 0) - (ca && isValid(ca) ? ca.getTime() : 0);
      })
      .slice(0, 10);
  }, [allocations, assignmentBatches, retailProducts]);

  const staffAllocationReport = useMemo(() => {
    const batchMap = new Map(assignmentBatches.map((b) => [b.id, b]));
    const grouped = new Map<string, {
      cashierName: string;
      cashierEmail: string;
      assigned: number;
      sold: number;
      remaining: number;
      assignedValueKes: number;
      soldValueKes: number;
      remainingValueKes: number;
      assignments: Array<{
        assignmentId: string;
        assignmentDate: string;
        routeName: string;
        isActive: boolean;
        assigned: number;
        sold: number;
        remaining: number;
        assignedValueKes: number;
        soldValueKes: number;
        remainingValueKes: number;
        lines: Array<{
          allocationId: string;
          productName: string;
          assigned: number;
          sold: number;
          remaining: number;
          isActive: boolean;
          unitPrice: number;
        }>;
      }>;
    }>();

    allocations.forEach((a) => {
      const cashier = staffAllocations.find((c) => c.id === a.cashier_id);
      const product = retailProducts.find((p) => p.id === a.product_id);
      const remaining = Math.max(a.assigned_qty - a.sold_qty, 0);
      const unitPrice = Number(product?.price ?? 0);
      const staffKey = a.cashier_id;
      const batch = a.assignment_id ? batchMap.get(a.assignment_id) : undefined;
      const assignmentKey = a.assignment_id || `legacy-${a.id}`;

      const staffEntry = grouped.get(staffKey) || {
        cashierName: cashier?.full_name || 'Unknown staff',
        cashierEmail: cashier?.email || '',
        assigned: 0,
        sold: 0,
        remaining: 0,
        assignedValueKes: 0,
        soldValueKes: 0,
        remainingValueKes: 0,
        assignments: [],
      };

      staffEntry.assigned += a.assigned_qty;
      staffEntry.sold += a.sold_qty;
      staffEntry.remaining += remaining;
      staffEntry.assignedValueKes += a.assigned_qty * unitPrice;
      staffEntry.soldValueKes += a.sold_qty * unitPrice;
      staffEntry.remainingValueKes += remaining * unitPrice;

      let assignmentEntry = staffEntry.assignments.find((entry) => entry.assignmentId === assignmentKey);
      if (!assignmentEntry) {
        assignmentEntry = {
          assignmentId: assignmentKey,
          assignmentDate: batch?.assignment_date || a.created_at?.slice(0, 10) || '',
          routeName: batch?.route_name || 'Unspecified route',
          isActive: false,
          assigned: 0,
          sold: 0,
          remaining: 0,
          assignedValueKes: 0,
          soldValueKes: 0,
          remainingValueKes: 0,
          lines: [],
        };
        staffEntry.assignments.push(assignmentEntry);
      }

      assignmentEntry.assigned += a.assigned_qty;
      assignmentEntry.sold += a.sold_qty;
      assignmentEntry.remaining += remaining;
      assignmentEntry.assignedValueKes += a.assigned_qty * unitPrice;
      assignmentEntry.soldValueKes += a.sold_qty * unitPrice;
      assignmentEntry.remainingValueKes += remaining * unitPrice;
      assignmentEntry.isActive = assignmentEntry.isActive || a.is_active;
      assignmentEntry.lines.push({
        allocationId: a.id,
        productName: product?.name || a.product_id,
        assigned: a.assigned_qty,
        sold: a.sold_qty,
        remaining,
        isActive: a.is_active,
        unitPrice,
      });

      grouped.set(staffKey, staffEntry);
    });

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        assignments: [...entry.assignments].sort((a, b) => {
          const da = a.assignmentDate ? parseISO(`${a.assignmentDate}T00:00:00`) : null;
          const db = b.assignmentDate ? parseISO(`${b.assignmentDate}T00:00:00`) : null;
          const ta = da && isValid(da) ? da.getTime() : 0;
          const tb = db && isValid(db) ? db.getTime() : 0;
          return tb - ta;
        }),
      }))
      .sort((a, b) => a.cashierName.localeCompare(b.cashierName));
  }, [allocations, staffAllocations, retailProducts, assignmentBatches]);

  const loadCashierData = useCallback(async () => {
    const { data: storeData } = await supabase.rpc('current_store_id');
    let resolvedStoreId: string | null = storeData || null;

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
      setAssignmentBatches([]);
      setAllocations([]);
      return;
    }
    setStoreId(resolvedStoreId);

    const [cashierRes, batchRes, allocationRes] = await Promise.all([
      supabase
        .from('profile_stores')
        .select('profile_id')
        .eq('store_id', resolvedStoreId)
        .in('role_in_store', ['cashier', 'manager']),
      supabase
        .from('staff_inventory_assignments')
        .select('id, cashier_id, assignment_date, route_name, is_active, created_at')
        .eq('store_id', resolvedStoreId)
        .order('assignment_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('cashier_stock_allocations')
        .select(
          'id, cashier_id, product_id, assigned_qty, sold_qty, is_active, created_at, assignment_id',
        )
        .eq('store_id', resolvedStoreId)
        .order('created_at', { ascending: false }),
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
          mapped = cashierIds.map((id) => ({
            id,
            full_name: id,
            email: '',
          }));
        }
      }

      setStaffAllocations(mapped);
    }

    if (!batchRes.error) {
      setAssignmentBatches(batchRes.data || []);
    }

    if (!allocationRes.error) {
      setAllocations(allocationRes.data || []);
    }
  }, [user?.id]);

  const insertAllocationLines = useCallback(
    async (
      staffId: string,
      assignmentId: string,
      products: Array<{ productId: string; qty: number }>,
    ) => {
      if (!storeId) throw new Error('No store selected');

      for (const { productId, qty } of products) {
        if (!Number.isInteger(qty) || qty < 0) {
          throw new Error('Enter a valid quantity');
        }

        const { data: activeAllocation, error: activeLookupError } = await supabase
          .from('cashier_stock_allocations')
          .select('id')
          .eq('store_id', storeId)
          .eq('cashier_id', staffId)
          .eq('product_id', productId)
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

        const { error } = await supabase.from('cashier_stock_allocations').insert([
          {
            store_id: storeId,
            cashier_id: staffId,
            product_id: productId,
            assigned_qty: qty,
            assigned_by: user?.id,
            is_active: true,
            assignment_id: assignmentId,
          },
        ]);

        if (error) throw error;
      }
    },
    [storeId, user?.id],
  );

  const assignBatchRemote = useCallback(
    async (payload: AssignBatchPayload) => {
      const trimmedRoute = payload.routeName.trim();
      if (!trimmedRoute) throw new Error('Enter a route name');
      if (!payload.assignmentDate) throw new Error('Select an assignment date');
      if (payload.products.length === 0) throw new Error('Add at least one product');

      const { data: batch, error: batchError } = await supabase
        .from('staff_inventory_assignments')
        .insert([{
          store_id: payload.storeId,
          cashier_id: payload.cashierId,
          assignment_date: payload.assignmentDate,
          route_name: trimmedRoute,
          assigned_by: payload.assignedBy || null,
        }])
        .select('id')
        .single();

      if (batchError) throw batchError;

      await insertAllocationLines(payload.cashierId, batch.id, payload.products);
      return batch.id;
    },
    [insertAllocationLines],
  );

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
        if (op.action === 'assign_batch') {
          const payload = op.payload as AssignBatchPayload;
          if (!payload?.storeId || !payload?.cashierId || !payload?.products?.length) {
            throw new Error('Invalid assign_batch payload');
          }
          await assignBatchRemote(payload);
        } else if (op.action === 'assign_stock') {
          const payload = op.payload as {
            storeId: string;
            cashierId: string;
            productId: string;
            qty: number;
            assignedBy?: string;
            assignmentDate?: string;
            routeName?: string;
          };
          if (!payload?.storeId || !payload?.cashierId || !payload?.productId) {
            throw new Error('Invalid assign_stock payload');
          }

          await assignBatchRemote({
            storeId: payload.storeId,
            cashierId: payload.cashierId,
            assignmentDate: payload.assignmentDate || todayIsoDate(),
            routeName: payload.routeName || 'Unspecified route',
            assignedBy: payload.assignedBy,
            products: [{ productId: payload.productId, qty: payload.qty }],
          });
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
  }, [assignBatchRemote, loadCashierData, returnAllocationRemote]);

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

  const handleAssignCashierStock = async () => {
    if (!storeId || !selectedStaffId) {
      toast.error('Select staff');
      return;
    }
    if (!assignmentDate) {
      toast.error('Select an assignment date');
      return;
    }
    const trimmedRoute = routeName.trim();
    if (!trimmedRoute) {
      toast.error('Enter a route name');
      return;
    }

    const merged = new Map<string, number>();
    for (const line of allocationLines) {
      const pid = line.productId.trim();
      if (!pid) continue;
      const q = parseInt(line.qty, 10);
      if (Number.isNaN(q) || q < 0) {
        toast.error('Enter a valid quantity on each line');
        return;
      }
      merged.set(pid, (merged.get(pid) ?? 0) + q);
    }

    const products = Array.from(merged.entries())
      .filter(([, q]) => q > 0)
      .map(([productId, qty]) => ({ productId, qty }));

    if (products.length === 0) {
      toast.error('Add at least one product with a quantity greater than 0');
      return;
    }

    for (const { productId, qty } of products) {
      const product = retailProducts.find((p) => p.id === productId);
      const available = product ? getMainStock(product) : 0;
      if (qty > available) {
        toast.error(
          `Insufficient main stock for ${product?.name || 'product'}. Available: ${available}, requested: ${qty}`,
        );
        return;
      }
    }

    setIsAssigning(true);
    try {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      const createdAt = new Date().toISOString();
      const batchPayload: AssignBatchPayload = {
        storeId,
        cashierId: selectedStaffId,
        assignmentDate,
        routeName: trimmedRoute,
        assignedBy: user?.id,
        products,
      };

      if (isOnline) {
        await assignBatchRemote(batchPayload);
      } else {
        const localBatchId = `local-assignment-${crypto.randomUUID()}`;
        let nextAllocations = [...allocations];

        for (const { productId, qty } of products) {
          nextAllocations = nextAllocations.map((a) =>
            a.cashier_id === selectedStaffId &&
            a.product_id === productId &&
            a.is_active
              ? { ...a, is_active: false }
              : a,
          );
          nextAllocations.unshift({
            id: `local-allocation-${crypto.randomUUID()}`,
            cashier_id: selectedStaffId,
            product_id: productId,
            assigned_qty: qty,
            sold_qty: 0,
            is_active: true,
            created_at: createdAt,
            assignment_id: localBatchId,
          });
        }

        setAssignmentBatches((prev) => [
          {
            id: localBatchId,
            cashier_id: selectedStaffId,
            assignment_date: assignmentDate,
            route_name: trimmedRoute,
            is_active: true,
            created_at: createdAt,
          },
          ...prev,
        ]);
        setAllocations(nextAllocations);

        await enqueueOperation({
          entity: 'cashier_stock_allocations',
          action: 'assign_batch',
          payload: batchPayload,
        });
      }

      toast.success(
        products.length === 1
          ? 'Route assignment saved'
          : `Route assignment saved with ${products.length} products`,
      );
      setAllocationLines([newAllocationFormLine()]);
      setRouteName('');
      setAssignmentDate(todayIsoDate());
      if (isOnline) {
        await Promise.all([loadCashierData(), refetchProducts()]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign staff stock');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReturnAllocation = async (allocationId: string) => {
    const allocation = allocations.find((a) => a.id === allocationId);
    const product = allocation
      ? retailProducts.find((p) => p.id === allocation.product_id)
      : undefined;
    const remainingUnits = allocation
      ? Math.max(allocation.assigned_qty - allocation.sold_qty, 0)
      : 0;
    const restoredValueKes = remainingUnits * Number(product?.price ?? 0);

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

      if (remainingUnits > 0) {
        toast.success(
          `${remainingUnits} unsold unit(s) returned to main inventory (${fc(restoredValueKes)})`,
        );
      } else {
        toast.success('Allocation closed — all units were already sold');
      }
      if (isOnline) {
        await Promise.all([loadCashierData(), refetchProducts()]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to return allocation');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <PageLayout activeTab="inventory-assign-staff" onNavigate={onNavigate}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Assign Staff Inventory
          </h1>
          <p className="text-muted-foreground">
            Assignments deduct stock and value from main inventory. Returns restore unsold units and value.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>New Route Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <Label>Assignment date</Label>
                <Input
                  type="date"
                  value={assignmentDate}
                  onChange={(e) => setAssignmentDate(e.target.value)}
                  className="mt-0"
                />
              </div>
              <div>
                <Label>Route name</Label>
                <Input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Westlands, CBD Morning"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-base">Products assigned</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setAllocationLines((prev) => [...prev, newAllocationFormLine()])
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add product
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add one or more product lines for this route. Duplicate products are combined when you save.
              </p>

              <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
                {allocationLines.map((line) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-2 items-end"
                  >
                    <div>
                      <Label className="text-xs text-muted-foreground sr-only sm:not-sr-only">
                        Product
                      </Label>
                      <Select
                        value={line.productId || undefined}
                        onValueChange={(v) =>
                          setAllocationLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id ? { ...l, productId: v } : l,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {retailProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} (Main: {getMainStock(p)}) · {fc(p.price)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground sr-only sm:not-sr-only">
                        Qty
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        className="h-9"
                        value={line.qty}
                        onChange={(e) =>
                          setAllocationLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id ? { ...l, qty: e.target.value } : l,
                            ),
                          )
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="flex justify-end sm:justify-center pb-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                        disabled={allocationLines.length <= 1}
                        onClick={() =>
                          setAllocationLines((prev) =>
                            prev.length <= 1 ? prev : prev.filter((l) => l.id !== line.id),
                          )
                        }
                        aria-label="Remove line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {assignmentDraftTotalKes != null && (
              <p className="text-sm text-muted-foreground tabular-nums">
                Assignment total: <span className="font-semibold text-foreground">{fc(assignmentDraftTotalKes)}</span>
              </p>
            )}

            <Button
              className="w-full sm:w-auto"
              onClick={handleAssignCashierStock}
              disabled={isAssigning}
            >
              {isAssigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save assignment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recent Route Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignmentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No route assignments yet.</p>
          ) : (
            assignmentHistory.map((batch) => {
              const cashier = staffAllocations.find((c) => c.id === batch.cashierId);
              return (
                <div key={batch.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {batch.routeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cashier?.full_name || cashier?.email || batch.cashierId}
                        {' · '}
                        {formatAssignmentDay(batch.assignmentDate)}
                      </p>
                      <p className="text-xs font-semibold text-foreground tabular-nums mt-1">
                        Total: {fc(batch.totalValueKes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {batch.isPending && (
                        <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                          Pending sync
                        </Badge>
                      )}
                      {!batch.isActive && (
                        <Badge variant="outline" className="text-[10px]">
                          Returned
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {batch.lines.map((line) => {
                      const product = retailProducts.find((p) => p.id === line.product_id);
                      const remaining = Math.max(line.assigned_qty - line.sold_qty, 0);
                      const unit = Number(product?.price ?? 0);
                      return (
                        <div
                          key={line.id}
                          className="text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded bg-muted/30 px-2 py-1.5"
                        >
                          <span className="font-medium text-foreground">
                            {product?.name || line.product_id}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground tabular-nums">
                              Assigned {line.assigned_qty} · Sold {line.sold_qty} · Remaining {remaining}
                              {' · '}
                              {fc(line.assigned_qty * unit)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={isAssigning || !line.is_active}
                              onClick={() => handleReturnAllocation(line.id)}
                            >
                              {line.is_active ? 'Return' : 'Returned'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Per-Staff Inventory Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {staffAllocationReport.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff inventory data yet.</p>
          ) : (
            staffAllocationReport.map((entry) => (
              <Collapsible
                key={`${entry.cashierName}-${entry.cashierEmail}`}
                defaultOpen={false}
                className="group rounded-md border border-border bg-card"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 p-3 text-left rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90 group-data-[state=open]:rotate-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {entry.cashierName}
                        </p>
                        {entry.cashierEmail && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.cashierEmail}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right tabular-nums shrink-0">
                      <p>
                        Assigned: {entry.assigned} · {fc(entry.assignedValueKes)}
                      </p>
                      <p>
                        Sold: {entry.sold} · {fc(entry.soldValueKes)}
                      </p>
                      <p className="font-semibold text-foreground">
                        Remaining: {entry.remaining} · {fc(entry.remainingValueKes)}
                      </p>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-border data-[state=closed]:animate-none">
                  <div className="p-3 pt-2 space-y-3">
                    {entry.assignments.map((assignment) => (
                      <div key={assignment.assignmentId} className="rounded-md border border-border/70 p-2 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{assignment.routeName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatAssignmentDay(assignment.assignmentDate)}
                            </p>
                          </div>
                          <p className="text-[10px] text-muted-foreground tabular-nums text-right">
                            <span className="block font-semibold text-foreground">
                              Total: {fc(assignment.assignedValueKes)}
                            </span>
                            <span className="block">
                              {assignment.assigned} assigned · {assignment.sold} sold · {assignment.remaining} remaining
                            </span>
                          </p>
                        </div>
                        <div className="space-y-1">
                          {assignment.lines.map((line) => (
                            <div
                              key={line.allocationId}
                              className="text-xs flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 rounded-md bg-muted/30 px-2 py-1.5"
                            >
                              <span className="text-foreground font-medium">{line.productName}</span>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-right shrink-0">
                                {line.allocationId.startsWith('local-allocation-') && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-warning/30 text-warning sm:self-end"
                                  >
                                    Pending sync
                                  </Badge>
                                )}
                                <span className="text-muted-foreground tabular-nums">
                                  <span className="block sm:inline">
                                    {line.assigned} / {line.sold} / {line.remaining} units
                                  </span>
                                  <span className="block sm:inline sm:ml-2 text-foreground font-medium">
                                    {fc(line.assigned * line.unitPrice)} / {fc(line.sold * line.unitPrice)} /{' '}
                                    {fc(line.remaining * line.unitPrice)}
                                  </span>
                                  {!line.isActive ? (
                                    <span className="block sm:inline sm:ml-1 text-muted-foreground">(returned)</span>
                                  ) : null}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
