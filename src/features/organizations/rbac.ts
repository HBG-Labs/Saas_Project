import type { OrgRole } from '@/types/database';

/**
 * Miroir TypeScript de la matrice `role_permissions`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER NE SÉCURISE RIEN.
 *
 * L'autorisation réelle est appliquée par PostgreSQL, dans les policies RLS et
 * les triggers. Ce miroir sert uniquement à l'INTERFACE : ne pas afficher un
 * bouton « Valider » à un technicien évite un aller-retour et un message
 * d'erreur, mais un technicien qui forcerait la requête serait de toute façon
 * refusé par le serveur.
 *
 * Le danger d'un tel miroir est qu'il diverge de la base et donne une fausse
 * idée des droits. `rbac.test.ts` lit le seed SQL et compare paire par paire :
 * une divergence casse `npm test`. Modifier l'un sans l'autre est impossible.
 *
 * Sources : supabase/migrations/20260808100100_rbac.sql
 *           supabase/migrations/20260809100300_rbac_customers.sql
 *           supabase/migrations/20260812100300_equipment.sql
 *           supabase/migrations/20260812100400_quotes.sql
 *           supabase/migrations/20260816100000_planning.sql
 *           supabase/migrations/20260817100000_retire_live_tracking.sql
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const PERMISSIONS = {
  organizationView: 'organization.view',
  organizationUpdate: 'organization.update',
  organizationDelete: 'organization.delete',

  billingView: 'billing.view',
  billingManage: 'billing.manage',

  memberView: 'member.view',
  memberInvite: 'member.invite',
  memberUpdateRole: 'member.update_role',
  memberRemove: 'member.remove',

  teamView: 'team.view',
  teamCreate: 'team.create',
  teamUpdate: 'team.update',
  teamDelete: 'team.delete',
  teamAssignMember: 'team.assign_member',

  customerView: 'customer.view',
  customerCreate: 'customer.create',
  customerUpdate: 'customer.update',
  customerDelete: 'customer.delete',

  missionViewAll: 'mission.view_all',
  missionCreate: 'mission.create',
  missionUpdate: 'mission.update',
  missionDelete: 'mission.delete',
  missionAssign: 'mission.assign',
  missionCancel: 'mission.cancel',

  interventionViewAll: 'intervention.view_all',
  interventionReview: 'intervention.review',

  equipmentView: 'equipment.view',
  equipmentManage: 'equipment.manage',

  quoteView: 'quote.view',
  quoteManage: 'quote.manage',

  leaveView: 'leave.view',
  leaveRequest: 'leave.request',
  leaveApprove: 'leave.approve',

  planningView: 'planning.view',
  planningManage: 'planning.manage',

  auditView: 'audit.view',
  statisticsView: 'statistics.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ORG_ROLES: readonly OrgRole[] = [
  'owner',
  'admin',
  'manager',
  'team_leader',
  'technician',
  'employee',
];

/** Libellés français des rôles, pour l'affichage. */
export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Responsable',
  team_leader: "Chef d'équipe",
  technician: 'Technicien',
  employee: 'Employé',
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Contrôle total, y compris la facturation et la suppression de l'organisation.",
  admin: 'Gestion des membres, des équipes et des missions.',
  manager: 'Pilotage des équipes, des missions et contrôle des comptes rendus.',
  team_leader: 'Pilotage de ses propres équipes et suivi de leurs missions.',
  technician: 'Accès à ses missions et à ses interventions uniquement.',
  employee: "Consultation restreinte de l'organisation.",
};

/**
 * Matrice rôle → permissions.
 *
 * ⚠️ Doit refléter EXACTEMENT le seed de `20260808100100_rbac.sql`.
 */
export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: [
    'organization.view',
    'organization.update',
    'organization.delete',
    'billing.view',
    'billing.manage',
    'member.view',
    'member.invite',
    'member.update_role',
    'member.remove',
    'team.view',
    'team.create',
    'team.update',
    'team.delete',
    'team.assign_member',
    'customer.view',
    'customer.create',
    'customer.update',
    'customer.delete',
    'mission.view_all',
    'mission.create',
    'mission.update',
    'mission.delete',
    'mission.assign',
    'mission.cancel',
    'intervention.view_all',
    'intervention.review',
    'equipment.view',
    'equipment.manage',
    'quote.view',
    'quote.manage',
    'leave.view',
    'leave.request',
    'leave.approve',
    'planning.view',
    'planning.manage',
    'audit.view',
    'statistics.view',
  ],

  admin: [
    'organization.view',
    'organization.update',
    'billing.view',
    'member.view',
    'member.invite',
    'member.update_role',
    'member.remove',
    'team.view',
    'team.create',
    'team.update',
    'team.delete',
    'team.assign_member',
    'customer.view',
    'customer.create',
    'customer.update',
    'customer.delete',
    'mission.view_all',
    'mission.create',
    'mission.update',
    'mission.delete',
    'mission.assign',
    'mission.cancel',
    'intervention.view_all',
    'intervention.review',
    'equipment.view',
    'equipment.manage',
    'quote.view',
    'quote.manage',
    'leave.view',
    'leave.request',
    'leave.approve',
    'planning.view',
    'planning.manage',
    'audit.view',
    'statistics.view',
  ],

  manager: [
    'organization.view',
    'member.view',
    'team.view',
    'team.create',
    'team.update',
    'team.assign_member',
    // Gère le portefeuille au quotidien, sans pouvoir supprimer une fiche :
    // une suppression rompt le lien de missions archivées.
    'customer.view',
    'customer.create',
    'customer.update',
    'mission.view_all',
    'mission.create',
    'mission.update',
    'mission.assign',
    'mission.cancel',
    'intervention.view_all',
    'intervention.review',
    'equipment.view',
    'equipment.manage',
    'quote.view',
    'quote.manage',
    // Accorde les congés : c'est une décision d'employeur, et le responsable
    // l'exerce au quotidien. Le trigger `enforce_leave_decision` lui interdit
    // en revanche de statuer sur les siens.
    'leave.view',
    'leave.request',
    'leave.approve',
    'planning.view',
    'planning.manage',
    'statistics.view',
  ],

  team_leader: [
    'organization.view',
    'member.view',
    'team.view',
    'team.assign_member',
    // Consultation seule : il prépare des interventions, il ne tient pas le
    // fichier client.
    'customer.view',
    'mission.create',
    'mission.update',
    'mission.assign',
    'intervention.review',
    // Consulte le parc pour préparer une intervention, et un devis accepté pour
    // savoir ce qui a été vendu. Il ne fixe ni l'inventaire ni les prix.
    'equipment.view',
    'quote.view',
    // Constate les absences pour organiser ses semaines, et voit qui est où
    // pour répartir une urgence. Il n'ACCORDE pas les congés.
    'leave.view',
    'leave.request',
    'planning.view',
    'statistics.view',
  ],

  // Aucune permission de contrôle : un technicien ne valide jamais un compte
  // rendu, y compris celui d'un collègue. La règle « jamais le sien » est en
  // plus appliquée par trigger pour les rôles qui, eux, peuvent contrôler.
  //
  // Aucune permission « customer.* » non plus, et c'est délibéré : il n'a pas à
  // connaître le portefeuille de l'entreprise. Il atteint la fiche du client
  // CHEZ QUI il intervient par la policy `customers_select`, qui passe par ses
  // missions — le besoin est couvert sans vue d'ensemble.
  // `equipment.view` est la seule ouverture : il doit pouvoir vérifier que le
  // réflectomètre qu'on lui confie est encore étalonné. Aucun accès aux devis —
  // les tarifs de l'entreprise ne le regardent pas, comme le fichier client.
  //
  // `leave.request` en revanche est accordée à tous, technicien et employé
  // compris : poser un congé n'est pas un privilège de gestion. Sans
  // `leave.view`, chacun ne voit que ses propres demandes — la policy passe
  // alors par `app.is_own_membership`, pas par une permission.
  technician: [
    'organization.view',
    'team.view',
    'member.view',
    'equipment.view',
    'leave.request',
    'planning.view',
  ],

  employee: ['organization.view', 'member.view', 'leave.request'],
};

export function roleHasPermission(role: OrgRole | null, permission: Permission): boolean {
  if (role === null) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Vrai si le rôle possède AU MOINS une des permissions demandées. */
export function roleHasAnyPermission(
  role: OrgRole | null,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => roleHasPermission(role, permission));
}

/**
 * Un intervenant ne contrôle jamais son propre compte rendu.
 *
 * Reproduit en TypeScript la règle appliquée par le trigger
 * `enforce_report_review_separation`. La comparaison porte sur l'identifiant
 * `auth.users`, et non sur l'identifiant de membership : une même personne
 * pourrait posséder plusieurs lignes de membership et se contrôler par ce
 * détour.
 */
export function canReviewReport(params: {
  role: OrgRole | null;
  reviewerUserId: string | null;
  technicianUserId: string | null;
}): boolean {
  const { role, reviewerUserId, technicianUserId } = params;

  if (!roleHasPermission(role, PERMISSIONS.interventionReview)) return false;
  if (reviewerUserId === null || technicianUserId === null) return false;

  return reviewerUserId !== technicianUserId;
}
