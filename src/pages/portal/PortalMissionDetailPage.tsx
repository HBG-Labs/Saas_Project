import { ArrowLeft, CalendarDays, Camera, ClipboardCheck, MapPin, Wrench } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  FileOpenButton,
  formatDateFr,
  PortalPageHeader,
  StatusBadge,
  usePortalMission,
} from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Détail d'une intervention vue par le client.
 *
 * Ce qui s'affiche ici est exactement ce que `portal_mission_detail` renvoie :
 * un rapport seulement s'il est approuvé (sans les observations internes), des
 * photos seulement si elles ont été partagées. Le frontend n'a rien à cacher —
 * il n'a jamais reçu le reste.
 */
export default function PortalMissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const mission = usePortalMission(missionId);
  useDocumentTitle(mission.data?.title ?? 'Intervention');

  if (mission.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (mission.isError) {
    return (
      <ErrorState
        error={mission.error}
        onRetry={() => {
          void mission.refetch();
        }}
      />
    );
  }
  if (mission.data === null) {
    return (
      <EmptyState
        icon={Wrench}
        title="Intervention introuvable"
        description="Cette intervention n’existe pas ou n’est pas visible dans votre espace."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.portalMissions}>Retour aux interventions</Link>
          </Button>
        }
      />
    );
  }

  const m = mission.data;
  const adresse = [
    m.address_line1,
    m.address_line2,
    [m.postal_code, m.city].filter(Boolean).join(' '),
  ]
    .filter((p) => p && p !== '')
    .join(', ');

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={ROUTES.portalMissions}>
          <ArrowLeft className="size-4" />
          Interventions
        </Link>
      </Button>

      <PortalPageHeader
        title={m.title}
        description={m.reference}
        icon={Wrench}
        summary={<StatusBadge status={m.status} kind="mission" />}
      />

      <Card className="overflow-hidden rounded-2xl">
        <CardHeader className="border-border bg-surface-sunken/40 border-b">
          <CardTitle className="text-sm">Détails du rendez-vous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 text-sm sm:pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <span className="bg-primary-subtle text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-muted-foreground text-3xs font-semibold tracking-wide uppercase">
                  Date prévue
                </p>
                <p className="text-foreground mt-0.5 text-sm font-semibold">
                  {formatDateFr(m.scheduled_start, true)}
                </p>
              </div>
            </div>
            {adresse || m.site_name ? (
              <div className="flex items-start gap-3">
                <span className="bg-info-subtle text-info flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <MapPin className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-3xs font-semibold tracking-wide uppercase">
                    Lieu d’intervention
                  </p>
                  <p className="text-foreground mt-0.5 text-sm font-semibold">
                    {m.site_name ?? 'Adresse du site'}
                  </p>
                  {adresse ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">{adresse}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          {m.description ? (
            <div className="border-border border-t pt-4">
              <p className="text-muted-foreground text-3xs font-semibold tracking-wide uppercase">
                Objet de l’intervention
              </p>
              <p className="text-foreground mt-1 whitespace-pre-wrap">{m.description}</p>
            </div>
          ) : null}
          {m.interventions.length > 0 ? (
            <div className="border-border border-t pt-4">
              <p className="text-muted-foreground text-3xs font-semibold tracking-wide uppercase">
                Passages enregistrés
              </p>
              <ul className="text-muted-foreground mt-2 space-y-1.5 text-xs">
                {m.interventions.map((i) => (
                  <li key={i.id} className="flex items-start gap-2">
                    <span
                      className="bg-success mt-1.5 size-1.5 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
                    <span>
                      {formatDateFr(i.start_time, true)}
                      {i.end_time ? ` → ${formatDateFr(i.end_time, true)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {m.report !== null ? (
        <Card className="border-success-border overflow-hidden rounded-2xl">
          <CardHeader className="bg-success-subtle/50 border-success-border border-b">
            <CardTitle className="text-success flex items-center gap-2 text-sm">
              <span className="bg-success text-success-foreground flex size-8 items-center justify-center rounded-lg">
                <ClipboardCheck className="size-4" aria-hidden="true" />
              </span>
              Compte rendu validé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {m.report.work_description ? (
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  Travaux réalisés
                </p>
                <p className="text-foreground whitespace-pre-wrap">{m.report.work_description}</p>
              </div>
            ) : null}
            {m.report.materials_used ? (
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  Matériel utilisé
                </p>
                <p className="text-foreground whitespace-pre-wrap">{m.report.materials_used}</p>
              </div>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {m.report.customer_signature_name
                ? `Signé par ${m.report.customer_signature_name} · `
                : ''}
              {formatDateFr(m.report.submitted_at, true)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Camera className="text-primary size-4" aria-hidden="true" />
            Photos et documents
            <Badge variant="neutral">{m.attachments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {m.attachments.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Aucune photo partagée pour cette intervention.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {m.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm">{a.caption ?? a.file_name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateFr(a.created_at, true)}
                    </p>
                  </div>
                  <FileOpenButton
                    bucket="intervention-attachments"
                    path={a.storage_path}
                    label="Ouvrir"
                    className="w-full sm:w-auto"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
