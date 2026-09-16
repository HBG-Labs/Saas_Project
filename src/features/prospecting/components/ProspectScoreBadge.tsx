import { Badge } from '@/components/ui/Badge';

import { scoreTier } from '../lib/prospect-display';

const TIER_META = {
  forte: { emoji: '🔥', label: 'Opportunité forte', variant: 'error' as const },
  moyenne: { emoji: '🟠', label: 'Opportunité moyenne', variant: 'warning' as const },
  basse: { emoji: '🔵', label: 'Prospect détecté', variant: 'info' as const },
};

export function ProspectScoreBadge({ score }: { score: number }) {
  const tier = TIER_META[scoreTier(score)];

  return (
    <Badge variant={tier.variant} className="gap-1.5 text-xs">
      <span aria-hidden="true">{tier.emoji}</span>
      <span className="font-mono font-bold">{score}</span>
      <span className="sr-only">/100 — {tier.label}</span>
    </Badge>
  );
}
