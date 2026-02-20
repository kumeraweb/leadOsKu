import { z } from 'zod';
import { NextResponse } from 'next/server';
import { ok, fail } from '@/lib/domain/http';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { classifyAndExtract } from '@/lib/domain/ai';
import { mapIntentToIncrement } from '@/lib/domain/scoring';
import {
  MAX_STEPS,
  getClosingMessage,
  getEscalationMessage,
  getNextQuestion,
  getQuestionSet
} from '@/lib/domain/flow';
import { decryptSecret } from '@/lib/domain/crypto';
import { sendWhatsappText } from '@/lib/domain/messaging';
import { sendLeadNotificationEmail } from '@/lib/domain/email';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'Missing WHATSAPP_WEBHOOK_VERIFY_TOKEN' },
      { status: 500 }
    );
  }

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 });
}

const webhookSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z.array(
          z.object({
            value: z.object({
              metadata: z.object({ phone_number_id: z.string() }).optional(),
              contacts: z
                .array(
                  z.object({
                    profile: z.object({ name: z.string().optional() }).optional()
                  })
                )
                .optional(),
              messages: z
                .array(
                  z.object({
                    from: z.string().optional(),
                    id: z.string().optional(),
                    text: z.object({ body: z.string().optional() }).optional()
                  })
                )
                .optional()
            })
          })
        )
      })
    )
    .optional()
});

function parsePayload(payload: unknown) {
  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) return null;

  const change = parsed.data.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];
  const phoneNumberId = change?.metadata?.phone_number_id;
  const waUserId = message?.from;
  const text = message?.text?.body ?? '';
  const waMessageId = message?.id;
  const waProfileName = change?.contacts?.[0]?.profile?.name ?? null;

  if (!phoneNumberId || !waUserId) {
    return null;
  }

  return { phoneNumberId, waUserId, text, waMessageId, waProfileName, rawPayload: payload };
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = parsePayload(payload);

  if (!parsed) {
    return ok({ received: true, ignored: true });
  }

  const service = createSupabaseServiceClient();

  const { data: channel } = await service
    .from('client_channels')
    .select('id, client_id, phone_number_id, is_active, meta_access_token_enc')
    .eq('phone_number_id', parsed.phoneNumberId)
    .eq('is_active', true)
    .maybeSingle();

  if (!channel) {
    return ok({ received: true, ignored: true });
  }

  const { data: client } = await service
    .from('clients')
    .select('id, score_threshold, strategic_questions, notification_email, human_forward_number')
    .eq('id', channel.client_id)
    .maybeSingle();

  if (!client) {
    return ok({ received: true, ignored: true });
  }

  const { data: openLead } = await service
    .from('leads')
    .select('*')
    .eq('client_id', client.id)
    .eq('wa_user_id', parsed.waUserId)
    .in('conversation_status', ['ACTIVE', 'HUMAN_REQUIRED', 'HUMAN_TAKEN'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let lead = openLead;

  if (!lead) {
    const { data: newLead, error: createLeadError } = await service
      .from('leads')
      .insert({
        client_id: client.id,
        wa_user_id: parsed.waUserId,
        wa_profile_name: parsed.waProfileName,
        conversation_status: 'ACTIVE',
        current_step: 0,
        score: 0
      })
      .select('*')
      .single();

    if (createLeadError || !newLead) {
      return fail(createLeadError?.message ?? 'Could not create lead', 500);
    }

    lead = newLead;
  }

  const inboundInsert = await service.from('messages').insert({
    client_id: client.id,
    lead_id: lead.id,
    direction: 'INBOUND',
    phone_number_id: parsed.phoneNumberId,
    wa_message_id: parsed.waMessageId ?? null,
    text_content: parsed.text,
    raw_payload: parsed.rawPayload ?? {}
  });

  if (inboundInsert.error?.code === '23505') {
    return ok({ received: true, deduplicated: true });
  }

  if (inboundInsert.error) {
    return fail(inboundInsert.error.message, 500);
  }

  if (lead.conversation_status !== 'ACTIVE') {
    return ok({ received: true, suppressed: true });
  }

  const ai = await classifyAndExtract(parsed.text, client.strategic_questions);
  const increment = mapIntentToIncrement(ai.intent_detected);
  const nextScore = Math.min(100, Number(lead.score ?? 0) + increment);
  const currentStep = Number(lead.current_step ?? 0);
  const questionSet = getQuestionSet(client.strategic_questions);
  const maxQuestionSteps = Math.min(MAX_STEPS, questionSet.length);

  const mergedFields = {
    ...(lead.extracted_fields && typeof lead.extracted_fields === 'object' ? lead.extracted_fields : {}),
    ...(ai.extracted_fields ?? {})
  };

  const { error: updateLeadStateError } = await service
    .from('leads')
    .update({
      score: nextScore,
      extracted_fields: mergedFields,
      last_user_message_at: new Date().toISOString(),
      wa_profile_name: lead.wa_profile_name ?? parsed.waProfileName
    })
    .eq('id', lead.id);
  if (updateLeadStateError) {
    return fail(updateLeadStateError.message, 500);
  }

  const escalateReason = ai.user_requested_human
    ? 'USER_REQUEST'
    : nextScore >= Number(client.score_threshold)
      ? 'SCORE'
      : null;

  const accessToken = decryptSecret(channel.meta_access_token_enc);

  if (escalateReason) {
    const shouldNotify = !lead.notified_at;

    const { error: escalateUpdateError } = await service
      .from('leads')
      .update({
        conversation_status: 'HUMAN_REQUIRED',
        human_required_reason: escalateReason,
        notified_at: shouldNotify ? new Date().toISOString() : lead.notified_at
      })
      .eq('id', lead.id);
    if (escalateUpdateError) {
      return fail(escalateUpdateError.message, 500);
    }

    const escalationText = getEscalationMessage(client.human_forward_number);

    const waResponse = await sendWhatsappText({
      phoneNumberId: parsed.phoneNumberId,
      accessToken,
      to: parsed.waUserId,
      text: escalationText
    });

    const outWaMessageId = waResponse?.messages?.[0]?.id ?? null;

    const { error: escalationMessageInsertError } = await service.from('messages').insert({
      client_id: client.id,
      lead_id: lead.id,
      direction: 'OUTBOUND',
      phone_number_id: parsed.phoneNumberId,
      wa_message_id: outWaMessageId,
      text_content: escalationText,
      raw_payload: waResponse ?? {}
    });
    if (escalationMessageInsertError) {
      return fail(escalationMessageInsertError.message, 500);
    }

    const { error: escalateTimestampError } = await service
      .from('leads')
      .update({ last_bot_message_at: new Date().toISOString() })
      .eq('id', lead.id);
    if (escalateTimestampError) {
      return fail(escalateTimestampError.message, 500);
    }

    if (shouldNotify) {
      const emailResult = await sendLeadNotificationEmail({
        to: client.notification_email,
        subject: 'LeadOS: Lead requiere intervención humana',
        html: `<p>Lead: ${parsed.waProfileName ?? parsed.waUserId}</p><p>Score: ${nextScore}</p><p>Razón: ${escalateReason}</p>`
      });
      if (!emailResult.sent) {
        console.error('Lead notification email failed', {
          leadId: lead.id,
          clientId: client.id,
          reason: emailResult.reason,
          status: 'status' in emailResult ? emailResult.status : undefined
        });
      }
    }

    return ok({ received: true, escalated: true });
  }

  const candidateBotText = currentStep >= maxQuestionSteps
    ? getClosingMessage()
    : getNextQuestion(client.strategic_questions, currentStep);

  const { data: previousOutbound } = await service
    .from('messages')
    .select('text_content')
    .eq('lead_id', lead.id)
    .eq('client_id', client.id)
    .eq('direction', 'OUTBOUND')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Avoid sending the same guided question twice in a row.
  const botText =
    previousOutbound?.text_content &&
    previousOutbound.text_content === candidateBotText &&
    candidateBotText !== getClosingMessage()
      ? getClosingMessage()
      : candidateBotText;

  const waResponse = await sendWhatsappText({
    phoneNumberId: parsed.phoneNumberId,
    accessToken,
    to: parsed.waUserId,
    text: botText
  });

  const outWaMessageId = waResponse?.messages?.[0]?.id ?? null;

  const { error: outboundInsertError } = await service.from('messages').insert({
    client_id: client.id,
    lead_id: lead.id,
    direction: 'OUTBOUND',
    phone_number_id: parsed.phoneNumberId,
    wa_message_id: outWaMessageId,
    text_content: botText,
    raw_payload: waResponse ?? {}
  });
  if (outboundInsertError) {
    return fail(outboundInsertError.message, 500);
  }

  const { error: advanceStepError } = await service
    .from('leads')
    .update({
      current_step: Math.min(MAX_STEPS, currentStep + 1),
      last_bot_message_at: new Date().toISOString()
    })
    .eq('id', lead.id);
  if (advanceStepError) {
    return fail(advanceStepError.message, 500);
  }

  return ok({ received: true, escalated: false });
}
