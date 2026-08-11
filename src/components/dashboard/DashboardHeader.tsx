import { Calendar, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { useCurrentOrganization } from '@/features/organizations';

export function DashboardHeader() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();

  const displayName = useMemo(() => {
    const raw =
      (user?.user_metadata?.['display_name'] as string | undefined) ??
      user?.email?.split('@')[0] ??
      'Alexandre';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
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
    <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center dark:border-slate-800/80">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Bonjour, {displayName}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Session Sécurisée
          </span>
        </div>
        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
          <Calendar className="size-4 text-slate-400" />
          <span>{formattedDate}</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>Aperçu de votre activité aujourd&apos;hui — {organization?.name ?? 'NexoraTech'}</span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button asChild size="md" className="rounded-xl font-bold shadow-md">
          <Link to={ROUTES.missions}>
            <Plus className="mr-1.5 size-4" />
            <span>Nouvelle Intervention</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
