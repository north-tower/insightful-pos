import { useState, useCallback } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import type { ShopDaySettlement } from '@/hooks/useShopDaySettlement';
import type { ExpensePaymentMethod } from '@/hooks/useOperatingExpenses';

export interface ShopDayExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  payment_method: ExpensePaymentMethod;
}

export interface ShopDayCreditLine {
  customerName: string;
  amount: number;
}

export interface ShopDaySalesBreakdown {
  cash: number;
  mpesa: number;
  bank: number;
  credit: number;
  totalCollected: number;
}

export interface ShopDayExpenseBreakdown {
  cash: number;
  mpesa: number;
  bank: number;
  total: number;
}

export interface ShopDayStockMovementLine {
  productId: string;
  productName: string;
  unit: string;
  opening: number | null;
  stockIn: number;
  sold: number;
  adjustmentsOut: number;
  closing: number | null;
}

export interface ShopDayExpected {
  cash: number;
  mpesa: number;
  bank: number;
}

export interface ShopDayReportData {
  storeId: string;
  storeName: string;
  businessDate: string;
  businessDateLabel: string;
  salesBreakdown: ShopDaySalesBreakdown;
  discountOut: number;
  refunds: number;
  expenses: ShopDayExpense[];
  expenseBreakdown: ShopDayExpenseBreakdown;
  outstandingCredit: ShopDayCreditLine[];
  totalOutstandingCredit: number;
  expected: ShopDayExpected;
  stockMovements: ShopDayStockMovementLine[];
  settlement: ShopDaySettlement | null;
}

function dayBoundsLocal(isoDate: string): { start: string; end: string } {
  return {
    start: new Date(`${isoDate}T00:00:00`).toISOString(),
    end: new Date(`${isoDate}T23:59:59.999`).toISOString(),
  };
}

function mapPaymentMethod(value: unknown): ExpensePaymentMethod {
  if (value === 'mpesa' || value === 'bank' || value === 'cash') return value;
  return 'cash';
}

function mapSettlement(row: Record<string, unknown>): ShopDaySettlement {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    business_date: row.business_date as string,
    opening_float: Number(row.opening_float ?? 0),
    closing_float: Number(row.closing_float ?? 0),
    expected_cash: Number(row.expected_cash ?? 0),
    expected_mpesa: Number(row.expected_mpesa ?? 0),
    expected_bank: Number(row.expected_bank ?? 0),
    cash_counted: Number(row.cash_counted ?? 0),
    mpesa_confirmed: Number(row.mpesa_confirmed ?? 0),
    bank_confirmed: Number(row.bank_confirmed ?? 0),
    cash_variance: Number(row.cash_variance ?? 0),
    mpesa_variance: Number(row.mpesa_variance ?? 0),
    bank_variance: Number(row.bank_variance ?? 0),
    notes: (row.notes as string) || null,
    is_finalized: Boolean(row.is_finalized),
    finalized_by: (row.finalized_by as string) || null,
    finalized_by_name: (row.finalized_by_name as string) || null,
    finalized_at: (row.finalized_at as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

const STOCK_IN_TYPES = new Set([
  'restock',
  'returned',
  'production_in',
  'staff_assign_return',
]);

const STOCK_OUT_TYPES = new Set([
  'damaged',
  'adjustment',
  'production_out',
  'staff_assign_out',
]);

export function useShopDayReport() {
  const { mode } = useBusinessMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (
      businessDate: string,
      floats?: { openingFloat: number; closingFloat: number },
    ): Promise<ShopDayReportData | null> => {
      setLoading(true);
      setError(null);

      try {
        const { data: storeIdData, error: storeIdErr } = await supabase.rpc('current_store_id');
        if (storeIdErr) throw storeIdErr;
        const storeId = storeIdData as string | null;
        if (!storeId) throw new Error('No store selected');

        const { data: storeRow } = await supabase
          .from('stores')
          .select('id, name')
          .eq('id', storeId)
          .maybeSingle();

        const { start, end } = dayBoundsLocal(businessDate);

        const orderSelect =
          'id, total, discount_amount, sale_type, customer_name, payment_status, created_at';

        const { data: completedOrders, error: ordersErr } = await supabase
          .from('orders')
          .select(orderSelect)
          .eq('store_id', storeId)
          .eq('business_mode', mode)
          .eq('status', 'completed')
          .not('payment_status', 'in', '("refunded","voided")')
          .gte('created_at', start)
          .lte('created_at', end);

        if (ordersErr) throw ordersErr;

        const { data: refundedOrders } = await supabase
          .from('orders')
          .select('id, total')
          .eq('store_id', storeId)
          .eq('business_mode', mode)
          .eq('payment_status', 'refunded')
          .gte('created_at', start)
          .lte('created_at', end);

        const linkedOrders = completedOrders || [];
        const orderIds = linkedOrders.map((o) => o.id);
        const refundTotal = (refundedOrders || []).reduce(
          (s, o) => s + Number(o.total ?? 0),
          0,
        );

        let cash = 0;
        let mpesa = 0;
        let bank = 0;
        const outstandingCredit: ShopDayCreditLine[] = [];

        if (orderIds.length > 0) {
          const { data: payments } = await supabase
            .from('payments')
            .select('order_id, method, amount')
            .in('order_id', orderIds);

          const paidByOrder = new Map<string, number>();

          for (const pay of payments || []) {
            const amt = Number(pay.amount ?? 0);
            paidByOrder.set(pay.order_id, (paidByOrder.get(pay.order_id) || 0) + amt);
            switch (pay.method) {
              case 'cash':
                cash += amt;
                break;
              case 'mpesa':
                mpesa += amt;
                break;
              case 'card':
              case 'qr':
                bank += amt;
                break;
              default:
                cash += amt;
            }
          }

          for (const order of linkedOrders) {
            if (order.sale_type !== 'credit') continue;
            const balance = Math.max(
              Number(order.total ?? 0) - (paidByOrder.get(order.id) || 0),
              0,
            );
            if (balance > 0) {
              outstandingCredit.push({
                customerName: order.customer_name || 'Credit customer',
                amount: balance,
              });
            }
          }
        }

        const discountOut = linkedOrders.reduce(
          (s, o) => s + Number(o.discount_amount ?? 0),
          0,
        );

        // Shop-counter expenses only (exclude route-linked expenses)
        const { data: expenseRows, error: expenseErr } = await supabase
          .from('operating_expenses')
          .select('id, description, category, amount, payment_method')
          .eq('store_id', storeId)
          .eq('business_mode', mode)
          .is('assignment_id', null)
          .gte('expense_date', start)
          .lte('expense_date', end)
          .order('expense_date', { ascending: true });

        if (expenseErr) throw expenseErr;

        const expenses: ShopDayExpense[] = (expenseRows || []).map((e) => ({
          id: e.id,
          description: e.description || e.category,
          category: e.category,
          amount: Number(e.amount),
          payment_method: mapPaymentMethod(e.payment_method),
        }));

        const expenseBreakdown: ShopDayExpenseBreakdown = { cash: 0, mpesa: 0, bank: 0, total: 0 };
        for (const e of expenses) {
          expenseBreakdown[e.payment_method] += e.amount;
          expenseBreakdown.total += e.amount;
        }

        const { data: settlementRow } = await supabase
          .from('shop_day_settlements')
          .select('*')
          .eq('store_id', storeId)
          .eq('business_date', businessDate)
          .maybeSingle();

        const settlement = settlementRow
          ? mapSettlement(settlementRow as Record<string, unknown>)
          : null;

        const openingFloat = floats?.openingFloat ?? settlement?.opening_float ?? 0;
        const closingFloat = floats?.closingFloat ?? settlement?.closing_float ?? 0;

        // Allocate refunds proportionally across channels with sales that day
        const collectedBeforeRefund = cash + mpesa + bank;
        let cashRefund = 0;
        let mpesaRefund = 0;
        let bankRefund = 0;
        if (refundTotal > 0 && collectedBeforeRefund > 0) {
          cashRefund = (cash / collectedBeforeRefund) * refundTotal;
          mpesaRefund = (mpesa / collectedBeforeRefund) * refundTotal;
          bankRefund = (bank / collectedBeforeRefund) * refundTotal;
        } else if (refundTotal > 0) {
          cashRefund = refundTotal;
        }

        const expected: ShopDayExpected = {
          cash: cash - expenseBreakdown.cash - cashRefund + openingFloat - closingFloat,
          mpesa: mpesa - expenseBreakdown.mpesa - mpesaRefund,
          bank: bank - expenseBreakdown.bank - bankRefund,
        };

        // ── Stock movement (system) ──────────────────────────────────────────
        const soldByProduct = new Map<string, number>();
        if (orderIds.length > 0) {
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('product_id, quantity')
            .in('order_id', orderIds);

          for (const item of orderItems || []) {
            if (!item.product_id) continue;
            soldByProduct.set(
              item.product_id,
              (soldByProduct.get(item.product_id) || 0) + Number(item.quantity ?? 0),
            );
          }
        }

        const { data: adjustments } = await supabase
          .from('stock_adjustments')
          .select('product_id, type, quantity, previous_stock, new_stock, created_at')
          .eq('store_id', storeId)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true });

        type AdjAgg = {
          stockIn: number;
          adjustmentsOut: number;
          opening: number | null;
          closing: number | null;
        };
        const adjByProduct = new Map<string, AdjAgg>();

        for (const adj of adjustments || []) {
          const pid = adj.product_id as string;
          const qty = Number(adj.quantity ?? 0);
          const type = adj.type as string;
          let row = adjByProduct.get(pid);
          if (!row) {
            row = {
              stockIn: 0,
              adjustmentsOut: 0,
              opening: Number(adj.previous_stock),
              closing: Number(adj.new_stock),
            };
            adjByProduct.set(pid, row);
          } else {
            row.closing = Number(adj.new_stock);
          }

          if (type === 'sold') {
            // Sold qty is taken from order_items to avoid double count
            continue;
          }
          if (STOCK_IN_TYPES.has(type) || qty > 0) {
            row.stockIn += Math.abs(qty);
          } else if (STOCK_OUT_TYPES.has(type) || qty < 0) {
            row.adjustmentsOut += Math.abs(qty);
          }
        }

        const productIds = Array.from(
          new Set([...soldByProduct.keys(), ...adjByProduct.keys()]),
        );

        const { data: products } = productIds.length
          ? await supabase
              .from('products')
              .select('id, name, unit, stock')
              .in('id', productIds)
          : { data: [] };

        const productMap = new Map(
          (products || []).map((p) => [
            p.id as string,
            {
              name: p.name as string,
              unit: (p.unit as string) || 'pcs',
              stock: Number(p.stock ?? 0),
            },
          ]),
        );

        const lookingAtToday = isToday(parseISO(`${businessDate}T12:00:00`));

        const stockMovements: ShopDayStockMovementLine[] = productIds
          .map((productId) => {
            const meta = productMap.get(productId);
            const adj = adjByProduct.get(productId);
            const sold = soldByProduct.get(productId) || 0;
            const stockIn = adj?.stockIn || 0;
            const adjustmentsOut = adj?.adjustmentsOut || 0;

            let opening = adj?.opening ?? null;
            let closing = adj?.closing ?? null;

            if (opening === null && closing === null && lookingAtToday && meta) {
              closing = meta.stock;
              opening = closing - stockIn + sold + adjustmentsOut;
            } else if (opening === null && closing !== null) {
              opening = closing - stockIn + sold + adjustmentsOut;
            } else if (closing === null && opening !== null) {
              closing = opening + stockIn - sold - adjustmentsOut;
            }

            return {
              productId,
              productName: meta?.name || productId,
              unit: meta?.unit || 'pcs',
              opening,
              stockIn,
              sold,
              adjustmentsOut,
              closing,
            };
          })
          .filter((line) => line.sold > 0 || line.stockIn > 0 || line.adjustmentsOut > 0)
          .sort((a, b) => b.sold - a.sold || a.productName.localeCompare(b.productName));

        const dateLabel = (() => {
          try {
            return format(parseISO(`${businessDate}T12:00:00`), 'EEEE dd/MM/yyyy').toUpperCase();
          } catch {
            return businessDate;
          }
        })();

        const totalOutstandingCredit = outstandingCredit.reduce((s, c) => s + c.amount, 0);

        return {
          storeId,
          storeName: storeRow?.name || 'Store',
          businessDate,
          businessDateLabel: dateLabel,
          salesBreakdown: {
            cash,
            mpesa,
            bank,
            credit: totalOutstandingCredit,
            totalCollected: cash + mpesa + bank,
          },
          discountOut,
          refunds: refundTotal,
          expenses,
          expenseBreakdown,
          outstandingCredit,
          totalOutstandingCredit,
          expected,
          stockMovements,
          settlement,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load shop day report';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [mode],
  );

  return { fetchReport, loading, error };
}
