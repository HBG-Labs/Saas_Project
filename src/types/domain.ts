import type { Database, Tables } from './database';

/**
 * Types métier de l'application.
 *
 * Ils dérivent des types de base pour rester automatiquement synchronisés avec
 * le schéma, tout en donnant à l'application un vocabulaire indépendant du
 * stockage.
 */

// ---------------------------------------------------------------- socle & catalogue
export type Profile = Tables<'profiles'>;
export type ProfileDetails = Tables<'profile_details'>;
export type Category = Tables<'categories'>;
export type Tool = Tables<'tools'>;
export type Favorite = Tables<'favorites'>;
export type ToolHistoryEntry = Tables<'tool_history'>;

/** Outil du catalogue accompagné de sa catégorie (jointure courante). */
export interface ToolWithCategory extends Tool {
  category: Pick<Category, 'id' | 'slug' | 'name'>;
}

// -------------------------------------------------------------------- multi-tenant
export type Organization = Tables<'organizations'>;
export type OrganizationMember = Tables<'organization_members'>;
export type OrganizationInvitation = Tables<'organization_invitations'>;
export type RolePermission = Tables<'role_permissions'>;

/**
 * Membre accompagné de son profil.
 *
 * `profile` reste nullable, mais plus pour la raison d'origine : depuis
 * `profiles_select_visible`, un collègue de la même organisation EST lisible.
 * Le `null` ne subsiste que pour un compte antérieur au trigger
 * `handle_new_user`, ou pour un membre d'une autre organisation croisé par une
 * jointure large. L'affichage doit toujours le prévoir — `memberDisplayName`
 * retombe alors sur le poste occupé.
 *
 * Seule l'IDENTITÉ transite ici. Le téléphone, la zone et les habilitations
 * vivent dans `profile_details`, que son seul titulaire peut lire.
 */
export interface MemberWithProfile extends OrganizationMember {
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_id'> | null;
}

// -------------------------------------------------------------------------- équipes
export type Team = Tables<'teams'>;
export type TeamMember = Tables<'team_members'>;

export interface TeamWithMembers extends Team {
  members: (TeamMember & { member: MemberWithProfile })[];
}

// -------------------------------------------------------------------------- clients
export type Customer = Tables<'customers'>;
export type CustomerContact = Tables<'customer_contacts'>;
export type Site = Tables<'sites'>;

/** Site accompagné de son interlocuteur, tel qu'affiché sur une fiche. */
export interface SiteWithContact extends Site {
  contact: CustomerContact | null;
}

/** Client complet : la vue « fiche », avec ses contacts et ses sites. */
export interface CustomerWithRelations extends Customer {
  contacts: CustomerContact[];
  sites: Site[];
}

// ------------------------------------------------------------------------- missions
export type Mission = Tables<'missions'>;
export type MissionAssignment = Tables<'mission_assignments'>;
export type MissionStatusEvent = Tables<'mission_status_events'>;
export type MissionStatusTransition = Tables<'mission_status_transitions'>;

/** Mission enrichie des libellés attendus par les listes et le planning. */
export interface MissionWithRelations extends Mission {
  category: Pick<Category, 'id' | 'slug' | 'name'> | null;
  assigned_team: Pick<Team, 'id' | 'name' | 'color'> | null;
  assigned_member: MemberWithProfile | null;
  /**
   * Fiche client et site rattachés, quand ils existent.
   *
   * À ne pas confondre avec les colonnes `customer_name` / adresse de la mission :
   * celles-ci sont un INSTANTANÉ figé à la création, que la fiche vivante ci-dessous
   * ne doit jamais réécrire. Un compte rendu de 2024 conserve le nom qu'avait le
   * client à l'époque.
   */
  customer: Pick<Customer, 'id' | 'reference' | 'name'> | null;
  site: Pick<Site, 'id' | 'name' | 'city' | 'access_notes'> | null;
}

// -------------------------------------------------------------------- interventions
export type Intervention = Tables<'interventions'>;
export type InterventionReport = Tables<'intervention_reports'>;
export type InterventionAttachment = Tables<'intervention_attachments'>;
export type InterventionTimeEntry = Tables<'intervention_time_entries'>;

export interface InterventionWithReport extends Intervention {
  report: InterventionReport | null;
  attachments: InterventionAttachment[];
}

/**
 * Compte rendu accompagné de ce qui permet de l'identifier.
 *
 * La file de contrôle en a besoin : sans mission ni auteur, elle présente des
 * cartes interchangeables, et le contrôleur doit ouvrir chacune pour savoir
 * laquelle il regarde.
 *
 * Les deux relations sont NULLABLES, et pas seulement par prudence de typage :
 * un chef d'équipe détient `intervention.review` sans `mission.view_all`, et la
 * policy `missions_select_scoped` peut donc lui masquer la mission dont il
 * contrôle pourtant le compte rendu.
 */
export interface ReportForReview extends InterventionReport {
  intervention: {
    id: string;
    mission: Pick<Mission, 'id' | 'reference' | 'title'> | null;
    technician: MemberWithProfile | null;
  } | null;
}

// ----------------------------------------------------------------- audit & facturation
export type AuditLog = Tables<'audit_logs'>;
export type Plan = Tables<'plans'>;
export type PlanFeature = Tables<'plan_features'>;
export type Subscription = Tables<'subscriptions'>;

/** Plan accompagné de ses fonctionnalités : la forme utile côté produit. */
export interface PlanWithFeatures extends Plan {
  features: PlanFeature[];
}

// ----------------------------------------------------------------- parc matériel
export type Equipment = Tables<'equipment'>;

/** Appareil accompagné du membre à qui il est confié — la forme affichée au parc. */
export interface EquipmentWithAssignee extends Equipment {
  assigned_member: MemberWithProfile | null;
}

// ----------------------------------------------------------------- devis
export type QuoteTemplate = Tables<'quote_templates'>;
export type Quote = Tables<'quotes'>;
export type QuoteItem = Tables<'quote_items'>;
export type QuoteTotals = Database['public']['Views']['quote_totals']['Row'];

/**
 * Devis complet : ses lignes et ses totaux.
 *
 * Les totaux viennent de la vue `quote_totals`, jamais d'un calcul local — c'est
 * la même somme que celle qui figurera sur le document remis au client.
 */
export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
  totals: QuoteTotals | null;
}

/** Un devis d'historique, montant TTC compris — sans le détail de ses lignes. */
export interface QuoteWithTotals extends Quote {
  totals: QuoteTotals | null;
}

// ----------------------------------------------------------------- bloc-notes
export type Note = Tables<'notes'>;

// ------------------------------------------------------------------- planning
export type LeaveRequestRow = Tables<'leave_requests'>;
export type LeaveBalanceRow = Tables<'leave_balances'>;
export type RecurringTaskRow = Tables<'recurring_tasks'>;

/** Demande de congé accompagnée de son titulaire — la forme affichée à l'écran. */
export interface LeaveRequestWithMember extends LeaveRequestRow {
  member: MemberWithProfile | null;
}

/**
 * Solde consolidé : ce qui est acquis, ce qui est consommé, ce qui reste.
 *
 * Seul l'acquis est stocké. `taken` est la somme des congés APPROUVÉS de
 * l'année, et `remaining` la différence. Ce type n'existe donc pas en base :
 * c'est la vue qu'en a l'écran, calculée à la lecture pour qu'aucun solde ne
 * puisse dériver de ses demandes.
 */
export interface ConsolidatedLeaveBalance {
  memberId: string;
  year: number;
  paidLeaveAcquired: number;
  paidLeaveTaken: number;
  paidLeaveRemaining: number;
  rttAcquired: number;
  rttTaken: number;
  rttRemaining: number;
  recoveryHours: number;
  member: MemberWithProfile | null;
}

export interface RecurringTaskWithRefs extends RecurringTaskRow {
  customer: Pick<Customer, 'id' | 'name'> | null;
  site: Pick<Site, 'id' | 'name' | 'address_line1' | 'city'> | null;
  assigned_member: MemberWithProfile | null;
}

// --------------------------------------------------------------- cartographie
//
// Aucun type de position d'intervenant ici : le suivi GPS continu est abandonné
// (`20260817100000_retire_live_tracking.sql`). La carte compose des LIEUX —
// missions géolocalisées, sites, clients — à partir des types ci-dessus.
//
// Les tables `technician_locations` et `technician_location_pings` existent
// encore en base, vides et inatteignables. Leur redonner un type exporté
// reviendrait à rouvrir la porte par commodité.
