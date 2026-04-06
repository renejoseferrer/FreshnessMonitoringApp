import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  }
);

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
};

const requiredOneOf = (names: string[]) => {
  for (const name of names) {
    const value = Deno.env.get(name);

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing environment variable. Set one of: ${names.join(', ')}`);
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredOneOf(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']);
    const operatorSharedPassword = requiredEnv('OPERATOR_SHARED_PASSWORD');
    const authHeader = request.headers.get('Authorization');

    if (operatorSharedPassword.length < 8) {
      throw new Error('OPERATOR_SHARED_PASSWORD must be at least 8 characters long.');
    }

    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header.' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id, email, display_name, role, active')
      .eq('id', user.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile) {
      return jsonResponse({ error: 'Developer profile not found.' }, 403);
    }

    if (callerProfile.active === false || callerProfile.role !== 'developer') {
      return jsonResponse({ error: 'Developer access required.' }, 403);
    }

    const body = await request.json();
    const action = String(body?.action || '').trim();

    if (action === 'create') {
      const email = normalizeEmail(body?.email);
      const displayName = String(body?.displayName || '').trim() || email;

      if (!email) {
        return jsonResponse({ error: 'Email is required.' }, 400);
      }

      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: operatorSharedPassword,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
        },
      });

      if (createError || !createdUser.user) {
        return jsonResponse({ error: createError?.message || 'Could not create the operator account.' }, 400);
      }

      const { error: updateProfileError } = await adminClient
        .from('profiles')
        .update({
          email,
          display_name: displayName,
          role: 'operator',
          active: true,
        })
        .eq('id', createdUser.user.id);

      if (updateProfileError) {
        return jsonResponse({ error: updateProfileError.message || 'Could not configure the operator profile.' }, 400);
      }

      return jsonResponse({ ok: true, operatorId: createdUser.user.id, email });
    }

    if (action === 'set-active') {
      const operatorId = String(body?.operatorId || '').trim();
      const active = Boolean(body?.active);

      if (!operatorId) {
        return jsonResponse({ error: 'Operator id is required.' }, 400);
      }

      const { data: operatorProfile, error: operatorProfileError } = await adminClient
        .from('profiles')
        .select('id, email, role')
        .eq('id', operatorId)
        .eq('role', 'operator')
        .maybeSingle();

      if (operatorProfileError || !operatorProfile) {
        return jsonResponse({ error: 'Operator account not found.' }, 404);
      }

      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ active })
        .eq('id', operatorId);

      if (updateError) {
        return jsonResponse({ error: updateError.message || 'Could not update the operator account.' }, 400);
      }

      return jsonResponse({ ok: true, operatorId, email: operatorProfile.email, active });
    }

    if (action === 'delete') {
      const operatorId = String(body?.operatorId || '').trim();

      if (!operatorId) {
        return jsonResponse({ error: 'Operator id is required.' }, 400);
      }

      const { data: operatorProfile, error: operatorProfileError } = await adminClient
        .from('profiles')
        .select('id, email, role')
        .eq('id', operatorId)
        .eq('role', 'operator')
        .maybeSingle();

      if (operatorProfileError || !operatorProfile) {
        return jsonResponse({ error: 'Operator account not found.' }, 404);
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(operatorId);

      if (deleteError) {
        return jsonResponse({ error: deleteError.message || 'Could not delete the operator account.' }, 400);
      }

      return jsonResponse({ ok: true, operatorId, email: operatorProfile.email });
    }

    return jsonResponse({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected function error.' }, 500);
  }
});