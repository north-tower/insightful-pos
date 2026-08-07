import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface ShopDaySettlement {
  id: string;
  store_id: string;
  business_date: string;
  opening_float: number;
  closing_float: number;
  expected_cash: number;
  expected_mpesa: number;
  expected_bank: number;
  cash_counted: number;
  mpesa_confirmed: number;
  bank_confirmed: number;
  cash_variance: number;
  mpesa_variance: number;
  bank_variance: number;
  notes: string | null;
  is_finalized: boolean;
  finalized_by: string | null;
  finalized_by_name: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveShopDaySettlementParams {
  business_date: string;
  opening_float: number;
  closing_float: number;
  expected_cash: number;
  expected_mpesa: number;
  expected_bank: number;
  cash_counted: number;
  mpesa_confirmed: number;
  bank_confirmed: number;
  notes?: string;
  finalize?: boolean;
}

function mapRow(row: Record<string, unknown>): ShopDaySettlement {
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

export function useShopDaySettlement() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const fetchSettlement = useCallback(
    async (businessDate: string): Promise<ShopDaySettlement | null> => {
      const { data, error } = await supabase
        .from('shop_day_settlements')
        .select('*')
        .eq('business_date', businessDate)
        .maybeSingle();

      if (error) throw error;
      return data ? mapRow(data as Record<string, unknown>) : null;
    },
    [],
  );

  const saveSettlement = useCallback(
    async (params: SaveShopDaySettlementParams): Promise<ShopDaySettlement> => {
      setSaving(true);
      try {
        const cashVariance = params.cash_counted - params.expected_cash;
        const mpesaVariance = params.mpesa_confirmed - params.expected_mpesa;
        const bankVariance = params.bank_confirmed - params.expected_bank;
        const now = new Date().toISOString();

        const { data: existing } = await supabase
          .from('shop_day_settlements')
          .select('id, is_finalized')
          .eq('business_date', params.business_date)
          .maybeSingle();

        if (existing?.is_finalized) {
          throw new Error('This shop day is already finalized and cannot be changed');
        }

        const basePayload = {
          business_date: params.business_date,
          opening_float: params.opening_float,
          closing_float: params.closing_float,
          expected_cash: params.expected_cash,
          expected_mpesa: params.expected_mpesa,
          expected_bank: params.expected_bank,
          cash_counted: params.cash_counted,
          mpesa_confirmed: params.mpesa_confirmed,
          bank_confirmed: params.bank_confirmed,
          cash_variance: cashVariance,
          mpesa_variance: mpesaVariance,
          bank_variance: bankVariance,
          notes: params.notes?.trim() || null,
        };

        if (existing?.id) {
          const updateRow: Record<string, unknown> = { ...basePayload };
          if (params.finalize) {
            updateRow.is_finalized = true;
            updateRow.finalized_by = user?.id || null;
            updateRow.finalized_by_name = user?.full_name || null;
            updateRow.finalized_at = now;
          }
          const { data, error } = await supabase
            .from('shop_day_settlements')
            .update(updateRow)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          return mapRow(data as Record<string, unknown>);
        }

        const { data, error } = await supabase
          .from('shop_day_settlements')
          .insert({
            ...basePayload,
            is_finalized: params.finalize ?? false,
            finalized_by: params.finalize ? user?.id || null : null,
            finalized_by_name: params.finalize ? user?.full_name || null : null,
            finalized_at: params.finalize ? now : null,
          })
          .select()
          .single();

        if (error) throw error;
        return mapRow(data as Record<string, unknown>);
      } finally {
        setSaving(false);
      }
    },
    [user?.id, user?.full_name],
  );

  return { fetchSettlement, saveSettlement, saving };
}
