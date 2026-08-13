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

  /**
   * `accepted → in_progress` est délibérément absente d'ici.
   *
   * ─────────────────────────────────────────────────────────────────────────────
   * POURQUOI CETTE TRANSITION N'A PAS SA PLACE DANS CETTE CARTE
   *
   * Le panneau « Interventions » propose déjà « Démarrer une intervention », qui
   * fait le geste COMPLET : il passe la mission en cours, crée l'intervention,
   * lance le relevé de temps et ouvre le compte rendu.
   *
   * La même transition offerte ici n'en faisait que la moitié — elle changeait le
   * statut sans rien créer. On obtenait une mission « en cours » sans
   * intervention derrière : ni chronomètre, ni compte rendu. Deux boutons au
   * libellé quasi identique, dont l'un tenait mal sa promesse.
   *
   * Les autres transitions restent ici : terminer les travaux, annuler,
   * reprendre après un refus. Elles ne décrivent que l'avancement, et n'ont
   * aucune contrepartie à créer.
   * ─────────────────────────────────────────────────────────────────────────────
   */
  const transitions = getPermittedTransitions({
    from: mission.status,
    role,
    isAssignee,
  }).filter((rule) => !(rule.from === 'accepted' && rule.to === 'in_progress'));

  if (transitions.length === 0) {
    // Sur une mission acceptée, l'action existe — elle est simplement ailleurs,
    // dans le panneau qui crée l'intervention. Afficher « aucune action » ici
    // ferait croire à un blocage à trois centimètres du bouton qui débloque.
    if (mission.status === 'accepted' && isAssignee) {
      return (
        <p className="text-muted-foreground text-xs">
          Mission acceptée. Utilisez «&nbsp;Démarrer une intervention&nbsp;» ci-dessous : le
          relevé du temps et le compte rendu s’ouvrent en même temps.
        </p>
      );
    }

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
