import { ArrowRight, Play, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { changeMissionStatus } from '@/features/missions';
import type { InterventionStatus, MissionStatus } from '@/types/database';

import { useMissionInterventions, useStartIntervention } from '../hooks/useInterventions';

export interface MissionInterventionsPanelProps {
  missionId: string;
  missionStatus: MissionStatus;
  /** `organization_members.id` de l'utilisateur courant, ou `null`. */
  myMemberId: string | null;
  /** L'utilisateur est-il l'intervenant affecté ? */
  isAssignee: boolean;
}

const STATUS_LABELS: Record<InterventionStatus, string> = {
  planned: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

const STATUS_VARIANTS: Record<InterventionStatus, NonNullable<BadgeProps['variant']>> = {
  planned: 'outline',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'neutral',
};

/**
 * Interventions rattachées à une mission.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE MAILLON QUI MANQUAIT
 *
 * La mission et l'intervention sont deux objets distincts : la première décrit
 * ce qu'il y a à faire, la seconde ce qui a été fait — et une mission peut en
 * compter plusieurs, un chantier revenant souvent sur deux passages.
 *
 * Sans cet écran, la machine à états de la mission avançait mais aucune ligne
 * d'`interventions` n'était jamais créée : le chronomètre et le compte rendu
 * restaient inatteignables. C'est ici que la chaîne se referme.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function MissionInterventionsPanel({
  missionId,
  missionStatus,
  myMemberId,
  isAssignee,
}: MissionInterventionsPanelProps) {
  const navigate = useNavigate();
  const interventions = useMissionInterventions(missionId);
  const startIntervention = useStartIntervention(missionId);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const list = interventions.data ?? [];
  const hasOpen = list.some((item) => item.status === 'in_progress');

  /**
   * Démarrer suppose une mission acceptée, et pas encore close.
   *
   * `draft` et `assigned` viennent trop tôt : personne n'a encore accepté le
   * travail. Les états terminaux viennent trop tard.
   */
  const canStart =
    isAssignee &&
    myMemberId !== null &&
    !hasOpen &&
    (missionStatus === 'accepted' || missionStatus === 'in_progress');

  const start = async () => {
    if (myMemberId === null) return;

    setError(null);
    setBusy(true);
    try {
      /**
       * La mission avance AVANT la création de l'intervention.
       *
       * Commencer à travailler, c'est factuellement passer la mission en cours :
       * demander à l'utilisateur de le déclarer séparément serait de la
       * bureaucratie, et il finirait par l'oublier — la mission resterait
       * « acceptée » pendant que le chronomètre tourne.
       *
       * Dans cet ordre parce que l'inverse laisserait une intervention ouverte
       * sur une mission qui n'a jamais démarré, alors qu'ici l'échec de la
       * seconde écriture laisse simplement une mission en cours sans
       * intervention — état visible, et rattrapable d'un clic.
       */
      if (missionStatus === 'accepted') {
        await changeMissionStatus(missionId, 'in_progress');
      }

      const intervention = await startIntervention.mutateAsync({
        missionId,
        technicianId: myMemberId,
      });

      await navigate(ROUTES.intervention(intervention.id));
    } catch (mutationError) {
      setError(mutationError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormError error={error} />

      {interventions.isPending ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Aucune intervention enregistrée. Le relevé du temps et le compte rendu s’ouvrent au
          démarrage.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {list.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
              <Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge>

              <span className="text-muted-foreground flex-1 font-mono text-xs tabular-nums">
                {item.start_time !== null
                  ? new Date(item.start_time).toLocaleString('fr-FR')
                  : 'Non démarrée'}
              </span>

              {item.report !== null ? (
                <Badge variant="outline">Compte rendu</Badge>
              ) : null}

              <Button asChild variant="ghost" size="sm">
                <Link to={ROUTES.intervention(item.id)}>
                  Ouvrir
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {canStart ? (
        <Button variant="primary" size="lg" onClick={() => void start()} disabled={busy}>
          <Play className="size-4" />
          {busy ? 'Démarrage…' : 'Démarrer une intervention'}
        </Button>
      ) : hasOpen && isAssignee ? (
        <p className="text-muted-foreground text-xs">
          Une intervention est en cours — ouvrez-la pour gérer le chronomètre et le compte rendu.
        </p>
      ) : !isAssignee && list.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Wrench className="size-3.5" aria-hidden="true" />
          Seul l’intervenant affecté peut démarrer une intervention.
        </p>
      ) : null}
    </div>
  );
}
