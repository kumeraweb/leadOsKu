import { z } from 'zod';
import { requireBackofficeAdmin } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';

const updateClientSchema = z.object({
  notification_email: z.string().email().optional(),
  human_forward_number: z.string().min(1).optional(),
  score_threshold: z.number().int().min(0).max(100).optional(),
  strategic_questions: z.array(z.string()).max(3).optional()
});

export async function PATCH(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const auth = await requireBackofficeAdmin();
  if (!auth.ok) {
    return fail(auth.error, auth.status);
  }

  const payload = await req.json().catch(() => null);
  const parsed = updateClientSchema.safeParse(payload);
  if (!parsed.success) {
    return fail('Invalid payload', 400);
  }

  const { clientId } = await params;

  const { data, error } = await auth.serviceSupabase
    .from('clients')
    .update(parsed.data)
    .eq('id', clientId)
    .select('*')
    .maybeSingle();

  if (error) {
    return fail(error.message, 500);
  }

  if (!data) {
    return fail('Client not found', 404);
  }

  return ok({ client: data });
}
