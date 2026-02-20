import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import type { User } from '@supabase/supabase-js';

type AuthFailure = {
  ok: false;
  error: string;
  status: number;
};

type RequireUserSuccess = {
  ok: true;
  user: User;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

type RequireTenantSuccess = RequireUserSuccess & { clientId: string };
type RequireBackofficeSuccess = RequireUserSuccess & {
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
};

export async function requireUser(): Promise<AuthFailure | RequireUserSuccess> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  return { ok: true, user: data.user, supabase };
}

export async function requireTenantClientId(): Promise<AuthFailure | RequireTenantSuccess> {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth;
  }

  const { data, error } = await auth.supabase
    .from('user_clients')
    .select('client_id')
    .eq('user_id', auth.user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, status: 403 };
  }

  if (!data?.client_id) {
    return { ok: false, error: 'Tenant relation not found', status: 403 };
  }

  return { ok: true, user: auth.user, supabase: auth.supabase, clientId: data.client_id as string };
}

export async function requireBackofficeAdmin(): Promise<AuthFailure | RequireBackofficeSuccess> {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth;
  }

  const expected = env.backofficeAdminEmail?.toLowerCase();
  const current = auth.user.email?.toLowerCase();

  if (!expected || !current || expected !== current) {
    return { ok: false, error: 'Forbidden', status: 403 };
  }

  return {
    ok: true,
    user: auth.user,
    supabase: auth.supabase,
    serviceSupabase: createSupabaseServiceClient()
  };
}
