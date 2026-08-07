import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface BranchTransferResult {
  transferId: string;
}

export function useBranchStockTransfer() {
  const [transferring, setTransferring] = useState(false);

  const transferStock = useCallback(
    async (params: {
      fromStoreId: string;
      toStoreId: string;
      productId: string;
      quantity: number;
      note?: string;
    }): Promise<BranchTransferResult> => {
      setTransferring(true);
      try {
        const { data, error } = await supabase.rpc('transfer_stock_between_branches', {
          p_from_store_id: params.fromStoreId,
          p_to_store_id: params.toStoreId,
          p_product_id: params.productId,
          p_quantity: params.quantity,
          p_note: params.note?.trim() || null,
        });
        if (error) throw error;
        return { transferId: data as string };
      } finally {
        setTransferring(false);
      }
    },
    [],
  );

  return { transferStock, transferring };
}
