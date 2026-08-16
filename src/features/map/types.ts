import type { IndustryCode } from '@/config/industries';

export type TechnicianStatus = 'on_road' | 'on_site' | 'available' | 'offline';

export interface GPSBreadcrumb {
  lat: number;
  lng: number;
  time: string;
  speedKmH: number;
  heading: number; // degrees 0-360
  batteryPct: number;
  status: TechnicianStatus;
  note?: string;
}

export interface TechnicianLocation {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  initials: string;
  phone: string;
  trade: IndustryCode;
  tradeLabel: string;
  status: TechnicianStatus;
  currentLat: number;
  currentLng: number;
  heading: number;
  speedKmH: number;
  batteryPct: number;
  lastPing: string;
  vehiclePlate: string;
  currentMission?: {
    id: string;
    title: string;
    reference: string;
    clientName: string;
    clientAddress: string;
    clientPhone: string;
    destinationLat: number;
    destinationLng: number;
    etaMinutes: number;
    estimatedArrival: string;
    progressPct: number;
  };
  historyTrail: GPSBreadcrumb[];
}

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
  assignedTechnicianName?: string;
  status: 'planned' | 'in_progress' | 'completed';
}

export type MapLayerMode = 'roadmap' | 'satellite' | 'dark_cockpit' | 'terrain';
