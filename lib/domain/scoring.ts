export type IntentDetected =
  | 'LOW_INTENT'
  | 'MEDIUM_INTENT'
  | 'HIGH_INTENT'
  | 'INFORMATION_ONLY'
  | 'USER_REQUEST_HUMAN';

const SCORE_MAP: Record<IntentDetected, number> = {
  HIGH_INTENT: 40,
  MEDIUM_INTENT: 20,
  LOW_INTENT: 5,
  USER_REQUEST_HUMAN: 100,
  INFORMATION_ONLY: 0
};

export function mapIntentToIncrement(intent: IntentDetected): number {
  return SCORE_MAP[intent] ?? 0;
}
