import { requireTenantClientId } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';

const statusOrder = ['HUMAN_REQUIRED', 'ACTIVE', 'HUMAN_TAKEN', 'CLOSED'];

export async function GET() {
  const auth = await requireTenantClientId();
  if (!auth.ok) {
    return fail(auth.error, auth.status);
  }

  const { data: tenantClient } = await auth.supabase
    .from('clients')
    .select('id, name')
    .eq('id', auth.clientId)
    .maybeSingle();

  const { data: leads, error } = await auth.supabase
    .from('leads')
    .select('id, wa_profile_name, wa_user_id, conversation_status, score, updated_at, last_user_message_at, last_bot_message_at')
    .eq('client_id', auth.clientId)
    .order('updated_at', { ascending: false });

  if (error) {
    return fail(error.message, 500);
  }

  const leadIds = (leads ?? []).map((lead) => lead.id);
  const lastMessages = new Map<string, string>();

  if (leadIds.length > 0) {
    const { data: messages } = await auth.supabase
      .from('messages')
      .select('lead_id, text_content, created_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false });

    if (messages) {
      for (const msg of messages) {
        if (!lastMessages.has(msg.lead_id)) {
          lastMessages.set(msg.lead_id, msg.text_content);
        }
      }
    }
  }

  const ordered = (leads ?? [])
    .map((lead) => ({ ...lead, last_message: lastMessages.get(lead.id) ?? '' }))
    .sort(
      (a, b) =>
        statusOrder.indexOf(a.conversation_status) - statusOrder.indexOf(b.conversation_status)
    );

  return ok({
    tenant: {
      client_id: auth.clientId,
      client_name: tenantClient?.name ?? null,
      user_email: auth.user.email ?? null
    },
    leads: ordered
  });
}
