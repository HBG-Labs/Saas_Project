import { ArrowRight, ClipboardCheck, ClipboardList, Users } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { FEATURES, useOrganizationEntitlements } from '@/features/billing';
import { useReportsPendingReview } from '@/features/interventions';
import { MissionStatusBadge, useMissions } from '@/features/missions';
import { PERMISSIONS, useCurrentOrganization, useMembers, usePermission } from '@/features/organizations';

/**
 * Résumé du module professionnel sur le tableau de bord.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'IL MONTRE DÉPEND DU RÔLE, ET C'EST TOUT L'INTÉRÊT
 *
 * Un technicien ouvre l'application pour savoir ce qu'il a à faire aujourd'hui.
 * Un responsable, pour savoir ce qui l'attend — comptes rendus à contrôler,
 * missions qui traînent. Leur montrer le même écran obligerait chacun à
 * chercher sa moitié dans celle de l'autre.
 *
 * Le bloc entier disparaît hors organisation : un utilisateur du seul catalogue
 * d'outils n'a rien à faire d'une section vide intitulée « Missions ».
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ProfessionalSummary() {
  const { organization, status } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const { has, limit } = useOrganizationEntitlements(organizationId);
  const canReview = can(PERMISSIONS.interventionReview);
  const canViewMembers = can(PERMISSIONS.memberView);

  const missions = useMissions(organizationId, {
    status: ['assigned', 'accepted', 'in_progress', 'rejected'],
    limit: 5,
  });
  const pending = useReportsPendingReview(canReview ? organizationId : null);
  const members = useMembers(canViewMembers ? organizationId : null);

  // Hors organisation, ou sans le module : rien à afficher.
  if (status !== 'ready' || !has(FEATURES.missions)) return null;

  const missionList = missions.data ?? [];
  const pendingCount = (pending.data ?? []).length;
  const activeMembers = (members.data ?? []).filter((member) => member.status === 'active').length;
  const memberLimit = limit(FEATURES.members);

  return (
    <section className="mb-8 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-foreground text-lg font-semibold">{organization?.name}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to={ROUTES.missions}>
            Toutes les missions
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
          label="Missions en cours"
          value={missions.isPending ? null : missionList.length}
          to={ROUTES.missions}
        />

        {/*
          La file de contrôle n'apparaît qu'à qui contrôle. Pour les autres, ce
          serait un chiffre sur lequel ils ne peuvent pas agir.
        */}
        {canReview ? (
          <SummaryTile
            icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
            label="À contrôler"
            value={pending.isPending ? null : pendingCount}
            to={ROUTES.review}
            highlight={pendingCount > 0}
          />
        ) : null}

        {canViewMembers && memberLimit !== null ? (
          <SummaryTile
            icon={<Users className="size-4" aria-hidden="true" />}
            label="Membres"
            value={members.isPending ? null : activeMembers}
            suffix={` / ${String(memberLimit)}`}
            to={ROUTES.organizationMembers}
          />
        ) : null}
      </div>

      {missions.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : missionList.length > 0 ? (
        <Card>
          <CardContent className="pt-5">
            <ul className="divide-border divide-y">
              {missionList.map((mission) => (
                <li key={mission.id}>
                  <Link
                    to={ROUTES.mission(mission.id)}
                    className="hover:bg-surface-hover -mx-2 flex flex-wrap items-center gap-3 rounded-md px-2 py-2 transition-colors"
                  >
                    <Badge variant="outline">{mission.reference}</Badge>
                    <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                      {mission.title}
                    </span>
                    <span className="text-subtle-foreground font-mono text-xs tabular-nums">
                      {mission.scheduled_start !== null
                        ? new Date(mission.scheduled_start).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                          })
                        : '—'}
                    </span>
                    <MissionStatusBadge status={mission.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  suffix,
  to,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  /** `null` pendant le chargement — un zéro affiché puis corrigé est un mensonge bref. */
  value: number | null;
  suffix?: string;
  to: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-warning/50' : undefined}>
      <CardContent className="pt-5">
        <Link to={to} className="block">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {icon}
            {label}
          </span>
          <span className="text-foreground mt-1 block font-mono text-2xl tabular-nums">
            {value === null ? '—' : value}
            {suffix !== undefined && value !== null ? (
              <span className="text-subtle-foreground text-sm">{suffix}</span>
            ) : null}
          </span>
        </Link>
      </CardContent>
    </Card>
  );
}
