import { z } from 'zod';
import { requireBackofficeAdmin } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';

const optionSchema = z.object({
  option_order: z.number().int().min(1).max(20),
  option_code: z.string().min(1),
  label_text: z.string().min(1),
  score_delta: z.number().int().min(-100).max(100).default(0),
  is_contact_human: z.boolean().default(false),
  is_terminal: z.boolean().default(false)
});

const stepSchema = z.object({
  step_order: z.number().int().min(1).max(50),
  prompt_text: z.string().min(1),
  allow_free_text: z.boolean().default(false),
  options: z.array(optionSchema).min(1).max(20)
});

const createFlowSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1),
  welcome_message: z.string().min(1),
  is_active: z.boolean().default(true),
  max_steps: z.number().int().min(1).max(20).default(4),
  max_irrelevant_streak: z.number().int().min(1).max(10).default(2),
  max_reminders: z.number().int().min(0).max(10).default(2),
  reminder_delay_minutes: z.number().int().min(1).max(10080).default(30),
  steps: z.array(stepSchema).min(1).max(20)
});

export async function POST(req: Request) {
  const auth = await requireBackofficeAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);

  const payload = await req.json().catch(() => null);
  const parsed = createFlowSchema.safeParse(payload);
  if (!parsed.success) return fail('Invalid payload', 400);

  const body = parsed.data;

  if (body.is_active) {
    const deactivate = await auth.serviceSupabase
      .from('client_flows')
      .update({ is_active: false })
      .eq('client_id', body.client_id)
      .eq('is_active', true);
    if (deactivate.error) return fail(deactivate.error.message, 500);
  }

  const { data: flow, error: flowError } = await auth.serviceSupabase
    .from('client_flows')
    .insert({
      client_id: body.client_id,
      name: body.name,
      welcome_message: body.welcome_message,
      is_active: body.is_active,
      max_steps: body.max_steps,
      max_irrelevant_streak: body.max_irrelevant_streak,
      max_reminders: body.max_reminders,
      reminder_delay_minutes: body.reminder_delay_minutes
    })
    .select('id, client_id, name, is_active')
    .single();
  if (flowError || !flow) return fail(flowError?.message ?? 'Could not create flow', 500);

  const orderedSteps = [...body.steps].sort((a, b) => a.step_order - b.step_order);

  for (const step of orderedSteps) {
    const { data: createdStep, error: stepError } = await auth.serviceSupabase
      .from('flow_steps')
      .insert({
        flow_id: flow.id,
        step_order: step.step_order,
        prompt_text: step.prompt_text,
        allow_free_text: step.allow_free_text
      })
      .select('id, step_order')
      .single();
    if (stepError || !createdStep) {
      return fail(stepError?.message ?? 'Could not create flow step', 500);
    }

    const optionsPayload = step.options.map((option) => ({
      step_id: createdStep.id,
      option_order: option.option_order,
      option_code: option.option_code,
      label_text: option.label_text,
      score_delta: option.score_delta,
      is_contact_human: option.is_contact_human,
      is_terminal: option.is_terminal
    }));

    const { error: optionsError } = await auth.serviceSupabase
      .from('flow_step_options')
      .insert(optionsPayload);
    if (optionsError) {
      return fail(optionsError.message, 500);
    }
  }

  return ok({ flow }, 201);
}

