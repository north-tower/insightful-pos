import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-whatsapp-ops-key',
};

type ActionBody = {
  action: string;
  phone?: string;
  query?: string;
  idempotency_key?: string;
  sale_type?: 'cash' | 'credit';
  customer_id?: string;
  items?: Array<{
    product_id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    unit_cost?: number;
  }>;
  payments?: Array<{
    method: string;
    amount: number;
    reference?: string;
    description?: string;
  }>;
  amount?: number;
  method?: string;
  reference?: string;
  notes?: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/** Normalise Kenyan mobiles to E.164 +254… for staff link lookup. */
export function normalizeStaffPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return raw.trim();

  let national: string | null = null;
  if (digits.startsWith('254') && digits.length === 12) {
    national = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    national = digits.slice(1);
  } else if (
    digits.length === 9 &&
    (digits.startsWith('7') || digits.startsWith('1'))
  ) {
    national = digits;
  }

  if (national && national.length === 9) {
    return `+254${national}`;
  }

  if (raw.trim().startsWith('+')) {
    return raw.trim();
  }

  return raw.trim();
}

function authorize(req: Request): boolean {
  const expected = Deno.env.get('WHATSAPP_OPS_API_KEY')?.trim();
  if (!expected) return false;

  const headerKey = req.headers.get('x-whatsapp-ops-key')?.trim();
  if (headerKey && headerKey === expected) return true;

  const auth = req.headers.get('Authorization')?.trim() ?? '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token === expected) return true;
  }

  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!authorize(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const phone = normalizeStaffPhone(body.phone ?? '');
  if (!phone) {
    return jsonResponse({ error: 'phone is required' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: staffRows, error: staffErr } = await admin.rpc(
    'whatsapp_resolve_staff',
    { p_phone: phone },
  );

  if (staffErr) {
    console.error('whatsapp_resolve_staff', staffErr);
    return jsonResponse({ error: staffErr.message }, 500);
  }

  const staff = Array.isArray(staffRows) ? staffRows[0] : staffRows;

  if (body.action === 'identify') {
    if (!staff) {
      return jsonResponse({ authorised: false }, 403);
    }
    return jsonResponse({
      authorised: true,
      profile_id: staff.profile_id,
      store_id: staff.store_id,
      staff_name: staff.staff_name,
      staff_role: staff.staff_role,
      business_mode: staff.business_mode,
      store_name: staff.store_name,
    });
  }

  if (!staff) {
    return jsonResponse({ error: 'Staff phone not authorised' }, 403);
  }

  const storeId = staff.store_id as string;
  const businessMode = staff.business_mode as string;

  if (body.action === 'search_products') {
    const q = (body.query ?? '').trim();
    if (q.length < 2) {
      return jsonResponse({ products: [] });
    }

    const { data, error } = await admin
      .from('products')
      .select('id, name, price, stock, sku')
      .eq('store_id', storeId)
      .eq('business_mode', businessMode)
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(8);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ products: data ?? [] });
  }

  if (body.action === 'search_customers') {
    const q = (body.query ?? '').trim();
    if (q.length < 2) {
      return jsonResponse({ customers: [] });
    }

    const digits = q.replace(/\D/g, '');
    let query = admin
      .from('customers')
      .select(
        'id, first_name, last_name, phone, credit_balance, credit_limit',
      )
      .eq('store_id', storeId)
      .eq('business_mode', businessMode)
      .limit(8);

    if (digits.length >= 4) {
      query = query.or(
        `phone.ilike.%${digits}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`,
      );
    } else {
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    }

    const { data, error } = await query.order('last_name');

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ customers: data ?? [] });
  }

  if (body.action === 'create_sale') {
    if (!body.idempotency_key?.trim()) {
      return jsonResponse({ error: 'idempotency_key is required' }, 400);
    }
    if (!body.items?.length) {
      return jsonResponse({ error: 'items are required' }, 400);
    }

    const { data, error } = await admin.rpc('whatsapp_create_sale', {
      p_staff_phone: phone,
      p_idempotency_key: body.idempotency_key.trim(),
      p_sale_type: body.sale_type ?? 'cash',
      p_customer_id: body.customer_id ?? null,
      p_items: body.items,
      p_payments: body.payments ?? [],
      p_notes: body.notes ?? null,
    });

    if (error) {
      const msg = error.message ?? 'Sale failed';
      const status = msg.includes('not authorised') ? 403 : 400;
      return jsonResponse({ error: msg }, status);
    }

    return jsonResponse({ sale: data });
  }

  if (body.action === 'pay_account') {
    if (!body.customer_id) {
      return jsonResponse({ error: 'customer_id is required' }, 400);
    }
    if (!body.amount || body.amount <= 0) {
      return jsonResponse({ error: 'amount must be greater than zero' }, 400);
    }

    const { data, error } = await admin.rpc('whatsapp_record_account_payment', {
      p_staff_phone: phone,
      p_customer_id: body.customer_id,
      p_amount: body.amount,
      p_method: body.method ?? 'cash',
      p_reference: body.reference ?? null,
      p_notes: body.notes ?? null,
      p_idempotency_key: body.idempotency_key?.trim() ?? null,
    });

    if (error) {
      const msg = error.message ?? 'Payment failed';
      const status = msg.includes('not authorised') ? 403 : 400;
      return jsonResponse({ error: msg }, status);
    }

    return jsonResponse({ payment: data });
  }

  return jsonResponse({ error: `Unknown action: ${body.action}` }, 400);
});
