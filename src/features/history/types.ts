export type PlanTier = 'free' | 'pro' | 'team';

export interface HistoryEntry {
  id: string;
  toolSlug: string;
  toolTitle: string;
  expression: string;
  formattedResult: string;
  timestamp: number; // Date.now()
}

export const PLAN_HISTORY_LIMITS: Record<PlanTier, number> = {
  free: 10,
  pro: Infinity,
  team: Infinity,
};
