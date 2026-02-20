import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireEnv } from '@/lib/env';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as never);
        });
      }
    }
  });
}
