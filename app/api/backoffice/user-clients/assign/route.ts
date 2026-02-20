import { z } from 'zod';
import { requireBackofficeAdmin } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';

const assignSchema = z.object({
  user_id: z.string().uuid(),
  client_id: z.string().uuid()
});

export async function POST(req: Request) {
  const auth = await requireBackofficeAdmin();
  if (!auth.ok) {
    return fail(auth.error, auth.status);
  }

  const payload = await req.json().catch(() => null);
  const parsed = assignSchema.safeParse(payload);
  if (!parsed.success) {
    return fail('Invalid payload', 400);
  }

  const { data, error } = await auth.serviceSupabase
    .from('user_clients')
    .upsert(parsed.data, { onConflict: 'user_id,client_id' })
    .select('*')
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  return ok({ user_client: data }, 201);
}
