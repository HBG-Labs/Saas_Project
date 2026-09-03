import { useQuery } from '@tanstack/react-query';

import { mapPostgrestError } from '@/lib/errors';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/services/supabase';

/**
 * Statistiques d'activité de l'organisation.
 *
 * Les agrégats sont calculés par PostgreSQL, dans
 * `public.organization_activity_stats`. Rapatrier les missions pour les compter
 * dans le navigateur ferait transiter tout le plan de charge afin d'afficher
 * quelques nombres — et donnerait un résultat différent du serveur dès qu'un
 * filtre RLS entrerait en jeu.
 *
 * La fonction vérifie elle-même `statistics.view` et l'entitlement du plan :
 * un refus remonte en erreur explicite, pas en zéros silencieux.
 */
export interface ActivityStats {
  from: string;
  to: string;
  missions_total: number;
  missions_by_status: Record<string, number>;
  missions_by_priority: Record<string, number>;
  customers: { name: string; missions: number }[];
  worked_seconds: number;
  interventions_total: number;
  reports_approved: number;
  reports_rejected: number;
  reports_pending: number;
  active_members: number;
  active_teams: number;
}

export async function getActivityStats(
  organizationId: string,
  range: { from?: string; to?: string } = {},
): Promise<ActivityStats> {
  const { data, error } = await supabase.rpc('organization_activity_stats', {
    p_organization_id: organizationId,
    p_from: range.from ?? null,
    p_to: range.to ?? null,
  });

  if (error) throw mapPostgrestError(error);

  return data as unknown as ActivityStats;
}

export function useActivityStats(
  organizationId: string | null,
  range: { from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: qk.analytics.activity(organizationId ?? 'none', range.from ?? null, range.to ?? null),
    queryFn: () =>
      organizationId === null
        ? Promise.resolve(null)
        : getActivityStats(organizationId, range),
    enabled: organizationId !== null,
    // Un tableau de bord n'a pas à être temps réel : cinq minutes évitent de
    // relancer l'agrégat à chaque retour sur l'onglet.
    staleTime: 5 * 60_000,
  });
}

/** Secondes → « 12 h 30 ». Le format lu sur une feuille d'heures. */
export function formatWorkedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`;
}
