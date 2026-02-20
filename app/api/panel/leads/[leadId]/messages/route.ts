import { requireTenantClientId } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';

export async function GET(_: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireTenantClientId();
  if (!auth.ok) {
    return fail(auth.error, auth.status);
  }

  const { leadId } = await params;

  const { data: lead, error: leadError } = await auth.supabase
    .from('leads')
    .select('id, conversation_status, human_operator_id, score, wa_profile_name, wa_user_id')
    .eq('id', leadId)
    .eq('client_id', auth.clientId)
    .maybeSingle();

  if (leadError) {
    return fail(leadError.message, 500);
  }

  if (!lead) {
    return fail('Lead not found', 404);
  }

  const { data: messages, error } = await auth.supabase
    .from('messages')
    .select('id, direction, text_content, created_at')
    .eq('lead_id', leadId)
    .eq('client_id', auth.clientId)
    .order('created_at', { ascending: true });

  if (error) {
    return fail(error.message, 500);
  }

  return ok({ lead, messages: messages ?? [] });
}
