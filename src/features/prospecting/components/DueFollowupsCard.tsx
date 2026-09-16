import { Link } from 'react-router';

import { Card } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { formatDateTime } from '@/lib/format';

import { useDueFollowups } from '../hooks/useProspecting';

/** §21 : « RELANCES AUJOURD'HUI », affiché sur le tableau de bord. */
export function DueFollowupsCard() {
  const { data: followups, isPending } = useDueFollowups();

  if (isPending || !followups || followups.length === 0) return null;

  return (
    <Card className="border-warning-border bg-warning-subtle p-5 shadow-xs">
      <h2 className="text-warning text-sm font-bold">
        Relances aujourd’hui ({followups.length})
      </h2>
      <ul className="mt-3 space-y-2">
        {followups.map((followup) => (
          <li key={followup.id}>
            <Link
              to={ROUTES.prospect(followup.prospect.siren)}
              className="text-foreground hover:underline block text-xs"
            >
              <span className="font-semibold">
                {followup.prospect.nom_commercial ?? followup.prospect.raison_sociale}
              </span>
              <span className="text-muted-foreground"> — {formatDateTime(followup.due_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
