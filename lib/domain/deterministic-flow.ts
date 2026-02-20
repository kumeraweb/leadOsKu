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

function promptAlreadyContainsOptions(promptText: string, options: FlowOption[]): boolean {
  const normalizedPrompt = normalize(promptText);
  if (/\n\s*1\)/.test(promptText) || /^\s*1\)/.test(promptText)) {
    return true;
  }

  return options.some((option) => normalizedPrompt.includes(normalize(option.label_text)));
}

export function renderOptionsList(options: FlowOption[]): string {
  return options.map((option) => `${option.option_order}) ${option.label_text}`).join('\n');
}

export function renderStepPrompt(promptText: string, options: FlowOption[]): string {
  if (promptAlreadyContainsOptions(promptText, options)) {
    return promptText;
  }

  return [promptText, renderOptionsList(options)].join('\n');
}

export function formatOutOfScopeMessage(promptText: string, options: FlowOption[]): string {
  if (options.length === 0) {
    return 'Puedo ayudarte solo con los servicios disponibles de Tractiva.';
  }

  return [
    'Puedo ayudarte solo con servicios de Google Ads.',
    "Si quieres ver las opciones válidas, responde: OPCIONES."
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

export function wantsOptionsList(input: string): boolean {
  const text = normalize(input);
  return (
    text === 'opciones' ||
    text === 'si' ||
    text === 'sí' ||
    text.includes('mostrar opciones') ||
    text.includes('ver opciones')
  );
}
