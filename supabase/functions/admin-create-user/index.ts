import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CreateUserPayload = {
  email: string;
  full_name: string;
  role?: 'admin' | 'manager' | 'cashier';
  business_mode?: 'restaurant' | 'retail';
  store_id: string;
  role_in_store?: 'admin' | 'manager' | 'cashier';
  is_default_store?: boolean;
  send_invite?: boolean;
  password?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Supabase environment configuration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const authHeader = req.headers.get('Authorization');
    const hasAuthorizationHeader = Boolean(authHeader);
    const hasBearerPrefix = authHeader?.startsWith('Bearer ') ?? false;
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'Missing Authorization header',
          debug: {
            has_authorization_header: hasAuthorizationHeader,
            has_bearer_prefix: hasBearerPrefix,
          },
        }),
        {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const accessToken = authHeader.replace('Bearer ', '').trim();

    const { data: requesterData, error: requesterError } = await adminClient.auth.getUser(accessToken);
    const requester = requesterData.user;

    if (requesterError || !requester) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized request',
          debug: {
            has_authorization_header: hasAuthorizationHeader,
            has_bearer_prefix: hasBearerPrefix,
            auth_error: requesterError?.message ?? null,
            requester_found: Boolean(requester),
          },
        }),
        {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const { data: requesterProfile, error: roleError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .single();

    if (roleError || requesterProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can create users' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const payload = (await req.json()) as CreateUserPayload;
    const email = payload.email?.trim().toLowerCase();
    const fullName = payload.full_name?.trim();
    const role = payload.role ?? 'cashier';
    const businessMode = payload.business_mode ?? 'restaurant';
    const storeId = payload.store_id;
    const roleInStore = payload.role_in_store ?? role;
    const isDefaultStore = payload.is_default_store ?? true;
    const sendInvite = payload.send_invite ?? true;
    const password = payload.password?.trim();

    if (!email || !fullName || !storeId) {
      return new Response(JSON.stringify({ error: 'email, full_name, and store_id are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { data: storeExists, error: storeError } = await adminClient
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .single();

    if (storeError || !storeExists) {
      return new Response(JSON.stringify({ error: 'Store does not exist' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let createdUserId: string | null = null;

    const { data: existingUser } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matched = existingUser.users.find((u) => u.email?.toLowerCase() === email);

    if (matched) {
      createdUserId = matched.id;
    } else if (sendInvite) {
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role,
          business_mode: businessMode,
        },
      });

      if (inviteError || !invited.user) {
        return new Response(JSON.stringify({ error: inviteError?.message || 'Failed to invite user' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      createdUserId = invited.user.id;
    } else {
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: 'password is required and must be at least 6 chars when send_invite=false' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
          business_mode: businessMode,
        },
      });

      if (createError || !created.user) {
        return new Response(JSON.stringify({ error: createError?.message || 'Failed to create user' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      createdUserId = created.user.id;
    }

    if (!createdUserId) {
      return new Response(JSON.stringify({ error: 'Could not resolve user id' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { error: profileError } = await adminClient.from('profiles').upsert(
      [
        {
          id: createdUserId,
          email,
          full_name: fullName,
          role,
          business_mode: businessMode,
        },
      ],
      { onConflict: 'id' }
    );

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (isDefaultStore) {
      const { error: resetDefaultError } = await adminClient
        .from('profile_stores')
        .update({ is_default_store: false })
        .eq('profile_id', createdUserId);

      if (resetDefaultError) {
        return new Response(JSON.stringify({ error: resetDefaultError.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    const { error: membershipError } = await adminClient.from('profile_stores').upsert(
      [
        {
          profile_id: createdUserId,
          store_id: storeId,
          role_in_store: roleInStore,
          is_default_store: isDefaultStore,
        },
      ],
      { onConflict: 'profile_id,store_id' }
    );

    if (membershipError) {
      return new Response(JSON.stringify({ error: membershipError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: createdUserId,
        email,
        invited: sendInvite && !matched,
        existed: !!matched,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err) {
    console.error('admin-create-user error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
