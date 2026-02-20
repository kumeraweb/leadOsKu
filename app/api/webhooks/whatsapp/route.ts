import { z } from 'zod';
import { NextResponse } from 'next/server';
import { ok, fail } from '@/lib/domain/http';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { decryptSecret } from '@/lib/domain/crypto';
import { sendWhatsappText } from '@/lib/domain/messaging';
import { sendLeadNotificationEmail } from '@/lib/domain/email';
import { mapTextToOptionDefensively } from '@/lib/domain/ai';
import {
  clampScore,
  extractDirectOption,
  FlowOption,
  formatOutOfScopeMessage,
  renderOptionsList,
  renderStepPrompt,
  wantsOptionsList
} from '@/lib/domain/deterministic-flow';

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

type ParsedPayload = {
  phoneNumberId: string;
  waUserId: string;
  text: string;
  waMessageId?: string;
  waProfileName: string | null;
  rawPayload: unknown;
};

type LeadRow = {
  id: string;
  score: number;
  flow_id: string | null;
  current_step_id: string | null;
  reminders_sent: number;
  irrelevant_streak: number;
  conversation_status: 'ACTIVE' | 'HUMAN_REQUIRED' | 'HUMAN_TAKEN' | 'CLOSED';
  notified_at: string | null;
  wa_profile_name: string | null;
  extracted_fields: Record<string, unknown> | null;
};

type FlowRow = {
  id: string;
  client_id: string;
  name: string;
  welcome_message: string;
  max_reminders: number;
  reminder_delay_minutes: number;
  max_irrelevant_streak: number;
};

type StepRow = {
  id: string;
  flow_id: string;
  step_order: number;
  prompt_text: string;
  allow_free_text: boolean;
};

function parsePayload(payload: unknown): ParsedPayload | null {
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

function addMinutesIso(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60 * 1000).toISOString();
}

function normalizeInput(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function sendBotMessage(params: {
  service: ReturnType<typeof createSupabaseServiceClient>;
  clientId: string;
  leadId: string;
  phoneNumberId: string;
  waUserId: string;
  accessTokenEnc: string;
  text: string;
  rawPayload?: unknown;
}) {
  const accessToken = decryptSecret(params.accessTokenEnc);
  const waResponse = await sendWhatsappText({
    phoneNumberId: params.phoneNumberId,
    accessToken,
    to: params.waUserId,
    text: params.text
  });

  const insertOutbound = await params.service.from('messages').insert({
    client_id: params.clientId,
    lead_id: params.leadId,
    direction: 'OUTBOUND',
    phone_number_id: params.phoneNumberId,
    wa_message_id: waResponse?.messages?.[0]?.id ?? null,
    text_content: params.text,
    raw_payload: waResponse ?? params.rawPayload ?? {}
  });
  if (insertOutbound.error) {
    throw new Error(insertOutbound.error.message);
  }

  const touchLead = await params.service
    .from('leads')
    .update({ last_bot_message_at: new Date().toISOString() })
    .eq('id', params.leadId);
  if (touchLead.error) {
    throw new Error(touchLead.error.message);
  }
}

async function getActiveFlowBundle(service: ReturnType<typeof createSupabaseServiceClient>, clientId: string) {
  const { data: flow } = await service
    .from('client_flows')
    .select('id, client_id, name, welcome_message, max_reminders, reminder_delay_minutes, max_irrelevant_streak')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle<FlowRow>();

  if (!flow) {
    return null;
  }

  const { data: steps } = await service
    .from('flow_steps')
    .select('id, flow_id, step_order, prompt_text, allow_free_text')
    .eq('flow_id', flow.id)
    .order('step_order', { ascending: true });

  const firstStep = (steps ?? [])[0] as StepRow | undefined;
  if (!firstStep) return null;

  return { flow, firstStep };
}

async function getStepWithOptions(service: ReturnType<typeof createSupabaseServiceClient>, stepId: string) {
  const { data: step } = await service
    .from('flow_steps')
    .select('id, flow_id, step_order, prompt_text, allow_free_text')
    .eq('id', stepId)
    .maybeSingle<StepRow>();
  if (!step) return null;

  const { data: options } = await service
    .from('flow_step_options')
    .select('id, option_order, option_code, label_text, score_delta, is_contact_human, is_terminal')
    .eq('step_id', step.id)
    .order('option_order', { ascending: true });

  return { step, options: (options ?? []) as FlowOption[] };
}

async function getNextStep(service: ReturnType<typeof createSupabaseServiceClient>, flowId: string, currentOrder: number) {
  const { data: nextStep } = await service
    .from('flow_steps')
    .select('id, flow_id, step_order, prompt_text, allow_free_text')
    .eq('flow_id', flowId)
    .gt('step_order', currentOrder)
    .order('step_order', { ascending: true })
    .limit(1)
    .maybeSingle<StepRow>();

  return nextStep ?? null;
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
    .select('client_id, phone_number_id, is_active, meta_access_token_enc')
    .eq('phone_number_id', parsed.phoneNumberId)
    .eq('is_active', true)
    .maybeSingle();

  if (!channel) {
    return ok({ received: true, ignored: true });
  }

  const { data: client } = await service
    .from('clients')
    .select('id, name, score_threshold, notification_email, human_forward_number')
    .eq('id', channel.client_id)
    .maybeSingle();
  if (!client) {
    return ok({ received: true, ignored: true });
  }

  const { data: openLead } = await service
    .from('leads')
    .select(
      'id, score, flow_id, current_step_id, reminders_sent, irrelevant_streak, conversation_status, notified_at, wa_profile_name, extracted_fields'
    )
    .eq('client_id', client.id)
    .eq('wa_user_id', parsed.waUserId)
    .in('conversation_status', ['ACTIVE', 'HUMAN_REQUIRED', 'HUMAN_TAKEN'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<LeadRow>();

  let lead = openLead;
  let leadJustCreated = false;

  if (!lead) {
    const flowBundle = await getActiveFlowBundle(service, client.id);
    if (!flowBundle) {
      return ok({ received: true, ignored: true, reason: 'no_active_flow' });
    }

    const now = new Date();
    const { data: createdLead, error: createLeadError } = await service
      .from('leads')
      .insert({
        client_id: client.id,
        wa_user_id: parsed.waUserId,
        wa_profile_name: parsed.waProfileName,
        conversation_status: 'ACTIVE',
        score: 0,
        flow_id: flowBundle.flow.id,
        current_step_id: flowBundle.firstStep.id,
        current_step: flowBundle.firstStep.step_order,
        reminders_sent: 0,
        irrelevant_streak: 0,
        next_reminder_at: addMinutesIso(now, flowBundle.flow.reminder_delay_minutes)
      })
      .select(
        'id, score, flow_id, current_step_id, reminders_sent, irrelevant_streak, conversation_status, notified_at, wa_profile_name, extracted_fields'
      )
      .single<LeadRow>();

    if (createLeadError || !createdLead) {
      return fail(createLeadError?.message ?? 'Could not create lead', 500);
    }

    lead = createdLead;
    leadJustCreated = true;
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

  if (!lead.current_step_id || !lead.flow_id) {
    const flowBundle = await getActiveFlowBundle(service, client.id);
    if (!flowBundle) {
      return ok({ received: true, ignored: true, reason: 'no_active_flow' });
    }
    const now = new Date();
    const patchLead = await service
      .from('leads')
      .update({
        flow_id: flowBundle.flow.id,
        current_step_id: flowBundle.firstStep.id,
        current_step: flowBundle.firstStep.step_order,
        next_reminder_at: addMinutesIso(now, flowBundle.flow.reminder_delay_minutes)
      })
      .eq('id', lead.id);
    if (patchLead.error) {
      return fail(patchLead.error.message, 500);
    }
    lead.flow_id = flowBundle.flow.id;
    lead.current_step_id = flowBundle.firstStep.id;
  }

  const flowBundle = await getActiveFlowBundle(service, client.id);
  if (!flowBundle) {
    return ok({ received: true, ignored: true, reason: 'no_active_flow' });
  }

  const stepBundle = await getStepWithOptions(service, lead.current_step_id!);
  if (!stepBundle || stepBundle.options.length === 0) {
    return ok({ received: true, ignored: true, reason: 'invalid_step_or_options' });
  }

  const extractedFields =
    lead.extracted_fields && typeof lead.extracted_fields === 'object' ? lead.extracted_fields : {};
  const waitingTerminalChoice = extractedFields.awaiting_reentry_choice === true;

  if (leadJustCreated) {
    try {
      await sendBotMessage({
        service,
        clientId: client.id,
        leadId: lead.id,
        phoneNumberId: parsed.phoneNumberId,
        waUserId: parsed.waUserId,
        accessTokenEnc: channel.meta_access_token_enc,
        text: flowBundle.flow.welcome_message
      });

      await sendBotMessage({
        service,
        clientId: client.id,
        leadId: lead.id,
        phoneNumberId: parsed.phoneNumberId,
        waUserId: parsed.waUserId,
        accessTokenEnc: channel.meta_access_token_enc,
        text: renderStepPrompt(stepBundle.step.prompt_text, stepBundle.options)
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Could not send welcome message', 500);
    }

    return ok({ received: true, started: true });
  }

  if (waitingTerminalChoice) {
    const normalized = normalizeInput(parsed.text);

    if (normalized === '1') {
      const shouldNotify = !lead.notified_at;
      const escalateLead = await service
        .from('leads')
        .update({
          conversation_status: 'HUMAN_REQUIRED',
          human_required_reason: 'REENTRY_ESCALATION',
          notified_at: shouldNotify ? new Date().toISOString() : lead.notified_at,
          next_reminder_at: null,
          extracted_fields: { ...extractedFields, awaiting_reentry_choice: false },
          last_user_message_at: new Date().toISOString()
        })
        .eq('id', lead.id);
      if (escalateLead.error) {
        return fail(escalateLead.error.message, 500);
      }

      const handoffText = client.human_forward_number
        ? `Gracias. Te derivaré con un ejecutivo. También puedes escribir a ${client.human_forward_number}.`
        : 'Gracias. Te derivaré con un ejecutivo del equipo.';

      try {
        await sendBotMessage({
          service,
          clientId: client.id,
          leadId: lead.id,
          phoneNumberId: parsed.phoneNumberId,
          waUserId: parsed.waUserId,
          accessTokenEnc: channel.meta_access_token_enc,
          text: handoffText
        });
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Could not send reentry handoff', 500);
      }

      if (shouldNotify) {
        const emailResult = await sendLeadNotificationEmail({
          to: client.notification_email,
          subject: 'LeadOS: Lead requiere intervención humana',
          html: `<p>Lead: ${parsed.waProfileName ?? parsed.waUserId}</p><p>Score: ${lead.score}</p><p>Razón: REENTRY_ESCALATION</p>`
        });
        if (!emailResult.sent) {
          console.error('Lead notification email failed', {
            leadId: lead.id,
            clientId: client.id,
            reason: emailResult.reason
          });
        }
      }

      return ok({ received: true, escalated: true, reentry: true });
    }

    if (normalized === '0') {
      const { data: firstStep } = await service
        .from('flow_steps')
        .select('id, step_order, prompt_text')
        .eq('flow_id', lead.flow_id!)
        .order('step_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!firstStep) {
        return ok({ received: true, ignored: true, reason: 'missing_first_step' });
      }

      const { data: firstOptions } = await service
        .from('flow_step_options')
        .select('id, option_order, option_code, label_text, score_delta, is_contact_human, is_terminal')
        .eq('step_id', firstStep.id)
        .order('option_order', { ascending: true });

      const updateLead = await service
        .from('leads')
        .update({
          current_step_id: firstStep.id,
          current_step: firstStep.step_order,
          irrelevant_streak: 0,
          extracted_fields: { ...extractedFields, awaiting_reentry_choice: false },
          last_user_message_at: new Date().toISOString(),
          next_reminder_at: addMinutesIso(new Date(), Number(flowBundle.flow.reminder_delay_minutes))
        })
        .eq('id', lead.id);
      if (updateLead.error) {
        return fail(updateLead.error.message, 500);
      }

      try {
        await sendBotMessage({
          service,
          clientId: client.id,
          leadId: lead.id,
          phoneNumberId: parsed.phoneNumberId,
          waUserId: parsed.waUserId,
          accessTokenEnc: channel.meta_access_token_enc,
          text: ['Perfecto. Estas son todas las opciones:', renderOptionsList((firstOptions ?? []) as FlowOption[])].join('\n')
        });
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Could not send reentry options', 500);
      }

      return ok({ received: true, reentry: true, options: true });
    }

    try {
      await sendBotMessage({
        service,
        clientId: client.id,
        leadId: lead.id,
        phoneNumberId: parsed.phoneNumberId,
        waUserId: parsed.waUserId,
        accessTokenEnc: channel.meta_access_token_enc,
        text: 'Responde 0 para ver todas las opciones o 1 para hablar con una ejecutiva.'
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Could not send reentry hint', 500);
    }

    return ok({ received: true, waiting_reentry_choice: true });
  }

  const deterministicOption = extractDirectOption(parsed.text, stepBundle.options);
  let selectedOption = deterministicOption;
  let mappingSource: 'DIRECT_OPTION' | 'AI_MAPPED' | 'OUT_OF_SCOPE' = 'DIRECT_OPTION';
  let aiSummary: string | null = null;

  if (Number(lead.irrelevant_streak ?? 0) > 0 && wantsOptionsList(parsed.text)) {
    const recoverLead = await service
      .from('leads')
      .update({
        irrelevant_streak: 0,
        last_user_message_at: new Date().toISOString(),
        next_reminder_at: addMinutesIso(new Date(), Number(flowBundle.flow.reminder_delay_minutes))
      })
      .eq('id', lead.id);
    if (recoverLead.error) {
      return fail(recoverLead.error.message, 500);
    }

    try {
      await sendBotMessage({
        service,
        clientId: client.id,
        leadId: lead.id,
        phoneNumberId: parsed.phoneNumberId,
        waUserId: parsed.waUserId,
        accessTokenEnc: channel.meta_access_token_enc,
        text: ['Perfecto, estas son las opciones disponibles:', renderOptionsList(stepBundle.options)].join('\n')
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Could not send options list', 500);
    }

    return ok({ received: true, recovered_to_options: true });
  }

  if (!selectedOption) {
    const defensiveMap = await mapTextToOptionDefensively({
      messageText: parsed.text,
      businessName: client.name,
      stepPrompt: stepBundle.step.prompt_text,
      options: stepBundle.options.map((o) => ({ option_code: o.option_code, label_text: o.label_text }))
    });

    aiSummary = defensiveMap.summary;

    if (defensiveMap.mapped_option_code) {
      const byCode = stepBundle.options.find((o) => o.option_code === defensiveMap.mapped_option_code);
      if (byCode) {
        selectedOption = byCode;
        mappingSource = 'AI_MAPPED';
      }
    }

    if (!selectedOption) {
      mappingSource = 'OUT_OF_SCOPE';
      const nextIrrelevantStreak = Number(lead.irrelevant_streak ?? 0) + 1;

      const logOutOfScope = await service.from('lead_step_events').insert({
        client_id: client.id,
        lead_id: lead.id,
        flow_id: stepBundle.step.flow_id,
        step_id: stepBundle.step.id,
        raw_user_text: parsed.text,
        selected_option_id: null,
        mapping_source: 'OUT_OF_SCOPE',
        ai_summary: aiSummary,
        ai_out_of_scope: true
      });
      if (logOutOfScope.error) {
        return fail(logOutOfScope.error.message, 500);
      }

      if (nextIrrelevantStreak >= Number(flowBundle.flow.max_irrelevant_streak)) {
        const closeLead = await service
          .from('leads')
          .update({
            conversation_status: 'CLOSED',
            closed_at: new Date().toISOString(),
            irrelevant_streak: nextIrrelevantStreak,
            free_text_summary: aiSummary,
            next_reminder_at: null,
            last_user_message_at: new Date().toISOString()
          })
          .eq('id', lead.id);
        if (closeLead.error) {
          return fail(closeLead.error.message, 500);
        }

        try {
          await sendBotMessage({
            service,
            clientId: client.id,
            leadId: lead.id,
            phoneNumberId: parsed.phoneNumberId,
            waUserId: parsed.waUserId,
            accessTokenEnc: channel.meta_access_token_enc,
            text: 'Por ahora solo puedo ayudarte con los servicios configurados. Si quieres, vuelve a escribirnos para retomar.'
          });
        } catch (error) {
          return fail(error instanceof Error ? error.message : 'Could not send close message', 500);
        }

        return ok({ received: true, closed_out_of_scope: true });
      }

      const updateLead = await service
        .from('leads')
        .update({
          irrelevant_streak: nextIrrelevantStreak,
          free_text_summary: aiSummary,
          last_user_message_at: new Date().toISOString(),
          next_reminder_at: addMinutesIso(new Date(), Number(flowBundle.flow.reminder_delay_minutes))
        })
        .eq('id', lead.id);
      if (updateLead.error) {
        return fail(updateLead.error.message, 500);
      }

      try {
        await sendBotMessage({
          service,
          clientId: client.id,
          leadId: lead.id,
          phoneNumberId: parsed.phoneNumberId,
          waUserId: parsed.waUserId,
          accessTokenEnc: channel.meta_access_token_enc,
          text: formatOutOfScopeMessage(stepBundle.step.prompt_text, stepBundle.options)
        });
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Could not send guidance message', 500);
      }

      return ok({ received: true, out_of_scope: true });
    }
  }

  const nextScore = clampScore(Number(lead.score ?? 0) + Number(selectedOption.score_delta ?? 0));
  const logStep = await service.from('lead_step_events').insert({
    client_id: client.id,
    lead_id: lead.id,
    flow_id: stepBundle.step.flow_id,
    step_id: stepBundle.step.id,
    raw_user_text: parsed.text,
    selected_option_id: selectedOption.id,
    mapping_source: mappingSource,
    ai_summary: aiSummary,
    ai_out_of_scope: false
  });
  if (logStep.error) {
    return fail(logStep.error.message, 500);
  }

  const baseLeadUpdate = {
    score: nextScore,
    irrelevant_streak: 0,
    free_text_summary: aiSummary,
    wa_profile_name: lead.wa_profile_name ?? parsed.waProfileName,
    last_user_message_at: new Date().toISOString(),
    extracted_fields: { ...extractedFields, awaiting_reentry_choice: false }
  };

  const shouldEscalateByOption = selectedOption.is_contact_human;
  const shouldEscalateByScore = nextScore >= Number(client.score_threshold ?? 100);

  if (shouldEscalateByOption || shouldEscalateByScore) {
    const reason = shouldEscalateByOption ? 'USER_REQUEST' : 'SCORE_THRESHOLD';
    const shouldNotify = !lead.notified_at;
    const escalateLead = await service
      .from('leads')
      .update({
        ...baseLeadUpdate,
        conversation_status: 'HUMAN_REQUIRED',
        human_required_reason: reason,
        notified_at: shouldNotify ? new Date().toISOString() : lead.notified_at,
        next_reminder_at: null
      })
      .eq('id', lead.id);
    if (escalateLead.error) {
      return fail(escalateLead.error.message, 500);
    }

    const handoffText = client.human_forward_number
      ? `Gracias. Te derivaré con un ejecutivo. También puedes escribir a ${client.human_forward_number}.`
      : 'Gracias. Te derivaré con un ejecutivo del equipo.';

    try {
      await sendBotMessage({
        service,
        clientId: client.id,
        leadId: lead.id,
        phoneNumberId: parsed.phoneNumberId,
        waUserId: parsed.waUserId,
        accessTokenEnc: channel.meta_access_token_enc,
        text: handoffText
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Could not send handoff message', 500);
    }

    if (shouldNotify) {
      const emailResult = await sendLeadNotificationEmail({
        to: client.notification_email,
        subject: 'LeadOS: Lead requiere intervención humana',
        html: `<p>Lead: ${parsed.waProfileName ?? parsed.waUserId}</p><p>Score: ${nextScore}</p><p>Razón: ${reason}</p>`
      });
      if (!emailResult.sent) {
        console.error('Lead notification email failed', {
          leadId: lead.id,
          clientId: client.id,
          reason: emailResult.reason
        });
      }
    }

    return ok({ received: true, escalated: true });
  }

  if (selectedOption.is_terminal) {
    const keepLeadOpen = await service
      .from('leads')
      .update({
        ...baseLeadUpdate,
        extracted_fields: { ...extractedFields, awaiting_reentry_choice: true },
        next_reminder_at: null
      })
      .eq('id', lead.id);
    if (keepLeadOpen.error) {
      return fail(keepLeadOpen.error.message, 500);
    }

    try {
      await sendBotMessage({
        service,
        clientId: client.id,
        leadId: lead.id,
        phoneNumberId: parsed.phoneNumberId,
        waUserId: parsed.waUserId,
        accessTokenEnc: channel.meta_access_token_enc,
        text: 'Perfecto, gracias por tu respuesta. Puedes responder 0 para ver todas las opciones o 1 para hablar de inmediato con una ejecutiva.'
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Could not send terminal message', 500);
    }

    return ok({ received: true, terminal_choice_requested: true });
  }

  const nextStep = await getNextStep(service, stepBundle.step.flow_id, stepBundle.step.step_order);
  if (!nextStep) {
    const closeLead = await service
      .from('leads')
      .update({
        ...baseLeadUpdate,
        conversation_status: 'HUMAN_REQUIRED',
        human_required_reason: 'FLOW_COMPLETED',
        next_reminder_at: null
      })
      .eq('id', lead.id);
    if (closeLead.error) {
      return fail(closeLead.error.message, 500);
    }
    return ok({ received: true, flow_completed: true });
  }

  const updateLead = await service
    .from('leads')
    .update({
      ...baseLeadUpdate,
      current_step_id: nextStep.id,
      current_step: nextStep.step_order,
      next_reminder_at: addMinutesIso(new Date(), Number(flowBundle.flow.reminder_delay_minutes))
    })
    .eq('id', lead.id);
  if (updateLead.error) {
    return fail(updateLead.error.message, 500);
  }

  const { data: nextOptions } = await service
    .from('flow_step_options')
    .select('id, option_order, option_code, label_text, score_delta, is_contact_human, is_terminal')
    .eq('step_id', nextStep.id)
    .order('option_order', { ascending: true });

  const nextText = renderStepPrompt(nextStep.prompt_text, (nextOptions ?? []) as FlowOption[]);

  try {
    await sendBotMessage({
      service,
      clientId: client.id,
      leadId: lead.id,
      phoneNumberId: parsed.phoneNumberId,
      waUserId: parsed.waUserId,
      accessTokenEnc: channel.meta_access_token_enc,
      text: nextText
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Could not send next step', 500);
  }

  return ok({ received: true, advanced: true });
}
