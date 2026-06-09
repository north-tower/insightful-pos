import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';

export interface AssignmentReportProductLine {
  productId: string;
  productName: string;
  unit: string;
  packSize: string;
  quantity: number;
  salesWorkOut: number;
  returns: number;
  soldOut: number;
  moneyReceived: number;
}

export interface AssignmentReportExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
}

export interface AssignmentReportCreditLine {
  customerName: string;
  amount: number;
}

export interface AssignmentSalesBreakdown {
  cash: number;
  mpesa: number;
  directBank: number;
  credit: number;
  totalSales: number;
}

export interface AssignmentReportSettlement {
  id: string;
  expected_remittance: number;
  cash_submitted: number;
  mpesa_submitted: number;
  bank_submitted: number;
  variance: number;
  notes: string | null;
  is_finalized: boolean;
  finalized_by_name: string | null;
  finalized_at: string | null;
}

export interface AssignmentDailyReportData {
  assignmentId: string;
  routeName: string;
  assignmentDate: string;
  assignmentDateLabel: string;
  cashierName: string;
  products: AssignmentReportProductLine[];
  totals: {
    quantity: number;
    salesWorkOut: number;
    returns: number;
    soldOut: number;
    moneyReceived: number;
  };
  mostSoldProduct: { name: string; qty: number } | null;
  grandSalesPlusCredit: number;
  expenses: AssignmentReportExpense[];
  totalExpenses: number;
  discountOut: number;
  salesBreakdown: AssignmentSalesBreakdown;
  outstandingCredit: AssignmentReportCreditLine[];
  totalOutstandingCredit: number;
  totalCollectedExCredit: number;
  netAfterExpensesAndDiscount: number;
  settlement: AssignmentReportSettlement | null;
}

function dayBounds(isoDate: string) {
  const start = `${isoDate}T00:00:00.000Z`;
  const end = `${isoDate}T23:59:59.999Z`;
  return { start, end };
}

export function useAssignmentReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (assignmentId: string): Promise<AssignmentDailyReportData | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data: assignment, error: assignErr } = await supabase
        .from('staff_inventory_assignments')
        .select('id, cashier_id, assignment_date, route_name')
        .eq('id', assignmentId)
        .single();

      if (assignErr) throw assignErr;
      if (!assignment) throw new Error('Assignment not found');

      const { data: cashierProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', assignment.cashier_id)
        .maybeSingle();

      const { data: allocations, error: allocErr } = await supabase
        .from('cashier_stock_allocations')
        .select('product_id, assigned_qty, sold_qty')
        .eq('assignment_id', assignmentId);

      if (allocErr) throw allocErr;

      const productIds = Array.from(
        new Set((allocations || []).map((a) => a.product_id)),
      );

      const { data: products } = productIds.length
        ? await supabase
            .from('products')
            .select('id, name, price, unit')
            .in('id', productIds)
        : { data: [] };

      const productMap = new Map(
        (products || []).map((p) => [
          p.id,
          {
            name: p.name as string,
            price: Number(p.price ?? 0),
            unit: (p.unit as string) || 'pcs',
          },
        ]),
      );

      const { start, end } = dayBounds(assignment.assignment_date);

      const orderSelect =
        'id, total, discount_amount, sale_type, customer_name, payment_status';

      const { data: byAssignment, error: ordersErr } = await supabase
        .from('orders')
        .select(orderSelect)
        .eq('assignment_id', assignmentId)
        .eq('status', 'completed')
        .not('payment_status', 'in', '("refunded","voided")');

      if (ordersErr) throw ordersErr;

      let linkedOrders = byAssignment || [];

      if (linkedOrders.length === 0) {
        const { data: byStaffDay } = await supabase
          .from('orders')
          .select(orderSelect)
          .eq('staff_id', assignment.cashier_id)
          .gte('created_at', start)
          .lte('created_at', end)
          .eq('status', 'completed')
          .not('payment_status', 'in', '("refunded","voided")');
        linkedOrders = byStaffDay || [];
      }

      const orderIds = linkedOrders.map((o) => o.id);

      let moneyByProduct = new Map<string, number>();
      if (orderIds.length > 0) {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('product_id, line_total, quantity')
          .in('order_id', orderIds);

        for (const item of orderItems || []) {
          if (!item.product_id) continue;
          moneyByProduct.set(
            item.product_id,
            (moneyByProduct.get(item.product_id) || 0) + Number(item.line_total ?? 0),
          );
        }
      }

      const productLines: AssignmentReportProductLine[] = (allocations || []).map((row) => {
        const meta = productMap.get(row.product_id);
        const assigned = Number(row.assigned_qty ?? 0);
        const sold = Number(row.sold_qty ?? 0);
        const returns = Math.max(assigned - sold, 0);
        const price = meta?.price ?? 0;
        return {
          productId: row.product_id,
          productName: meta?.name || row.product_id,
          unit: meta?.unit || 'pcs',
          packSize: meta?.unit || '—',
          quantity: assigned,
          salesWorkOut: assigned * price,
          returns,
          soldOut: sold,
          moneyReceived: moneyByProduct.get(row.product_id) || sold * price,
        };
      });

      productLines.sort((a, b) => b.soldOut - a.soldOut);

      const totals = productLines.reduce(
        (acc, line) => ({
          quantity: acc.quantity + line.quantity,
          salesWorkOut: acc.salesWorkOut + line.salesWorkOut,
          returns: acc.returns + line.returns,
          soldOut: acc.soldOut + line.soldOut,
          moneyReceived: acc.moneyReceived + line.moneyReceived,
        }),
        { quantity: 0, salesWorkOut: 0, returns: 0, soldOut: 0, moneyReceived: 0 },
      );

      const mostSold = productLines.length
        ? { name: productLines[0].productName, qty: productLines[0].soldOut }
        : null;

      const { data: expenses } = await supabase
        .from('operating_expenses')
        .select('id, description, category, amount')
        .eq('assignment_id', assignmentId)
        .order('expense_date', { ascending: true });

      const expenseRows: AssignmentReportExpense[] = (expenses || []).map((e) => ({
        id: e.id,
        description: e.description || e.category,
        category: e.category,
        amount: Number(e.amount),
      }));

      const totalExpenses = expenseRows.reduce((s, e) => s + e.amount, 0);

      const discountOut = linkedOrders.reduce(
        (s, o) => s + Number(o.discount_amount ?? 0),
        0,
      );

      let cash = 0;
      let mpesa = 0;
      let directBank = 0;
      const outstandingCredit: AssignmentReportCreditLine[] = [];

      if (orderIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('order_id, method, amount')
          .in('order_id', orderIds);

        const paidByOrder = new Map<string, number>();

        for (const pay of payments || []) {
          const amt = Number(pay.amount ?? 0);
          paidByOrder.set(
            pay.order_id,
            (paidByOrder.get(pay.order_id) || 0) + amt,
          );
          switch (pay.method) {
            case 'cash':
              cash += amt;
              break;
            case 'mpesa':
              mpesa += amt;
              break;
            case 'card':
            case 'qr':
              directBank += amt;
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

      const totalSales = cash + mpesa + directBank;
      const totalOutstandingCredit = outstandingCredit.reduce((s, c) => s + c.amount, 0);
      const grandSalesPlusCredit = totalSales + totalOutstandingCredit;

      const totalCollectedExCredit = grandSalesPlusCredit - totalOutstandingCredit;
      const netAfterExpensesAndDiscount =
        totalCollectedExCredit - totalExpenses - discountOut;

      const dateLabel = (() => {
        try {
          return format(parseISO(`${assignment.assignment_date}T00:00:00`), 'EEEE dd/MM/yyyy').toUpperCase();
        } catch {
          return assignment.assignment_date;
        }
      })();

      const { data: settlementRow } = await supabase
        .from('route_settlements')
        .select(
          'id, expected_remittance, cash_submitted, mpesa_submitted, bank_submitted, variance, notes, is_finalized, finalized_by_name, finalized_at',
        )
        .eq('assignment_id', assignmentId)
        .maybeSingle();

      const settlement: AssignmentReportSettlement | null = settlementRow
        ? {
            id: settlementRow.id,
            expected_remittance: Number(settlementRow.expected_remittance ?? 0),
            cash_submitted: Number(settlementRow.cash_submitted ?? 0),
            mpesa_submitted: Number(settlementRow.mpesa_submitted ?? 0),
            bank_submitted: Number(settlementRow.bank_submitted ?? 0),
            variance: Number(settlementRow.variance ?? 0),
            notes: settlementRow.notes,
            is_finalized: Boolean(settlementRow.is_finalized),
            finalized_by_name: settlementRow.finalized_by_name,
            finalized_at: settlementRow.finalized_at,
          }
        : null;

      return {
        assignmentId,
        routeName: assignment.route_name,
        assignmentDate: assignment.assignment_date,
        assignmentDateLabel: dateLabel,
        cashierName: cashierProfile?.full_name || 'Staff',
        products: productLines,
        totals,
        mostSoldProduct: mostSold,
        grandSalesPlusCredit,
        expenses: expenseRows,
        totalExpenses,
        discountOut,
        salesBreakdown: {
          cash,
          mpesa,
          directBank,
          credit: totalOutstandingCredit,
          totalSales,
        },
        outstandingCredit,
        totalOutstandingCredit,
        totalCollectedExCredit,
        netAfterExpensesAndDiscount,
        settlement,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load assignment report';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchReport, loading, error };
}
