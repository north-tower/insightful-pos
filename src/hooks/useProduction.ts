import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface RecipeLine {
  id: string;
  finished_product_id: string;
  ingredient_product_id: string;
  quantity_per_unit: number;
  sort_order: number;
  ingredient_name?: string;
  ingredient_unit?: string;
  ingredient_cost?: number;
  ingredient_stock?: number;
}

export interface ProductionBatch {
  id: string;
  batch_number: string;
  finished_product_id: string;
  planned_qty: number;
  actual_qty: number;
  status: string;
  material_cost_total: number;
  unit_cost: number;
  produced_at: string;
  expires_at: string | null;
  notes: string | null;
  staff_name: string | null;
  created_at: string;
  finished_product_name?: string;
  finished_product_unit?: string;
}

export interface BatchConsumption {
  id: string;
  batch_id: string;
  ingredient_product_id: string;
  ingredient_name: string;
  quantity_consumed: number;
  unit: string;
  unit_cost: number;
  line_cost: number;
}

export interface RecipeLineInput {
  ingredient_product_id: string;
  quantity_per_unit: number;
  sort_order?: number;
}

export interface ProductionRequirement {
  ingredient_product_id: string;
  ingredient_name: string;
  unit: string;
  quantity_required: number;
  available_stock: number;
  unit_cost: number;
  line_cost: number;
  sufficient: boolean;
}

export interface CompleteBatchParams {
  finished_product_id: string;
  actual_qty: number;
  planned_qty?: number;
  batch_number?: string;
  produced_at?: string;
  expires_at?: string;
  notes?: string;
}

function mapRecipeRow(row: Record<string, unknown>): RecipeLine {
  const ingredient = row.ingredient as Record<string, unknown> | null;
  return {
    id: row.id as string,
    finished_product_id: row.finished_product_id as string,
    ingredient_product_id: row.ingredient_product_id as string,
    quantity_per_unit: Number(row.quantity_per_unit),
    sort_order: Number(row.sort_order ?? 0),
    ingredient_name: (ingredient?.name as string) || undefined,
    ingredient_unit: (ingredient?.unit as string) || undefined,
    ingredient_cost: ingredient ? Number(ingredient.cost ?? 0) : undefined,
    ingredient_stock: ingredient ? Number(ingredient.stock ?? 0) : undefined,
  };
}

function mapBatchRow(row: Record<string, unknown>): ProductionBatch {
  const product = row.finished_product as Record<string, unknown> | null;
  return {
    id: row.id as string,
    batch_number: row.batch_number as string,
    finished_product_id: row.finished_product_id as string,
    planned_qty: Number(row.planned_qty),
    actual_qty: Number(row.actual_qty),
    status: row.status as string,
    material_cost_total: Number(row.material_cost_total ?? 0),
    unit_cost: Number(row.unit_cost ?? 0),
    produced_at: row.produced_at as string,
    expires_at: (row.expires_at as string) || null,
    notes: (row.notes as string) || null,
    staff_name: (row.staff_name as string) || null,
    created_at: row.created_at as string,
    finished_product_name: (product?.name as string) || undefined,
    finished_product_unit: (product?.unit as string) || undefined,
  };
}

export function computeRequirements(
  recipeLines: RecipeLine[],
  batchQty: number,
): ProductionRequirement[] {
  if (batchQty <= 0) return [];
  return recipeLines.map((line) => {
    const quantityRequired = Math.round(line.quantity_per_unit * batchQty * 10000) / 10000;
    const unitCost = line.ingredient_cost ?? 0;
    const available = line.ingredient_stock ?? 0;
    return {
      ingredient_product_id: line.ingredient_product_id,
      ingredient_name: line.ingredient_name || 'Ingredient',
      unit: line.ingredient_unit || 'pcs',
      quantity_required: quantityRequired,
      available_stock: available,
      unit_cost: unitCost,
      line_cost: Math.round(quantityRequired * unitCost * 100) / 100,
      sufficient: available >= quantityRequired,
    };
  });
}

export function useProduction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipe = useCallback(async (finishedProductId: string): Promise<RecipeLine[]> => {
    const { data, error: fetchErr } = await supabase
      .from('product_recipe_lines')
      .select(
        `
        id,
        finished_product_id,
        ingredient_product_id,
        quantity_per_unit,
        sort_order,
        ingredient:products!product_recipe_lines_ingredient_product_id_fkey (
          name,
          unit,
          cost,
          stock
        )
      `,
      )
      .eq('finished_product_id', finishedProductId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (fetchErr) throw fetchErr;
    return (data || []).map((row) => mapRecipeRow(row as Record<string, unknown>));
  }, []);

  const saveRecipe = useCallback(
    async (finishedProductId: string, lines: RecipeLineInput[]): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const { error: rpcErr } = await supabase.rpc('save_product_recipe', {
          p_finished_product_id: finishedProductId,
          p_lines: lines,
        });
        if (rpcErr) throw rpcErr;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save recipe';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchBatches = useCallback(
    async (limit = 50): Promise<ProductionBatch[]> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .from('production_batches')
          .select(
            `
            *,
            finished_product:products!production_batches_finished_product_id_fkey (
              name,
              unit
            )
          `,
          )
          .eq('status', 'completed')
          .order('produced_at', { ascending: false })
          .limit(limit);

        if (fetchErr) throw fetchErr;
        return (data || []).map((row) => mapBatchRow(row as Record<string, unknown>));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load batches';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchBatchConsumption = useCallback(
    async (batchId: string): Promise<BatchConsumption[]> => {
      const { data, error: fetchErr } = await supabase
        .from('production_batch_consumption')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });

      if (fetchErr) throw fetchErr;
      return (data || []).map((row) => ({
        id: row.id as string,
        batch_id: row.batch_id as string,
        ingredient_product_id: row.ingredient_product_id as string,
        ingredient_name: row.ingredient_name as string,
        quantity_consumed: Number(row.quantity_consumed),
        unit: row.unit as string,
        unit_cost: Number(row.unit_cost),
        line_cost: Number(row.line_cost),
      }));
    },
    [],
  );

  const completeBatch = useCallback(
    async (params: CompleteBatchParams): Promise<ProductionBatch> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcErr } = await supabase.rpc('complete_production_batch', {
          p_finished_product_id: params.finished_product_id,
          p_actual_qty: params.actual_qty,
          p_planned_qty: params.planned_qty ?? null,
          p_batch_number: params.batch_number?.trim() || null,
          p_produced_at: params.produced_at ?? null,
          p_expires_at: params.expires_at ?? null,
          p_notes: params.notes?.trim() || null,
        });
        if (rpcErr) throw rpcErr;
        return mapBatchRow(data as Record<string, unknown>);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to complete production batch';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const generateBatchNumber = useCallback(async (): Promise<string> => {
    const { data, error: rpcErr } = await supabase.rpc('generate_production_batch_number', {
      p_store_id: null,
    });
    if (rpcErr) throw rpcErr;
    return data as string;
  }, []);

  return {
    loading,
    error,
    fetchRecipe,
    saveRecipe,
    fetchBatches,
    fetchBatchConsumption,
    completeBatch,
    generateBatchNumber,
  };
}
