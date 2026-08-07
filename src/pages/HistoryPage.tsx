import { Clock } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

/**
 * Historique d'utilisation.
 *
 * La table `tool_history` est en ajout seul et cloisonnée par utilisateur
 * (Phase 1). L'affichage sera branché quand des outils produiront des entrées.
 */
export default function HistoryPage() {
  const entries: readonly never[] = [];

  return (
    <>
      <PageHeader title="Historique" description="Les derniers outils que vous avez utilisés." />

      {entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Aucun historique"
          description="Dès que vous utiliserez un outil, il apparaîtra ici pour que vous puissiez y revenir rapidement."
          action={
            <Button asChild size="sm">
              <Link to={ROUTES.tools}>Découvrir les outils</Link>
            </Button>
          }
        />
      ) : null}
    </>
  );
}
