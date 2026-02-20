import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export function createSupabaseServiceClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
