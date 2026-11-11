import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ─── Celcom Africa SMS gateway credentials ─────────────────────────────────
const PARTNER_ID = '266';
const API_KEY = '39021f645c1d1729b5e281803ab001ea';
// Callers may override this per request; other apps on this project send under
// their own sender ID.
const DEFAULT_SHORTCODE = 'KILIMO FEED';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mobile, message, shortcode } = await req.json();

    if (!mobile || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: mobile, message' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // POST JSON per Celcom docs — avoids query-string comma/parsing issues in amounts (e.g. KES 1,500,000).
    const smsEndpoint =
      Deno.env.get('CELCOM_SEND_URL') ?? 'https://isms.celcomafrica.com/api/services/sendsms/';

    console.log('SMS outbound preview:', String(message).slice(0, 120));

    const smsRes = await fetch(smsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: API_KEY,
        partnerID: PARTNER_ID,
        mobile,
        message,
        shortcode: shortcode || DEFAULT_SHORTCODE,
        pass_type: 'plain',
      }),
    });
    const smsData = await smsRes.text();

    console.log('Celcom SMS response:', smsData);

    return new Response(
      JSON.stringify({ success: true, gateway_response: smsData }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  } catch (err) {
    console.error('SMS Edge Function error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
});
