import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

/** Active route assignment for a cashier on a given date (defaults to today). */
export async function resolveActiveAssignmentId(
  cashierId: string,
  dateIso?: string,
): Promise<string | null> {
  const assignmentDate = dateIso || format(new Date(), 'yyyy-MM-dd');
  const { data } = await supabase
    .from('staff_inventory_assignments')
    .select('id')
    .eq('cashier_id', cashierId)
    .eq('assignment_date', assignmentDate)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
