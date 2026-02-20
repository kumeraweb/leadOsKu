export type FlowOption = {
  id: string;
  option_order: number;
  option_code: string;
  label_text: string;
  score_delta: number;
  is_contact_human: boolean;
  is_terminal: boolean;
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function renderStepPrompt(promptText: string, options: FlowOption[]): string {
  const lines = [promptText];
  for (const option of options) {
    lines.push(`${option.option_order}) ${option.label_text}`);
  }
  return lines.join('\n');
}

export function formatOutOfScopeMessage(promptText: string, options: FlowOption[]): string {
  return [
    'Puedo ayudarte solo con las opciones del servicio disponible.',
    'Por favor responde con el número de una opción:',
    '',
    renderStepPrompt(promptText, options)
  ].join('\n');
}

export function extractDirectOption(input: string, options: FlowOption[]): FlowOption | null {
  const text = normalize(input);
  if (!text) return null;

  const numberMatch = text.match(/\b(\d{1,2})\b/);
  if (numberMatch) {
    const order = Number(numberMatch[1]);
    const byOrder = options.find((o) => o.option_order === order);
    if (byOrder) return byOrder;
  }

  for (const option of options) {
    const code = normalize(option.option_code);
    if (code && text === code) return option;
  }

  for (const option of options) {
    const label = normalize(option.label_text);
    if (label && (text === label || text.includes(label))) {
      return option;
    }
  }

  return null;
}

export function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

