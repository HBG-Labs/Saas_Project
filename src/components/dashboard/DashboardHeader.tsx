import { Briefcase, Calendar, Plus, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { formatNewNoun, useCurrentIndustry, useLabel } from '@/features/industries';
import { useCurrentOrganization, usePermission } from '@/features/organizations';

import { displayNameOf } from '@/components/layout/user-display';

export function DashboardHeader() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { label: industryLabel, isResolved } = useCurrentIndustry();
  const { can } = usePermission();
  const jobSingular = useLabel('job');

  const displayName = useMemo(() => {
    return displayNameOf(user);
  }, [user]);

  const formattedDate = useMemo(() => {
    const today = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    return today.charAt(0).toUpperCase() + today.slice(1);
  }, []);

  return (
    <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Bonjour, {displayName}
          </h1>
          {isResolved && industryLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-2xs font-semibold text-primary">
              <Briefcase className="size-3" />
              {industryLabel}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Cockpit Opérationnel
          </span>
        </div>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <Calendar className="size-4 text-subtle-foreground shrink-0" />
          <span>{formattedDate}</span>
          <span className="text-border-strong">•</span>
          <span>{organization?.name ?? 'REZO360'}</span>
        </p>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <Button asChild variant="outline" size="sm" className="rounded-xl font-medium">
          <Link to={ROUTES.tools}>
            <Wrench className="mr-1.5 size-3.5" />
            <span>Outils métier</span>
          </Link>
        </Button>
        <Button asChild size="sm" className="rounded-xl font-bold shadow-xs">
          <Link to={can('mission.create') ? ROUTES.missionNew : ROUTES.missions}>
            <Plus className="mr-1.5 size-4" />
            <span>{formatNewNoun(jobSingular)}</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
