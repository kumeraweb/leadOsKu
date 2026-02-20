import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';

export function createSupabaseServiceClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
