import { ArrowLeft, Building2, MapPin, Radar } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  ProspectContactsPanel,
  ProspectConversionActions,
  ProspectFollowupsPanel,
  ProspectMessageDraft,
  ProspectNotesPanel,
  ProspectScoreBadge,
  ProspectStatusActions,
  ProspectStatusBadge,
  useProspect,
} from '@/features/prospecting';
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { ProspectScoreReason } from '@/types/domain';

export default function ProspectDetailPage() {
  const { siren } = useParams<{ siren: string }>();
  const { data: prospect, isPending, error, refetch } = useProspect(siren);

  useDocumentTitle(prospect ? prospect.raison_sociale : 'Prospection');

  if (isPending) return <ListSkeleton rows={4} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!prospect) {
    return (
      <EmptyState
        icon={Radar}
        title="Prospect introuvable"
        description="Ce SIREN ne correspond à aucun prospect détecté."
      />
    );
  }

  const reasons = (prospect.score_reasons as unknown as ProspectScoreReason[] | null) ?? [];

  return (
    <div>
      <Link
        to={ROUTES.prospectingList}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-xs font-semibold"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Retour à la liste
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {prospect.nom_commercial ?? prospect.raison_sociale}
          </h1>
          {prospect.nom_commercial && (
            <p className="text-muted-foreground text-sm">{prospect.raison_sociale}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProspectScoreBadge score={prospect.opportunity_score} />
            <ProspectStatusBadge status={prospect.status} />
            <Badge variant="outline">Priorité {prospect.priority}</Badge>
          </div>
        </div>
      </div>

      {prospect.status === 'converti' ? (
        <div className="border-success-border bg-success-subtle text-success mb-5 rounded-xl border px-4 py-3 text-xs font-semibold">
          Converti en client REZO360 — historique, source et score initial conservés.
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <ProspectStatusActions siren={prospect.siren} status={prospect.status} />
        <ProspectConversionActions siren={prospect.siren} status={prospect.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">Pourquoi ce prospect est recommandé ?</CardTitle>
            </CardHeader>
            <CardContent className="mt-3 space-y-2 p-0">
              {reasons.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Aucun critère de score ne s’applique actuellement à ce prospect.
                </p>
              ) : (
                reasons.map((reason) => (
                  <div
                    key={reason.criterion}
                    className="border-border/70 bg-surface-sunken/40 flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                  >
                    <span className="text-foreground">{reason.label}</span>
                    <span className="text-primary font-mono font-bold">+{reason.points}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">Brouillon de message</CardTitle>
            </CardHeader>
            <CardContent className="mt-3 p-0">
              <ProspectMessageDraft
                sectorId={prospect.sector_id}
                createdOn={prospect.created_on}
                commune={prospect.commune}
              />
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">Entreprise</CardTitle>
            </CardHeader>
            <CardContent className="mt-3 grid grid-cols-1 gap-3 p-0 text-xs sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">SIREN</p>
                <p className="text-foreground font-mono font-semibold">{prospect.siren}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Forme juridique</p>
                <p className="text-foreground font-semibold">{prospect.forme_juridique ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Code APE / secteur</p>
                <p className="text-foreground font-semibold">
                  {prospect.ape_code} — {prospect.sector?.label ?? 'Non catégorisé'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Statut administratif</p>
                <p className="text-foreground font-semibold capitalize">
                  {prospect.statut_administratif === 'actif' ? 'Actif' : 'Cessé'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Date de création</p>
                <p className="text-foreground font-semibold">
                  {prospect.created_on
                    ? `${formatDate(prospect.created_on)} (${formatRelativeTime(prospect.created_on)})`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3" aria-hidden="true" /> Localisation
                </p>
                <p className="text-foreground font-semibold">
                  {[prospect.commune, prospect.departement].filter(Boolean).join(' · ') || '—'}
                  {prospect.zone ? ` (${prospect.zone.label})` : ''}
                </p>
              </div>
            </CardContent>
          </Card>

          {prospect.establishments.length > 0 && (
            <Card className="border-border/80 bg-surface p-5 shadow-xs">
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Building2 className="size-4" aria-hidden="true" /> Établissements
                </CardTitle>
              </CardHeader>
              <CardContent className="mt-3 space-y-2 p-0">
                {prospect.establishments.map((etab) => (
                  <div key={etab.siret} className="border-border/70 rounded-lg border px-3 py-2 text-xs">
                    <p className="text-foreground font-mono font-semibold">
                      {etab.siret} {etab.is_headquarters ? '· Siège' : ''}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {etab.adresse_line ?? [etab.code_postal, etab.commune].filter(Boolean).join(' ')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">Historique</CardTitle>
            </CardHeader>
            <CardContent className="mt-3 space-y-3 p-0">
              {prospect.activities.length === 0 ? (
                <p className="text-muted-foreground text-xs">Aucun événement pour l’instant.</p>
              ) : (
                prospect.activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 text-xs">
                    <div className="bg-primary/70 mt-1 size-1.5 shrink-0 rounded-full" />
                    <div>
                      <p className="text-foreground font-semibold capitalize">
                        {activity.event.replaceAll('_', ' ')}
                      </p>
                      <p className="text-muted-foreground text-3xs">
                        {formatDateTime(activity.created_at)}
                        {activity.score_snapshot !== null
                          ? ` · score à cet instant : ${activity.score_snapshot}/100`
                          : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="mt-3 p-0">
              <ProspectContactsPanel siren={prospect.siren} contacts={prospect.contacts} />
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent className="mt-3 p-0">
              <ProspectNotesPanel siren={prospect.siren} notes={prospect.notes} />
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">Relances</CardTitle>
            </CardHeader>
            <CardContent className="mt-3 p-0">
              <ProspectFollowupsPanel siren={prospect.siren} followups={prospect.followups} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
