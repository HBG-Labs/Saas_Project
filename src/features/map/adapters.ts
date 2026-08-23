import type { IndustryCode } from '@/config/industries';
import { memberDisplayName } from '@/features/organizations';
import type { Customer, MissionWithRelations, Site } from '@/types/domain';

import type { InterventionSite } from './types';

/**
 * Passage des lignes de la base aux points de la carte.
 *
 * Même rôle que `features/planning/adapters.ts`, et pour la même raison : les
 * composants de carte manipulent un modèle de vue plat. Le traduire ici évite
 * d'apprendre à un canevas SVG ce qu'est une jointure sur `profiles`.
 *
 * Trois sources convergent vers la même forme — une mission géolocalisée, un
 * site client, une fiche client géocodée — parce que la carte ne fait aucune
 * différence entre elles : ce sont des lieux où il y a du travail.
 */

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Les missions géolocalisées deviennent les points de la carte.
 *
 * Aucune table n'a été créée pour cela : une mission porte déjà sa latitude, sa
 * longitude, sa référence, sa priorité et son client. Une table `map_sites`
 * aurait été une copie, et la copie diverge.
 */
const SITE_STATUS: Record<string, InterventionSite['status']> = {
  draft: 'planned',
  assigned: 'planned',
  accepted: 'planned',
  in_progress: 'in_progress',
  completed: 'completed',
  submitted: 'completed',
  approved: 'completed',
  closed: 'completed',
  cancelled: 'completed',
};

export function toInterventionSite(
  mission: MissionWithRelations,
  context: { industry: IndustryCode; industryLabel: string },
  fallbackCoords?: { latitude: number; longitude: number } | null,
): InterventionSite | null {
  const lat = mission.latitude ?? fallbackCoords?.latitude ?? null;
  const lng = mission.longitude ?? fallbackCoords?.longitude ?? null;

  if (lat === null || lng === null) return null;

  return {
    id: mission.id,
    reference: mission.reference,
    title: mission.title,
    trade: context.industry,
    tradeLabel: context.industryLabel,
    clientName: mission.customer?.name ?? mission.customer_name ?? 'Client non renseigné',
    address:
      [mission.address_line1, mission.postal_code, mission.city]
        .filter((part) => part != null && part !== '')
        .join(' ') ||
      (mission.location_label ?? '—'),
    lat,
    lng,
    priority: mission.priority,
    scheduledTime: mission.scheduled_start === null ? '—' : hhmm(mission.scheduled_start),
    status: SITE_STATUS[mission.status] ?? 'planned',
    kind: 'mission',
    customerId: mission.customer_id ?? undefined,
    assignedMemberId: mission.assigned_member?.id ?? undefined,
    ...(mission.assigned_member !== null
      ? { assignedTechnicianName: memberDisplayName(mission.assigned_member) }
      : {}),
  };
}

export function siteToMapItem(
  site: Site,
  customer?: Customer | null,
  context?: { industry: IndustryCode; industryLabel: string },
): InterventionSite | null {
  if (site.latitude === null || site.longitude === null) return null;

  return {
    id: site.id,
    reference: site.code || customer?.reference || 'SITE',
    title: site.name,
    trade: context?.industry ?? 'fiber_telecom',
    tradeLabel: context?.industryLabel ?? 'Client / Site',
    clientName: customer?.name ?? site.name,
    address:
      [site.address_line1, site.postal_code, site.city]
        .filter((part) => part != null && part !== '')
        .join(' ') || 'Adresse non renseignée',
    lat: site.latitude,
    lng: site.longitude,
    priority: 'normal',
    scheduledTime: '—',
    status: 'planned',
    kind: 'client',
    customerId: site.customer_id,
    phone: customer?.phone ?? undefined,
  };
}

export function customerToMapItem(
  customer: Customer,
  coordinates: { latitude: number; longitude: number },
  context?: { industry: IndustryCode; industryLabel: string },
): InterventionSite {
  return {
    id: customer.id,
    reference: customer.reference,
    title: customer.name,
    trade: context?.industry ?? 'fiber_telecom',
    tradeLabel: context?.industryLabel ?? 'Client',
    clientName: customer.name,
    address:
      [customer.address_line1, customer.postal_code, customer.city]
        .filter((part) => part != null && part !== '')
        .join(' ') || 'Adresse non renseignée',
    lat: coordinates.latitude,
    lng: coordinates.longitude,
    priority: 'normal',
    scheduledTime: '—',
    status: 'planned',
    kind: 'client',
    customerId: customer.id,
    phone: customer.phone ?? undefined,
  };
}
