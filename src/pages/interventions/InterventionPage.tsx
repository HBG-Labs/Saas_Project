import { ArrowLeft, FileText, KeyRound, MapPin, Wrench } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  InterventionTimer,
  useIntervention,
  useTimeEntries,
  useWorkedSeconds,
} from '@/features/interventions';
import { useMission } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Vue terrain d'une intervention.
 *
 * Conçue pour être tenue à une main, sous la pluie, avec des gants : le
 * chronomètre et ses commandes occupent le haut de l'écran, les informations
 * consultables viennent après. C'est l'inverse d'une fiche de bureau, où le
 * contexte précède l'action.
 */
export default function InterventionPage() {
  const { interventionId } = useParams<{ interventionId: string }>();
  const { organization, membership } = useCurrentOrganization();

  const intervention = useIntervention(interventionId);
  const timeEntries = useTimeEntries(interventionId);
  const workedSeconds = useWorkedSeconds(interventionId);
  const mission = useMission(intervention.data?.mission_id);

  useDocumentTitle(mission.data?.reference ?? 'Intervention');

  if (intervention.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (intervention.isError) {
    return (
      <ErrorState
        error={intervention.error}
        onRetry={() => {
          void intervention.refetch();
        }}
      />
    );
  }

  if (intervention.data === null || interventionId === undefined) {
    return (
      <EmptyState
        icon={Wrench}
        title="Intervention introuvable"
        description="Cette intervention n’existe pas, ou ne vous est pas accessible."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.missions}>Retour aux missions</Link>
          </Button>
        }
      />
    );
  }

  const data = intervention.data;

  /**
   * Seul l'intervenant pointe ses heures.
   *
   * La policy `intervention_time_entries_insert` le vérifie côté serveur : un
   * responsable qui pointerait à la place de quelqu'un d'autre viderait le
   * relevé de son sens. Il consulte, il ne pointe pas.
   */
  const canTrack = membership !== null && data.technician_id === membership.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={data.mission_id !== null ? ROUTES.mission(data.mission_id) : ROUTES.missions}>
          <ArrowLeft className="size-4" />
          Mission
        </Link>
      </Button>

      {/* Le chronomètre EN PREMIER : c'est la raison d'ouvrir cet écran. */}
      <Card>
        <CardContent className="pt-6">
          <InterventionTimer
            interventionId={interventionId}
            organizationId={organization?.id ?? ''}
            entries={timeEntries.data ?? []}
            workedSeconds={workedSeconds.data ?? 0}
            canTrack={canTrack}
            isCompleted={data.status === 'completed'}
          />
        </CardContent>
      </Card>

      {/*
        Le compte rendu est la suite naturelle du chronomètre : on le rédige en
        partant, souvent depuis le véhicule. Le laisser accessible seulement par
        l'URL le rendrait introuvable.
      */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-foreground text-sm font-medium">Compte rendu</p>
            <p className="text-muted-foreground text-xs">
              {data.report === null
                ? 'Aucun compte rendu ouvert pour cette intervention.'
                : data.report.status === 'draft'
                  ? 'Brouillon en cours de rédaction.'
                  : data.report.status === 'submitted'
                    ? 'Soumis au contrôle.'
                    : data.report.status === 'approved'
                      ? 'Validé — définitif.'
                      : 'Refusé — à corriger et resoumettre.'}
            </p>
          </div>

          <Button asChild variant={data.report === null ? 'primary' : 'outline'} size="sm">
            <Link to={ROUTES.interventionReport(interventionId)}>
              <FileText className="size-4" />
              {data.report === null ? 'Rédiger' : 'Ouvrir'}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {mission.data !== null && mission.data !== undefined ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">{mission.data.reference}</Badge>
              {mission.data.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {[
                  mission.data.location_label,
                  mission.data.address_line1,
                  mission.data.postal_code,
                  mission.data.city,
                ]
                  .filter((part) => part !== null && part !== '')
                  .join(', ') || 'Adresse non renseignée'}
              </span>
            </p>

            {/*
              Les consignes d'accès sont mises en évidence : c'est ce que le
              technicien cherche en arrivant devant une grille fermée.
            */}
            {mission.data.site?.access_notes !== null &&
            mission.data.site?.access_notes !== undefined ? (
              <div className="bg-surface-sunken flex gap-2 rounded-md p-2">
                <KeyRound
                  className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-muted-foreground text-xs whitespace-pre-line">
                  {mission.data.site.access_notes}
                </p>
              </div>
            ) : null}

            {mission.data.description !== null && mission.data.description !== '' ? (
              <p className="text-foreground text-sm whitespace-pre-line">
                {mission.data.description}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Relevé du temps</CardTitle>
        </CardHeader>
        <CardContent>
          {(timeEntries.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Aucun segment enregistré. Démarrez l’intervention pour ouvrir le relevé.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {(timeEntries.data ?? []).map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2 text-xs">
                  <Badge variant={entry.kind === 'work' ? 'primary' : 'warning'}>
                    {entry.kind === 'work' ? 'Travail' : 'Pause'}
                  </Badge>
                  <span className="text-foreground font-mono tabular-nums">
                    {new Date(entry.started_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' → '}
                    {entry.ended_at !== null
                      ? new Date(entry.ended_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '…'}
                  </span>
                  {entry.reason !== null ? (
                    <span className="text-muted-foreground">{entry.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
