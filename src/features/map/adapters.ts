import type { IndustryCode } from '@/config/industries';
import { memberDisplayName, ROLE_LABELS } from '@/features/organizations';
import type {
  MissionWithRelations,
  TechnicianLocationPing,
  TechnicianLocationWithMember,
} from '@/types/domain';

import type { GPSBreadcrumb, InterventionSite, TechnicianLocation } from './types';

/**
 * Passage des lignes de la base aux formes attendues par la carte.
 *
 * Même rôle que `features/planning/adapters.ts`, et pour la même raison : les
 * composants de carte manipulent un modèle de vue plat, écrit avant que les
 * tables n'existent. Le traduire ici évite d'apprendre à un canevas SVG ce
 * qu'est une jointure sur `profiles`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE LA VUE N'AURA PAS, ET POURQUOI
 *
 * Le TÉLÉPHONE de l'intervenant n'est pas affiché. Il vit dans
 * `profile_details`, que seul son titulaire peut lire — c'est une décision de
 * confidentialité prise ailleurs dans ce projet, et la carte n'est pas un motif
 * suffisant pour la défaire. Un tiret plutôt qu'un numéro inventé.
 *
 * Le MÉTIER vient de l'organisation, pas de la personne : une entreprise exerce
 * un seul métier, et tous ses intervenants le partagent.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function toGPSBreadcrumb(ping: TechnicianLocationPing): GPSBreadcrumb {
  return {
    lat: ping.latitude,
    lng: ping.longitude,
    time: hhmm(ping.recorded_at),
    speedKmH: Number(ping.speed_kmh ?? 0),
    heading: Number(ping.heading ?? 0),
    batteryPct: ping.battery_pct ?? 0,
    status: ping.presence,
    ...(ping.note !== null ? { note: ping.note } : {}),
  };
}

/**
 * Position courante d'un intervenant, enrichie de sa mission en cours.
 *
 * `missions` sert à retrouver ce sur quoi il travaille. L'ETA et le pourcentage
 * d'avancement de l'ancienne maquette ne sont PAS reconstitués : les calculer
 * demanderait un service d'itinéraire, et les inventer redonnerait à l'écran
 * l'assurance trompeuse qu'on vient de lui retirer.
 */
export function toTechnicianLocation(
  row: TechnicianLocationWithMember,
  context: {
    industry: IndustryCode;
    industryLabel: string;
    missions: readonly MissionWithRelations[];
    trail?: readonly TechnicianLocationPing[];
  },
): TechnicianLocation {
  const member = row.member;
  const name = member === null ? 'Intervenant' : memberDisplayName(member);

  const active = context.missions.find(
    (mission) => mission.assigned_user_id === row.member_id && mission.status === 'in_progress',
  );

  const destination =
    active?.latitude != null && active.longitude != null
      ? { destinationLat: active.latitude, destinationLng: active.longitude }
      : { destinationLat: row.latitude, destinationLng: row.longitude };

  return {
    id: row.member_id,
    name,
    role: member === null ? '—' : ROLE_LABELS[member.role],
    initials: initialsOf(name),
    // Le numéro personnel n'est pas lisible par l'organisation : voir l'en-tête.
    phone: '—',
    trade: context.industry,
    tradeLabel: context.industryLabel,
    status: row.presence,
    currentLat: row.latitude,
    currentLng: row.longitude,
    heading: Number(row.heading ?? 0),
    speedKmH: Number(row.speed_kmh ?? 0),
    batteryPct: row.battery_pct ?? 0,
    lastPing: hhmm(row.recorded_at),
    vehiclePlate: row.vehicle_plate ?? '—',
    ...(member?.profile?.avatar_url != null ? { avatarUrl: member.profile.avatar_url } : {}),
    ...(active !== undefined
      ? {
          currentMission: {
            id: active.id,
            title: active.title,
            reference: active.reference,
            clientName: active.customer?.name ?? active.customer_name ?? 'Client non renseigné',
            clientAddress:
              [active.address_line1, active.city].filter((part) => part != null).join(', ') ||
              (active.location_label ?? '—'),
            clientPhone: active.customer_phone ?? '—',
            ...destination,
            // Sans service d'itinéraire, ces deux valeurs seraient des
            // suppositions présentées comme des faits. Zéro les rend visibles
            // pour ce qu'elles sont : non calculées.
            etaMinutes: 0,
            estimatedArrival: '—',
            progressPct: 0,
          },
        }
      : {}),
    historyTrail: (context.trail ?? []).map(toGPSBreadcrumb),
  };
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
): InterventionSite | null {
  // Une mission sans coordonnées n'a pas de place sur une carte. L'écarter est
  // plus honnête que de la poser au centre de la vue.
  if (mission.latitude === null || mission.longitude === null) return null;

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
    lat: mission.latitude,
    lng: mission.longitude,
    priority: mission.priority,
    scheduledTime: mission.scheduled_start === null ? '—' : hhmm(mission.scheduled_start),
    status: SITE_STATUS[mission.status] ?? 'planned',
    ...(mission.assigned_member !== null
      ? { assignedTechnicianName: memberDisplayName(mission.assigned_member) }
      : {}),
  };
}
