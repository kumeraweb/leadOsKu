export const MAX_STEPS = 4;
const FALLBACK_QUESTIONS = [
  'Hola. Soy el asistente automático. ¿Qué servicio te interesa?',
  'Perfecto. ¿Ya inviertes actualmente en publicidad?',
  'Gracias. ¿Cuál es tu objetivo principal este mes?'
];

export function getEscalationMessage(humanForwardNumber?: string | null): string {
  if (humanForwardNumber) {
    return `Genial, te pondré en contacto con nuestro equipo. También puedes escribir a ${humanForwardNumber}.`;
  }
  return 'Genial, te pondré en contacto con nuestro equipo de ventas.';
}

export function getClosingMessage(): string {
  return 'Gracias por escribir. En breve un asesor revisará tu caso.';
}

export function getQuestionSet(strategicQuestions: unknown): string[] {
  const questions = Array.isArray(strategicQuestions)
    ? strategicQuestions.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    : [];

  if (questions.length === 0) {
    return FALLBACK_QUESTIONS;
  }

  return questions;
}

export function getNextQuestion(strategicQuestions: unknown, currentStep: number): string {
  const questionSet = getQuestionSet(strategicQuestions);
  return questionSet[currentStep] ?? getClosingMessage();
}
