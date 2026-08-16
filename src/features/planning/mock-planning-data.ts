import type {
  LeaveRequest,
  StaffLeaveBalance,
  PlanningCalendarEvent,
  RecurringTask,
  PublicHoliday,
  HolidayTerritory,
} from './types';

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'leave-1',
    technicianId: 'tech-1',
    technicianName: 'Aurélie B.',
    technicianRole: 'Frigoriste & Climatisation',
    technicianInitials: 'AB',
    type: 'paid_leave',
    startDate: '2026-08-17',
    endDate: '2026-08-21',
    daysCount: 5,
    reason: 'Congés d’été annuels',
    status: 'approved',
    requestedAt: '2026-07-15',
    approvedBy: 'Gérant (Vous)',
    approvedAt: '2026-07-16',
  },
  {
    id: 'leave-2',
    technicianId: 'tech-2',
    technicianName: 'Thomas R.',
    technicianRole: 'Technicien Fibre & Réseaux',
    technicianInitials: 'TR',
    type: 'rtt',
    startDate: '2026-08-28',
    endDate: '2026-08-28',
    daysCount: 1,
    reason: 'Récupération vendredi RTT',
    status: 'pending',
    requestedAt: '2026-08-10',
  },
  {
    id: 'leave-3',
    technicianId: 'tech-3',
    technicianName: 'Karim M.',
    technicianRole: 'Électricien Tertiaire',
    technicianInitials: 'KM',
    type: 'family',
    startDate: '2026-08-24',
    endDate: '2026-08-25',
    daysCount: 2,
    reason: 'Événement familial (Déménagement)',
    status: 'pending',
    requestedAt: '2026-08-12',
  },
  {
    id: 'leave-4',
    technicianId: 'tech-4',
    technicianName: 'Sophie L.',
    technicianRole: 'Plombière Chauffagiste',
    technicianInitials: 'SL',
    type: 'paid_leave',
    startDate: '2026-08-03',
    endDate: '2026-08-07',
    daysCount: 5,
    reason: 'Semaine de repos',
    status: 'approved',
    requestedAt: '2026-06-20',
    approvedBy: 'Gérant (Vous)',
    approvedAt: '2026-06-21',
  },
  {
    id: 'leave-5',
    technicianId: 'tech-1',
    technicianName: 'Aurélie B.',
    technicianRole: 'Frigoriste & Climatisation',
    technicianInitials: 'AB',
    type: 'recovery',
    startDate: '2026-09-04',
    endDate: '2026-09-04',
    daysCount: 1,
    reason: 'Récupération astreinte weekend',
    status: 'approved',
    requestedAt: '2026-08-01',
    approvedBy: 'Gérant (Vous)',
    approvedAt: '2026-08-02',
  },
];

export const INITIAL_LEAVE_BALANCES: StaffLeaveBalance[] = [
  {
    technicianId: 'tech-1',
    technicianName: 'Aurélie B.',
    technicianRole: 'Frigoriste & Climatisation',
    technicianInitials: 'AB',
    paidLeaveRemaining: 16.5,
    paidLeaveAcquired: 25,
    rttRemaining: 4,
    recoveryHours: 14,
  },
  {
    technicianId: 'tech-2',
    technicianName: 'Thomas R.',
    technicianRole: 'Technicien Fibre & Réseaux',
    technicianInitials: 'TR',
    paidLeaveRemaining: 21.0,
    paidLeaveAcquired: 25,
    rttRemaining: 7,
    recoveryHours: 8,
  },
  {
    technicianId: 'tech-3',
    technicianName: 'Karim M.',
    technicianRole: 'Électricien Tertiaire',
    technicianInitials: 'KM',
    paidLeaveRemaining: 14.0,
    paidLeaveAcquired: 25,
    rttRemaining: 2,
    recoveryHours: 22,
  },
  {
    technicianId: 'tech-4',
    technicianName: 'Sophie L.',
    technicianRole: 'Plombière Chauffagiste',
    technicianInitials: 'SL',
    paidLeaveRemaining: 18.5,
    paidLeaveAcquired: 25,
    rttRemaining: 5,
    recoveryHours: 6,
  },
];

export const HOLIDAY_TERRITORIES: {
  id: HolidayTerritory;
  label: string;
  code: string;
  flag: string;
}[] = [
  { id: 'metropole', label: 'France Métropolitaine', code: 'FR', flag: '🇫🇷' },
  { id: 'guadeloupe', label: 'Guadeloupe (971)', code: '971', flag: '🇬🇵' },
  { id: 'martinique', label: 'Martinique (972)', code: '972', flag: '🇲🇶' },
  { id: 'guyane', label: 'Guyane (973)', code: '973', flag: '🇬🇫' },
  { id: 'reunion', label: 'La Réunion (974)', code: '974', flag: '🇷🇪' },
  { id: 'mayotte', label: 'Mayotte (976)', code: '976', flag: '🇾🇹' },
  { id: 'alsace_moselle', label: 'Alsace-Moselle', code: 'ALS', flag: '🥨' },
];

export const ALL_PUBLIC_HOLIDAYS_2026: PublicHoliday[] = [
  // 11 Jours Fériés Nationaux (Socle commun France)
  { date: '2026-01-01', name: 'Jour de l’An', territory: 'national', territoryLabel: 'National' },
  { date: '2026-04-06', name: 'Lundi de Pâques', territory: 'national', territoryLabel: 'National' },
  { date: '2026-05-01', name: 'Fête du Travail', territory: 'national', territoryLabel: 'National' },
  { date: '2026-05-08', name: 'Victoire 1945', territory: 'national', territoryLabel: 'National' },
  { date: '2026-05-14', name: 'Ascension', territory: 'national', territoryLabel: 'National' },
  { date: '2026-05-25', name: 'Lundi de Pentecôte', territory: 'national', territoryLabel: 'National' },
  { date: '2026-07-14', name: 'Fête Nationale', territory: 'national', territoryLabel: 'National' },
  { date: '2026-08-15', name: 'Assomption', territory: 'national', territoryLabel: 'National' },
  { date: '2026-11-01', name: 'Toussaint', territory: 'national', territoryLabel: 'National' },
  { date: '2026-11-11', name: 'Armistice 1918', territory: 'national', territoryLabel: 'National' },
  { date: '2026-12-25', name: 'Noël', territory: 'national', territoryLabel: 'National' },

  // Martinique (972)
  { date: '2026-04-03', name: 'Vendredi Saint', territory: 'martinique', territoryLabel: 'Martinique' },
  { date: '2026-05-22', name: 'Abolition de l’esclavage', territory: 'martinique', territoryLabel: 'Martinique' },
  { date: '2026-07-21', name: 'Fête Victor Schœlcher', territory: 'martinique', territoryLabel: 'Martinique' },

  // Guadeloupe (971)
  { date: '2026-04-03', name: 'Vendredi Saint', territory: 'guadeloupe', territoryLabel: 'Guadeloupe' },
  { date: '2026-05-27', name: 'Abolition de l’esclavage', territory: 'guadeloupe', territoryLabel: 'Guadeloupe' },
  { date: '2026-07-21', name: 'Fête Victor Schœlcher', territory: 'guadeloupe', territoryLabel: 'Guadeloupe' },

  // Guyane (973)
  { date: '2026-06-10', name: 'Abolition de l’esclavage', territory: 'guyane', territoryLabel: 'Guyane' },

  // La Réunion (974)
  { date: '2026-12-20', name: 'Abolition de l’esclavage (Fête Caf’)', territory: 'reunion', territoryLabel: 'La Réunion' },

  // Mayotte (976)
  { date: '2026-04-27', name: 'Abolition de l’esclavage', territory: 'mayotte', territoryLabel: 'Mayotte' },

  // Alsace-Moselle
  { date: '2026-04-03', name: 'Vendredi Saint', territory: 'alsace_moselle', territoryLabel: 'Alsace-Moselle' },
  { date: '2026-12-26', name: 'Saint-Étienne', territory: 'alsace_moselle', territoryLabel: 'Alsace-Moselle' },
];

export function getHolidaysForTerritory(territory: HolidayTerritory): PublicHoliday[] {
  return ALL_PUBLIC_HOLIDAYS_2026.filter(
    (h) => h.territory === 'national' || h.territory === territory,
  ).sort((a, b) => a.date.localeCompare(b.date));
}

export const PUBLIC_HOLIDAYS_2026 = getHolidaysForTerritory('metropole');

export const INITIAL_CALENDAR_EVENTS: PlanningCalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Réparation chaudière & Dépannage PAC',
    date: '2026-08-15',
    type: 'intervention',
    technicianId: 'tech-1',
    technicianName: 'Aurélie B.',
    technicianInitials: 'AB',
    tradeLabel: 'HVAC & Chauffage',
    trade: 'hvac',
    time: '09:00 - 12:00',
    details: 'Immeuble Haussmann, 42 Avenue de Friedland Paris 8e',
    status: 'en_cours',
    priority: 'high',
  },
  {
    id: 'evt-2',
    title: 'Raccordement Immeuble FTTO (Fibre)',
    date: '2026-08-18',
    type: 'intervention',
    technicianId: 'tech-2',
    technicianName: 'Thomas R.',
    technicianInitials: 'TR',
    tradeLabel: 'Fibre Optique',
    trade: 'fiber_telecom',
    time: '08:30 - 16:30',
    details: 'Bâtiment Tertiaire, 18 Rue de Bercy Paris 12e',
    status: 'planifie',
    priority: 'medium',
  },
  {
    id: 'evt-3',
    title: 'Mise en conformité TGBT & Disjoncteurs',
    date: '2026-08-19',
    type: 'intervention',
    technicianId: 'tech-3',
    technicianName: 'Karim M.',
    technicianInitials: 'KM',
    tradeLabel: 'Électricité',
    trade: 'electrical',
    time: '14:00 - 18:00',
    details: 'Résidence Caulaincourt, 12 Rue Caulaincourt Paris 18e',
    status: 'planifie',
    priority: 'high',
  },
  {
    id: 'evt-4',
    title: 'Remplacement Colonne & Vanne Générale',
    date: '2026-08-20',
    type: 'intervention',
    technicianId: 'tech-4',
    technicianName: 'Sophie L.',
    technicianInitials: 'SL',
    tradeLabel: 'Plomberie',
    trade: 'plumbing',
    time: '10:00 - 15:30',
    details: 'Syndic République, 75 Boulevard Voltaire Paris 11e',
    status: 'planifie',
    priority: 'urgent',
  },
  {
    id: 'evt-5',
    title: 'Congé annuel : Aurélie B.',
    date: '2026-08-17',
    endDate: '2026-08-21',
    type: 'leave',
    technicianId: 'tech-1',
    technicianName: 'Aurélie B.',
    technicianInitials: 'AB',
    details: 'Congés payés validés (5 jours ouvrés)',
  },
  {
    id: 'evt-7',
    title: 'Visite récurrente : Contrôle annuel VMC',
    date: '2026-08-26',
    type: 'recurring_task',
    technicianId: 'tech-1',
    technicianName: 'Aurélie B.',
    details: 'Contrat de maintenance annuelle n° 2026-MNT-89',
    time: '14:00',
  },
];

export const INITIAL_RECURRING_TASKS: RecurringTask[] = [
  {
    id: 'rec-1',
    title: 'Contrôle annuel VMC & Climatisation',
    frequency: 'yearly',
    nextDate: '2026-08-26',
    clientName: 'Clinique Saint-Honoré',
    clientAddress: '24 Rue du Faubourg Saint-Honoré, 75008 Paris',
    technicianName: 'Aurélie B.',
    category: 'HVAC & Génie Climatique',
    estimatedDuration: '3h00',
  },
  {
    id: 'rec-2',
    title: 'Audit semestriel TGBT & Onduleurs Datacenter',
    frequency: 'bi-annual',
    nextDate: '2026-09-12',
    clientName: 'Nox Cloud Hosting',
    clientAddress: '150 Avenue de France, 75013 Paris',
    technicianName: 'Karim M.',
    category: 'Électricité Courant Fort',
    estimatedDuration: '4h00',
  },
  {
    id: 'rec-3',
    title: 'Réflectométrie préventive Boucle Locale Optique',
    frequency: 'quarterly',
    nextDate: '2026-09-02',
    clientName: 'Opérateur Métropole Télécom',
    clientAddress: 'Point de Mutualisation PM-45, 75012 Paris',
    technicianName: 'Thomas R.',
    category: 'Fibre & Télécom',
    estimatedDuration: '2h30',
  },
  {
    id: 'rec-4',
    title: 'Vérification mensuelle disconnecteur & adoucisseurs',
    frequency: 'monthly',
    nextDate: '2026-09-01',
    clientName: 'Résidence Les Marronniers',
    clientAddress: '88 Rue de Rivoli, 75004 Paris',
    technicianName: 'Sophie L.',
    category: 'Plomberie & Réseaux d’eau',
    estimatedDuration: '1h30',
  },
];
