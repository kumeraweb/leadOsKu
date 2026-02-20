import { z } from 'zod';
import { requireTenantClientId } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { decryptSecret } from '@/lib/domain/crypto';
import { sendWhatsappText } from '@/lib/domain/messaging';

const bodySchema = z.object({
  text: z.string().min(1).max(2000)
});

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const auth = await requireTenantClientId();
  if ('error' in auth) {
    return fail(auth.error, auth.status);
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail('Invalid payload', 400);
  }

  const { leadId } = params;

  const { data: lead, error: leadError } = await auth.supabase
    .from('leads')
    .select('id, wa_user_id, conversation_status')
    .eq('id', leadId)
    .eq('client_id', auth.clientId)
    .maybeSingle();

  if (leadError) {
    return fail(leadError.message, 500);
  }

  if (!lead) {
    return fail('Lead not found', 404);
  }

  if (lead.conversation_status === 'CLOSED') {
    return fail('Lead is closed', 409);
  }

  const { data: latestMsg } = await auth.supabase
    .from('messages')
    .select('phone_number_id')
    .eq('lead_id', leadId)
    .eq('client_id', auth.clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const service = createSupabaseServiceClient();

  let phoneNumberId = latestMsg?.phone_number_id;

  if (!phoneNumberId) {
    const { data: anyChannel } = await service
      .from('client_channels')
      .select('phone_number_id')
      .eq('client_id', auth.clientId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    phoneNumberId = anyChannel?.phone_number_id;
  }

  if (!phoneNumberId) {
    return fail('No active channel for client', 409);
  }

  const { data: channel, error: channelError } = await service
    .from('client_channels')
    .select('meta_access_token_enc')
    .eq('client_id', auth.clientId)
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();

  if (channelError) {
    return fail(channelError.message, 500);
  }

  if (!channel) {
    return fail('Channel not found', 404);
  }

  const accessToken = decryptSecret(channel.meta_access_token_enc);
  const text = parsed.data.text.trim();

  const waResponse = await sendWhatsappText({
    phoneNumberId,
    accessToken,
    to: lead.wa_user_id,
    text
  });

  await service.from('messages').insert({
    client_id: auth.clientId,
    lead_id: lead.id,
    direction: 'OUTBOUND',
    phone_number_id: phoneNumberId,
    wa_message_id: waResponse?.messages?.[0]?.id ?? null,
    text_content: text,
    raw_payload: waResponse ?? {}
  });

  await service
    .from('leads')
    .update({ last_bot_message_at: new Date().toISOString() })
    .eq('id', lead.id)
    .eq('client_id', auth.clientId);

  return ok({ sent: true });
}
