import { requireTenantClientId } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';

export async function POST(_: Request, { params }: { params: { leadId: string } }) {
  const auth = await requireTenantClientId();
  if ('error' in auth) {
    return fail(auth.error, auth.status);
  }

  const { leadId } = params;

  const { data, error } = await auth.supabase
    .from('leads')
    .update({
      conversation_status: 'CLOSED',
      closed_at: new Date().toISOString()
    })
    .eq('id', leadId)
    .eq('client_id', auth.clientId)
    .select('id, conversation_status, closed_at')
    .maybeSingle();

  if (error) {
    return fail(error.message, 500);
  }

  if (!data) {
    return fail('Lead not found', 404);
  }

  return ok({ lead: data });
}
