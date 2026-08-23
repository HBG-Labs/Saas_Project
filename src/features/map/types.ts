import type { IndustryCode } from '@/config/industries';

/**
 * Ce que la carte affiche.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IL N'Y A PLUS DE POSITION D'INTERVENANT ICI
 *
 * `TechnicianLocation`, `GPSBreadcrumb` et `TechnicianStatus` décrivaient le
 * suivi continu, abandonné. Les conserver « au cas où » aurait laissé un modèle
 * complet et crédible pour une fonctionnalité qui n'existe plus — l'invitation
 * la plus sûre à la reconstruire par inadvertance.
 *
 * La carte ne montre donc que des LIEUX : missions géolocalisées, sites et
 * clients. Le GPS ne sert qu'à des relevés ponctuels, dans `features/geo`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface InterventionSite {
  id: string;
  reference: string;
  title: string;
  trade: IndustryCode;
  tradeLabel: string;
  clientName: string;
  address: string;
  lat: number;
  lng: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledTime: string;
  assignedTechnicianName?: string | undefined;
  assignedMemberId?: string | undefined;
  status: 'planned' | 'in_progress' | 'completed';
  kind?: 'mission' | 'client' | undefined;
  customerId?: string | undefined;
  phone?: string | undefined;
}

export type MapLayerMode = 'roadmap' | 'satellite' | 'dark_cockpit' | 'terrain';
