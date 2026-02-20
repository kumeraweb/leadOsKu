import { requireTenantClientId } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';

export async function POST(_: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireTenantClientId();
  if (!auth.ok) {
    return fail(auth.error, auth.status);
  }

  const { leadId } = await params;

  const { data: updated, error } = await auth.supabase
    .from('leads')
    .update({
      conversation_status: 'HUMAN_TAKEN',
      human_operator_id: auth.user.id,
      taken_at: new Date().toISOString()
    })
    .eq('id', leadId)
    .eq('client_id', auth.clientId)
    .eq('conversation_status', 'HUMAN_REQUIRED')
    .select('id, conversation_status, human_operator_id, taken_at')
    .maybeSingle();

  if (error) {
    return fail(error.message, 500);
  }

  if (!updated) {
    return fail('Lead is not in HUMAN_REQUIRED', 409);
  }

  return ok({ lead: updated });
}
