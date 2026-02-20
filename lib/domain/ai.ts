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

type DefensiveMapResult = {
  mapped_option_code: string | null;
  out_of_scope: boolean;
  summary: string | null;
};

const DEFENSIVE_FALLBACK: DefensiveMapResult = {
  mapped_option_code: null,
  out_of_scope: false,
  summary: null
};

export async function mapTextToOptionDefensively(params: {
  messageText: string;
  businessName?: string | null;
  stepPrompt: string;
  options: Array<{ option_code: string; label_text: string }>;
}): Promise<DefensiveMapResult> {
  if (!env.openAiApiKey || params.options.length === 0) {
    return DEFENSIVE_FALLBACK;
  }

  const prompt = [
    'Tarea: mapear texto de usuario a una opción de un flujo comercial.',
    'Si no corresponde a ninguna opción, indicar null.',
    'Si está fuera del dominio del negocio, marcar out_of_scope=true.',
    'Responder solo JSON válido.',
    '',
    `Negocio: ${params.businessName ?? 'No informado'}`,
    `Paso actual: ${params.stepPrompt}`,
    `Opciones válidas: ${JSON.stringify(params.options)}`,
    `Texto usuario: ${params.messageText}`,
    '',
    'Respuesta JSON con llaves exactas:',
    '{"mapped_option_code": string|null, "out_of_scope": boolean, "summary": string|null}'
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
        { role: 'system', content: 'Mapea texto a opción. No inventes. Solo JSON válido.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    return DEFENSIVE_FALLBACK;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return DEFENSIVE_FALLBACK;
  }

  try {
    const parsed = JSON.parse(content) as DefensiveMapResult;
    return {
      mapped_option_code:
        typeof parsed.mapped_option_code === 'string' ? parsed.mapped_option_code : null,
      out_of_scope: Boolean(parsed.out_of_scope),
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : null
    };
  } catch {
    return DEFENSIVE_FALLBACK;
  }
}
