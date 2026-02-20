import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  return { user: data.user, supabase };
}

export async function requireTenantClientId() {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth;
  }

  const { data, error } = await auth.supabase
    .from('user_clients')
    .select('client_id')
    .eq('user_id', auth.user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 403 as const };
  }

  if (!data?.client_id) {
    return { error: 'Tenant relation not found', status: 403 as const };
  }

  return { user: auth.user, supabase: auth.supabase, clientId: data.client_id as string };
}

export async function requireBackofficeAdmin() {
  const auth = await requireUser();
  if ('error' in auth) {
    return auth;
  }

  const expected = env.backofficeAdminEmail?.toLowerCase();
  const current = auth.user.email?.toLowerCase();

  if (!expected || !current || expected !== current) {
    return { error: 'Forbidden', status: 403 as const };
  }

  return {
    user: auth.user,
    supabase: auth.supabase,
    serviceSupabase: createSupabaseServiceClient()
  };
}
