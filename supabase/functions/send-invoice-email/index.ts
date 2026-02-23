import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            'RESEND_API_KEY is not configured. Add it via: supabase secrets set RESEND_API_KEY=re_...',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    const { to, subject, html, from, pdfBase64, pdfFilename } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // Default sender — must be a verified domain in Resend
    const sender =
      from || Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';

    // Build the Resend payload
    const payload: Record<string, unknown> = {
      from: sender,
      to: Array.isArray(to) ? to : [to],
      subject,
    };

    // Email body — use html if provided, otherwise a simple message
    payload.html =
      html ||
      `<p>Please find the attached invoice.</p><p>Thank you for your business.</p>`;

    // Attach PDF if provided
    if (pdfBase64) {
      payload.attachments = [
        {
          filename: pdfFilename || 'invoice.pdf',
          content: pdfBase64,
        },
      ];
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Failed to send email' }),
        {
          status: res.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
});
