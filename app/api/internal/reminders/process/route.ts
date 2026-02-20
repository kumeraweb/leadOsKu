import { fail, ok } from '@/lib/domain/http';
import { env } from '@/lib/env';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { decryptSecret } from '@/lib/domain/crypto';
import { sendWhatsappText } from '@/lib/domain/messaging';
import { renderStepPrompt, type FlowOption } from '@/lib/domain/deterministic-flow';

type ReminderJob = {
  id: string;
  client_id: string;
  lead_id: string;
  reminder_number: number;
  scheduled_for: string;
  status: 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED';
};

type LeadRow = {
  id: string;
  client_id: string;
  wa_user_id: string;
  conversation_status: 'ACTIVE' | 'HUMAN_REQUIRED' | 'HUMAN_TAKEN' | 'CLOSED';
  flow_id: string | null;
  current_step_id: string | null;
  reminders_sent: number;
};

type FlowRow = {
  id: string;
  reminder_delay_minutes: number;
  max_reminders: number;
};

type StepRow = {
  id: string;
  flow_id: string;
  step_order: number;
  prompt_text: string;
};

function addMinutesIso(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60 * 1000).toISOString();
}

function isAuthorized(req: Request): boolean {
  const configured = env.internalCronSecret ?? env.cronSecret;
  if (!configured) {
    return process.env.NODE_ENV !== 'production';
  }

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const fromHeader = req.headers.get('x-internal-cron-secret');
  const fromQuery = new URL(req.url).searchParams.get('secret');
  const provided = bearer ?? fromHeader ?? fromQuery ?? '';

  return provided === configured;
}

async function processDueReminders() {
  const service = createSupabaseServiceClient();
  const nowIso = new Date().toISOString();
  const summary = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: jobs, error: jobsError } = await service
    .from('reminder_jobs')
    .select('id, client_id, lead_id, reminder_number, scheduled_for, status')
    .eq('status', 'PENDING')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(50);

  if (jobsError) {
    throw new Error(jobsError.message);
  }

  for (const job of (jobs ?? []) as ReminderJob[]) {
    summary.processed += 1;
    try {
      const { data: lead } = await service
        .from('leads')
        .select('id, client_id, wa_user_id, conversation_status, flow_id, current_step_id, reminders_sent')
        .eq('id', job.lead_id)
        .eq('client_id', job.client_id)
        .maybeSingle<LeadRow>();

      if (!lead || lead.conversation_status !== 'ACTIVE' || !lead.flow_id || !lead.current_step_id) {
        await service
          .from('reminder_jobs')
          .update({
            status: 'SKIPPED',
            sent_at: new Date().toISOString(),
            error_text: 'Lead not active or missing flow/current step'
          })
          .eq('id', job.id)
          .eq('status', 'PENDING');
        summary.skipped += 1;
        continue;
      }

      const [{ data: flow }, { data: step }, { data: firstStep }] = await Promise.all([
        service
          .from('client_flows')
          .select('id, reminder_delay_minutes, max_reminders')
          .eq('id', lead.flow_id)
          .maybeSingle<FlowRow>(),
        service
          .from('flow_steps')
          .select('id, flow_id, step_order, prompt_text')
          .eq('id', lead.current_step_id)
          .maybeSingle<StepRow>(),
        service
          .from('flow_steps')
          .select('id')
          .eq('flow_id', lead.flow_id)
          .order('step_order', { ascending: true })
          .limit(1)
          .maybeSingle<{ id: string }>()
      ]);

      if (!flow || !step) {
        await service
          .from('reminder_jobs')
          .update({
            status: 'SKIPPED',
            sent_at: new Date().toISOString(),
            error_text: 'Missing flow or step'
          })
          .eq('id', job.id)
          .eq('status', 'PENDING');
        summary.skipped += 1;
        continue;
      }

      if (lead.reminders_sent >= flow.max_reminders) {
        await Promise.all([
          service
            .from('reminder_jobs')
            .update({
              status: 'SKIPPED',
              sent_at: new Date().toISOString(),
              error_text: 'Reminder limit reached'
            })
            .eq('id', job.id)
            .eq('status', 'PENDING'),
          service.from('leads').update({ next_reminder_at: null }).eq('id', lead.id)
        ]);
        summary.skipped += 1;
        continue;
      }

      const { data: options } = await service
        .from('flow_step_options')
        .select('id, option_order, option_code, label_text, score_delta, is_contact_human, is_terminal, next_step_id')
        .eq('step_id', step.id)
        .order('option_order', { ascending: true });

      const { data: lastMsg } = await service
        .from('messages')
        .select('phone_number_id')
        .eq('lead_id', lead.id)
        .eq('client_id', lead.client_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let phoneNumberId = lastMsg?.phone_number_id ?? null;
      if (!phoneNumberId) {
        const { data: anyChannel } = await service
          .from('client_channels')
          .select('phone_number_id')
          .eq('client_id', lead.client_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        phoneNumberId = anyChannel?.phone_number_id ?? null;
      }

      if (!phoneNumberId) {
        await service
          .from('reminder_jobs')
          .update({
            status: 'FAILED',
            sent_at: new Date().toISOString(),
            error_text: 'No active channel'
          })
          .eq('id', job.id)
          .eq('status', 'PENDING');
        summary.failed += 1;
        continue;
      }

      const { data: channel } = await service
        .from('client_channels')
        .select('meta_access_token_enc')
        .eq('client_id', lead.client_id)
        .eq('phone_number_id', phoneNumberId)
        .eq('is_active', true)
        .maybeSingle();

      if (!channel) {
        await service
          .from('reminder_jobs')
          .update({
            status: 'FAILED',
            sent_at: new Date().toISOString(),
            error_text: 'Channel not found'
          })
          .eq('id', job.id)
          .eq('status', 'PENDING');
        summary.failed += 1;
        continue;
      }

      const reminderText = [
        'Recordatorio 👋',
        renderStepPrompt(step.prompt_text, (options ?? []) as FlowOption[], {
          includeBackToMainMenu: firstStep?.id ? firstStep.id !== step.id : false
        })
      ].join('\n\n');

      const accessToken = decryptSecret(channel.meta_access_token_enc);
      const waResponse = await sendWhatsappText({
        phoneNumberId,
        accessToken,
        to: lead.wa_user_id,
        text: reminderText
      });

      const nextRemindersSent = Number(lead.reminders_sent ?? 0) + 1;
      const nextReminderAt =
        nextRemindersSent >= Number(flow.max_reminders)
          ? null
          : addMinutesIso(new Date(), Number(flow.reminder_delay_minutes));

      await Promise.all([
        service.from('messages').insert({
          client_id: lead.client_id,
          lead_id: lead.id,
          direction: 'OUTBOUND',
          phone_number_id: phoneNumberId,
          wa_message_id: waResponse?.messages?.[0]?.id ?? null,
          text_content: reminderText,
          raw_payload: waResponse ?? {}
        }),
        service
          .from('leads')
          .update({
            reminders_sent: nextRemindersSent,
            last_reminder_at: new Date().toISOString(),
            next_reminder_at: nextReminderAt,
            last_bot_message_at: new Date().toISOString()
          })
          .eq('id', lead.id),
        service
          .from('reminder_jobs')
          .update({
            status: 'SENT',
            sent_at: new Date().toISOString(),
            error_text: null
          })
          .eq('id', job.id)
          .eq('status', 'PENDING')
      ]);

      summary.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 700) : 'Unknown reminder error';
      await service
        .from('reminder_jobs')
        .update({
          status: 'FAILED',
          sent_at: new Date().toISOString(),
          error_text: message
        })
        .eq('id', job.id)
        .eq('status', 'PENDING');
      summary.failed += 1;
    }
  }

  return summary;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return fail('Unauthorized', 401);
  }
  const summary = await processDueReminders();
  return ok(summary);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return fail('Unauthorized', 401);
  }
  const summary = await processDueReminders();
  return ok(summary);
}
