import { Calendar, ChevronRight, Clock, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useLabel } from '@/features/industries';
import { MissionStatusBadge } from '@/features/missions';
import type { MissionWithRelations } from '@/types/domain';

export function DailyPlanningSection({
  missions = [],
}: {
  missions?: MissionWithRelations[];
}) {
  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-3.5">
        <div>
          <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Calendar className="size-4.5 text-primary" />
            Planning & {jobPlural} récentes
          </CardTitle>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Suivi des statuts et avancement en temps réel
          </p>
        </div>

        <Link
          to={ROUTES.missions}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          Voir tout
          <ChevronRight className="size-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="pt-4">
        {missions.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Calendar className="size-8 text-subtle-foreground/60 mx-auto" />
            <p className="text-xs font-medium text-muted-foreground">Aucun {jobSingular.toLowerCase()} planifié</p>
            <p className="text-2xs text-subtle-foreground">
              Créez une intervention pour l'assigner à une équipe.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to={ROUTES.missionNew}>
                <Plus className="size-3.5 mr-1" /> Créer un {jobSingular.toLowerCase()}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border space-y-2">
            {missions.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="group flex flex-col justify-between gap-2.5 pt-2.5 first:pt-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-2xs shrink-0">
                      {m.reference}
                    </Badge>
                    <Link
                      to={ROUTES.mission(m.id)}
                      className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors"
                    >
                      {m.title}
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
                    {m.customer ? (
                      <span className="font-medium text-foreground/80">{m.customer.name}</span>
                    ) : null}
                    {m.site ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3 shrink-0" />
                        {m.site.name} {m.site.city ? `(${m.site.city})` : ''}
                      </span>
                    ) : null}
                    {m.scheduled_start ? (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 shrink-0" />
                        {new Date(m.scheduled_start).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0">
                  <MissionStatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
