import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import type { OrgRole } from '@/types/database';
import type { MissionWithRelations } from '@/types/domain';

import { useChangeMissionStatus } from '../hooks/useMissions';
import { getPermittedTransitions } from '../workflow';

export interface MissionTransitionsProps {
  mission: MissionWithRelations;
  role: OrgRole | null;
  /** L'utilisateur courant est-il l'intervenant affecté ? */
  isAssignee: boolean;
}

/**
 * Actions de progression disponibles sur une mission.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE COMPOSANT NE PROTÈGE RIEN.
 *
 * `getPermittedTransitions` reproduit l'arbitrage du trigger
 * `enforce_mission_transition`, uniquement pour éviter d'offrir un bouton qui
 * échouera. Une transition forgée à la main est refusée par PostgreSQL, que ce
 * composant l'ait affichée ou non.
 *
 * Le miroir peut se tromper — il ne connaît pas l'état exact du serveur au
 * moment du clic. C'est pourquoi l'erreur reste affichée telle que le serveur
 * la formule, plutôt que masquée derrière un « une erreur est survenue » : quand
 * deux responsables valident le même compte rendu, le second doit lire qu'un
 * collègue l'a devancé, pas croire à une panne.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function MissionTransitions({ mission, role, isAssignee }: MissionTransitionsProps) {
  const changeStatus = useChangeMissionStatus(mission.id);
  const [error, setError] = useState<unknown>(null);

  const transitions = getPermittedTransitions({
    from: mission.status,
    role,
    isAssignee,
  });

  if (transitions.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Aucune action disponible à ce stade — soit la mission est close, soit elle attend
        quelqu’un d’autre.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <FormError error={error} />

      <div className="flex flex-wrap gap-2">
        {transitions.map((rule) => (
          <Button
            key={`${rule.from}-${rule.to}`}
            // Une seule action met en avant le parcours nominal ; les autres
            // (annuler, refuser) restent secondaires.
            variant={rule.to === 'cancelled' || rule.to === 'rejected' ? 'outline' : 'primary'}
            size="sm"
            disabled={changeStatus.isPending}
            onClick={() => {
              setError(null);
              changeStatus.mutate(rule.to, {
                onError: (mutationError) => {
                  setError(mutationError);
                },
              });
            }}
          >
            {rule.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
