import { Sparkles } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

interface HistoryUpgradeBannerProps {
  currentCount: number;
  maxLimit: number;
}

export function HistoryUpgradeBanner({ currentCount, maxLimit }: HistoryUpgradeBannerProps) {
  return (
    <div className="bg-primary/10 border-primary/30 rounded-xl border p-3.5 space-y-2 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-primary">
        <Sparkles className="size-4 shrink-0" />
        <span>Historique limité ({currentCount} / {maxLimit} calculs)</span>
      </div>

      <p className="text-muted-foreground text-2xs leading-relaxed">
        Sur la formule **Gratuite**, votre journal est limité aux {maxLimit} derniers calculs. Passez à la formule **Pro** (14,99 €/mois) pour débloquer un historique **illimité** et l&apos;exportation PDF certifiée.
      </p>

      <Button asChild variant="primary" size="sm" className="w-full text-2xs h-7 mt-1">
        <Link to={ROUTES.pricing}>Passer à l’offre Pro (Essai 14j)</Link>
      </Button>
    </div>
  );
}
