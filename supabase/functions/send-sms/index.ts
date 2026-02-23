import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ─── Celcom Africa SMS gateway credentials ─────────────────────────────────
const PARTNER_ID = '266';
const API_KEY = '39021f645c1d1729b5e281803ab001ea';
const SHORTCODE = 'KILIMO FEED';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mobile, message } = await req.json();

    if (!mobile || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: mobile, message' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // Build the Celcom Africa SMS URL
    const smsUrl = new URL('https://isms.celcomafrica.com/api/services/sendsms/');
    smsUrl.searchParams.set('apikey', API_KEY);
    smsUrl.searchParams.set('partnerID', PARTNER_ID);
    smsUrl.searchParams.set('message', message);
    smsUrl.searchParams.set('shortcode', SHORTCODE);
    smsUrl.searchParams.set('mobile', mobile);

    const smsRes = await fetch(smsUrl.toString());
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
