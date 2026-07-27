import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';

export interface ProfitSummary {
  grossSales: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  netProfit: number;
  netMarginPct: number;
  orderCount: number;
  refundedOrderCount: number;
  expenseCount: number;
}

function emptySummary(): ProfitSummary {
  return {
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    netRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPct: 0,
    operatingExpenses: 0,
    netProfit: 0,
    netMarginPct: 0,
    orderCount: 0,
    refundedOrderCount: 0,
    expenseCount: 0,
  };
}

function mapRow(row: Record<string, unknown>): ProfitSummary {
  return {
    grossSales: Number(row.gross_sales ?? 0),
    discounts: Number(row.discounts ?? 0),
    refunds: Number(row.refunds ?? 0),
    netRevenue: Number(row.net_revenue ?? 0),
    cogs: Number(row.cogs ?? 0),
    grossProfit: Number(row.gross_profit ?? 0),
    grossMarginPct: Number(row.gross_margin_pct ?? 0),
    operatingExpenses: Number(row.operating_expenses ?? 0),
    netProfit: Number(row.net_profit ?? 0),
    netMarginPct: Number(row.net_margin_pct ?? 0),
    orderCount: Number(row.order_count ?? 0),
    refundedOrderCount: Number(row.refunded_order_count ?? 0),
    expenseCount: Number(row.expense_count ?? 0),
  };
}

export async function fetchProfitSummary(
  businessMode: string,
  startIso: string,
  endIso: string,
): Promise<ProfitSummary> {
  const { data, error: rpcErr } = await supabase.rpc('get_profit_summary', {
    p_start: startIso,
    p_end: endIso,
    p_store_id: null,
    p_business_mode: businessMode,
  });

  if (rpcErr) throw rpcErr;

  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapRow(row as Record<string, unknown>) : emptySummary();
}

export function useProfitReport() {
  const { mode } = useBusinessMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ProfitSummary>(emptySummary);

  const fetchSummary = useCallback(
    async (startIso: string, endIso: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchProfitSummary(mode, startIso, endIso);
        setSummary(result);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load profit report';
        setError(message);
        setSummary(emptySummary());
      } finally {
        setLoading(false);
      }
    },
    [mode],
  );

  return { summary, loading, error, fetchSummary };
}
