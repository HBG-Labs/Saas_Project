import { CheckCircle2, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { InterventionTimeEntry } from '@/types/domain';

import { useCompleteIntervention, useSwitchTimeEntry } from '../hooks/useInterventions';

export interface InterventionTimerProps {
  interventionId: string;
  organizationId: string;
  entries: readonly InterventionTimeEntry[];
  /** Temps net des segments CLOS, calculé par PostgreSQL. */
  workedSeconds: number;
  /** Le technicien de cette intervention, seul à pouvoir pointer. */
  canTrack: boolean;
  isCompleted: boolean;
}

/**
 * Chronomètre de terrain.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE COMPTEUR AFFICHÉ N'EST JAMAIS STOCKÉ.
 *
 * Il se recalcule à chaque seconde depuis `started_at`, l'heure posée par le
 * SERVEUR. Stocker un compteur inviterait l'incohérence dès qu'un onglet se
 * ferme, que l'écran se verrouille ou que le réseau tombe — trois situations
 * quotidiennes en intervention. Recalculer résiste à tout cela, et repart juste
 * au rechargement.
 *
 * Le temps net des segments terminés vient, lui, de PostgreSQL : c'est le même
 * calcul que celui qui servira à facturer.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function InterventionTimer({
  interventionId,
  organizationId,
  entries,
  workedSeconds,
  canTrack,
  isCompleted,
}: InterventionTimerProps) {
  const switchEntry = useSwitchTimeEntry(interventionId);
  const completeIntervention = useCompleteIntervention(interventionId);
  const [error, setError] = useState<unknown>(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  const openEntry = entries.find((entry) => entry.ended_at === null) ?? null;
  const isWorking = openEntry?.kind === 'work';
  const isPaused = openEntry?.kind === 'pause';

  // Tic d'une seconde, uniquement quand un segment est ouvert : faire tourner un
  // intervalle sur une intervention terminée réveillerait l'écran pour rien.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (openEntry === null) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [openEntry]);

  const openSeconds =
    openEntry !== null && openEntry.kind === 'work'
      ? Math.max(0, Math.floor((now - new Date(openEntry.started_at).getTime()) / 1000))
      : 0;

  const total = workedSeconds + openSeconds;

  const act = (to: 'work' | 'pause') => {
    setError(null);
    switchEntry.mutate(
      { organizationId, openEntryId: openEntry?.id ?? null, to },
      {
        onError: (mutationError) => {
          setError(mutationError);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <FormError error={error} />

      <div className="flex flex-wrap items-baseline gap-3">
        {/*
          Plus gros sur téléphone que sur écran de bureau : c'est là qu'on le
          lit à bout de bras, une main occupée par autre chose.
        */}
        <span className="text-foreground font-mono text-4xl tabular-nums sm:text-3xl">
          {formatDuration(total)}
        </span>
        {isWorking ? <Badge variant="success">En cours</Badge> : null}
        {isPaused ? <Badge variant="warning">En pause</Badge> : null}
        {isCompleted ? <Badge variant="neutral">Terminée</Badge> : null}
      </div>

      <p className="text-muted-foreground text-xs">
        Temps de travail net — les pauses ne sont pas comptées.
      </p>

      {canTrack && !isCompleted ? (
        <div className="space-y-4">
          {/*
            Pleine largeur sur téléphone : la commande que l'on actionne le plus
            souvent, avec des gants, mérite toute la largeur de l'écran.
          */}
          {isWorking ? (
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                act('pause');
              }}
              disabled={switchEntry.isPending}
            >
              <Pause className="size-4" />
              Mettre en pause
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                act('work');
              }}
              disabled={switchEntry.isPending}
            >
              <Play className="size-4" />
              {openEntry === null ? 'Démarrer' : 'Reprendre'}
            </Button>
          )}

          {/*
            Séparé du reste, et confirmé.

            Terminer pose `end_time` une fois pour toutes — le trigger
            `enforce_intervention_scope` ne la réécrit jamais. Un pouce qui
            glisse sur la commande d'à côté clôturerait une intervention en
            cours, sans retour possible. La barre et la question valent mieux
            que le support à appeler ensuite.
          */}
          <div className="border-border border-t pt-4">
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                setError(null);
                setConfirmingComplete(true);
              }}
              disabled={completeIntervention.isPending || entries.length === 0}
            >
              <CheckCircle2 className="size-4" />
              Terminer l’intervention
            </Button>
          </div>

          <Modal
            open={confirmingComplete}
            onOpenChange={setConfirmingComplete}
            title="Terminer l’intervention ?"
            description="L’heure de fin sera posée maintenant, et ne pourra plus être modifiée. Le relevé du temps sera clos."
            size="sm"
            footer={
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmingComplete(false);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  disabled={completeIntervention.isPending}
                  onClick={() => {
                    completeIntervention.mutate(
                      { openEntryId: openEntry?.id ?? null },
                      {
                        onSuccess: () => {
                          setConfirmingComplete(false);
                        },
                        onError: (mutationError) => {
                          setError(mutationError);
                          setConfirmingComplete(false);
                        },
                      },
                    );
                  }}
                >
                  {completeIntervention.isPending ? 'Clôture…' : 'Terminer'}
                </Button>
              </>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

/** `2 h 07 min 15 s` — lisible d'un coup d'œil sur un écran tenu à bout de bras. */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${String(hours)} h ${pad(minutes)} min ${pad(seconds)} s`
    : `${pad(minutes)} min ${pad(seconds)} s`;
}
