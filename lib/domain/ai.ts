import { env } from '@/lib/env';
import { IntentDetected } from '@/lib/domain/scoring';

type ClassifyResult = {
  intent_detected: IntentDetected;
  user_requested_human: boolean;
  extracted_fields: Record<string, unknown>;
};

const FALLBACK_RESULT: ClassifyResult = {
  intent_detected: 'INFORMATION_ONLY',
  user_requested_human: false,
  extracted_fields: {}
};

export async function classifyAndExtract(
  messageText: string,
  strategicQuestions: unknown
): Promise<ClassifyResult> {
  if (!env.openAiApiKey) {
    return FALLBACK_RESULT;
  }

  const prompt = [
    'Eres un clasificador de leads.',
    'No converses. No inventes.',
    'Devuelve solo JSON válido con estas llaves exactas:',
    'intent_detected, user_requested_human, extracted_fields.',
    'intent_detected debe ser uno de: LOW_INTENT, MEDIUM_INTENT, HIGH_INTENT, INFORMATION_ONLY, USER_REQUEST_HUMAN.',
    '',
    `Mensaje del usuario: ${messageText}`,
    `Preguntas estratégicas: ${JSON.stringify(strategicQuestions ?? [])}`
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Clasifica y extrae. Solo JSON válido.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    return FALLBACK_RESULT;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return FALLBACK_RESULT;
  }

  try {
    const parsed = JSON.parse(content) as ClassifyResult;
    if (!parsed.intent_detected) {
      return FALLBACK_RESULT;
    }
    return {
      intent_detected: parsed.intent_detected,
      user_requested_human: Boolean(parsed.user_requested_human),
      extracted_fields: parsed.extracted_fields ?? {}
    };
  } catch {
    return FALLBACK_RESULT;
  }
}
