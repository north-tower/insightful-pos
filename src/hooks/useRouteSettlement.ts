import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface RouteSettlement {
  id: string;
  assignment_id: string;
  expected_remittance: number;
  cash_submitted: number;
  mpesa_submitted: number;
  bank_submitted: number;
  variance: number;
  notes: string | null;
  is_finalized: boolean;
  finalized_by: string | null;
  finalized_by_name: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveSettlementParams {
  assignment_id: string;
  expected_remittance: number;
  cash_submitted: number;
  mpesa_submitted: number;
  bank_submitted: number;
  notes?: string;
  finalize?: boolean;
}

function mapRow(row: Record<string, unknown>): RouteSettlement {
  return {
    id: row.id as string,
    assignment_id: row.assignment_id as string,
    expected_remittance: Number(row.expected_remittance ?? 0),
    cash_submitted: Number(row.cash_submitted ?? 0),
    mpesa_submitted: Number(row.mpesa_submitted ?? 0),
    bank_submitted: Number(row.bank_submitted ?? 0),
    variance: Number(row.variance ?? 0),
    notes: (row.notes as string) || null,
    is_finalized: Boolean(row.is_finalized),
    finalized_by: (row.finalized_by as string) || null,
    finalized_by_name: (row.finalized_by_name as string) || null,
    finalized_at: (row.finalized_at as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function useRouteSettlement() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const fetchSettlement = useCallback(async (assignmentId: string): Promise<RouteSettlement | null> => {
    const { data, error } = await supabase
      .from('route_settlements')
      .select('*')
      .eq('assignment_id', assignmentId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRow(data as Record<string, unknown>) : null;
  }, []);

  const saveSettlement = useCallback(
    async (params: SaveSettlementParams): Promise<RouteSettlement> => {
      setSaving(true);
      try {
        const variance = params.cash_submitted - params.expected_remittance;
        const now = new Date().toISOString();
        const payload = {
          assignment_id: params.assignment_id,
          expected_remittance: params.expected_remittance,
          cash_submitted: params.cash_submitted,
          mpesa_submitted: params.mpesa_submitted,
          bank_submitted: params.bank_submitted,
          variance,
          notes: params.notes?.trim() || null,
          is_finalized: params.finalize ?? false,
          finalized_by: params.finalize ? user?.id || null : null,
          finalized_by_name: params.finalize ? user?.full_name || null : null,
          finalized_at: params.finalize ? now : null,
        };

        const { data: existing } = await supabase
          .from('route_settlements')
          .select('id, is_finalized')
          .eq('assignment_id', params.assignment_id)
          .maybeSingle();

        if (existing?.is_finalized) {
          throw new Error('This settlement is already finalized and cannot be changed');
        }

        if (existing?.id) {
          const updateRow: Record<string, unknown> = {
            expected_remittance: payload.expected_remittance,
            cash_submitted: payload.cash_submitted,
            mpesa_submitted: payload.mpesa_submitted,
            bank_submitted: payload.bank_submitted,
            variance,
            notes: payload.notes,
          };
          if (params.finalize) {
            updateRow.is_finalized = true;
            updateRow.finalized_by = user?.id || null;
            updateRow.finalized_by_name = user?.full_name || null;
            updateRow.finalized_at = now;
          }
          const { data, error } = await supabase
            .from('route_settlements')
            .update(updateRow)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          return mapRow(data as Record<string, unknown>);
        }

        const { data, error } = await supabase
          .from('route_settlements')
          .insert(payload)
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
