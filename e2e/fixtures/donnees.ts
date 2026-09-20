/**
 * Jeu de données de référence des parcours E2E.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CES DONNÉES SONT, ET CE QU'ELLES NE SONT PAS
 *
 * Elles alimentent un faux PostgREST (`supabase.ts`) : aucun appel ne sort, la
 * base réelle n'est jamais touchée. Ces parcours prouvent que L'INTERFACE
 * fonctionne — pas que les policies RLS ou les triggers font leur travail.
 *
 * La sécurité serveur reste couverte par `supabase/tests/` (17 suites SQL) et
 * par les tests Deno des fonctions Edge. Confondre les deux donnerait une
 * fausse assurance : un parcours vert ici ne dit RIEN d'une policy cassée.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ORGANISATION_ID = '11111111-1111-4111-8111-111111111111';
export const UTILISATEUR_ID = '22222222-2222-4222-8222-222222222222';
export const TECHNICIEN_ID = '33333333-3333-4333-8333-333333333333';
export const CLIENT_ID = '44444444-4444-4444-8444-444444444444';
export const MISSION_ID = '55555555-5555-4555-8555-555555555555';
/**
 * Identifiant de la LIGNE d'appartenance, pas de l'utilisateur.
 *
 * `MissionDetailPage` compare `mission.assigned_user_id` à `membership.id` :
 * confondre les deux ferait croire qu'un intervenant n'est jamais affecté.
 */
export const MEMBRE_ID = '77777777-7777-4777-8777-777777777777';
export const INTERVENTION_ID = '66666666-6666-4666-8666-666666666666';

/** Rôles de l'organisation, tels que `rbac.ts` les connaît. */
export type RoleTest = 'owner' | 'admin' | 'manager' | 'team_leader' | 'technician' | 'employee';

export const PROFILS: Record<RoleTest, { id: string; nom: string; email: string }> = {
  owner: { id: UTILISATEUR_ID, nom: 'Harry Bergoz', email: 'owner@rezo360.test' },
  admin: { id: UTILISATEUR_ID, nom: 'Harry Bergoz', email: 'admin@rezo360.test' },
  manager: { id: UTILISATEUR_ID, nom: 'Sarah Mercier', email: 'manager@rezo360.test' },
  team_leader: { id: UTILISATEUR_ID, nom: 'Luc Damas', email: 'chef@rezo360.test' },
  technician: { id: TECHNICIEN_ID, nom: 'Karim Toussaint', email: 'technicien@rezo360.test' },
  employee: { id: TECHNICIEN_ID, nom: 'Aline Rosier', email: 'employe@rezo360.test' },
};

const MAINTENANT = '2026-09-19T08:00:00.000Z';

/**
 * Table vide, mais typée.
 *
 * `[]` seul s'infère en `never[]` : un parcours qui veut y poser une ligne se
 * fait alors refuser par TypeScript, sans que le message dise pourquoi. Chaque
 * table absente du jeu de référence passe donc par ici.
 */
const vide = <T = Record<string, unknown>,>(): T[] => [];


/**
 * Construit le jeu de tables pour un rôle donné.
 *
 * Le rôle ne change QUE la ligne `organization_members` : c'est elle que
 * `usePermission` lit pour masquer les actions. Reproduire ici une matrice de
 * permissions serait un second miroir, qui divergerait de `rbac.ts`.
 */
export function donneesPour(role: RoleTest) {
  const profil = PROFILS[role];

  return {
    profiles: [
      {
        id: profil.id,
        display_name: profil.nom,
        avatar_id: null,
        created_at: MAINTENANT,
        updated_at: MAINTENANT,
      },
    ],

    organizations: [
      {
        id: ORGANISATION_ID,
        name: 'HBG Labs',
        slug: 'hbg-labs',
        legal_name: 'HBG Labs SAS',
        registration_number: '10919844000017',
        vat_number: 'FR18000000002',
        industry: 'fiber_telecom',
        status: 'active',
        address_line1: '12 rue des Flamboyants',
        postal_code: '97233',
        city: 'Schœlcher',
        country: 'FR',
        vat_regime: 'reel_normal',
        iban: null,
        bic: null,
        legal_form: 'SAS',
        ape_code: null,
        rcs_city: null,
        share_capital_cents: null,
        created_by: UTILISATEUR_ID,
        created_at: MAINTENANT,
        updated_at: MAINTENANT,
      },
    ],

    organization_members: [
      {
        id: MEMBRE_ID,
        organization_id: ORGANISATION_ID,
        user_id: profil.id,
        role,
        status: 'active',
        display_name: profil.nom,
        email: profil.email,
        created_at: MAINTENANT,
        updated_at: MAINTENANT,
      },
    ],

    subscriptions: [
      {
        id: '88888888-8888-4888-8888-888888888888',
        organization_id: ORGANISATION_ID,
        plan_code: 'enterprise',
        status: 'active',
        current_period_start: MAINTENANT,
        current_period_end: '2027-09-19T08:00:00.000Z',
        trial_ends_at: null,
        canceled_at: null,
        cancel_at_period_end: false,
        provider: null,
        provider_customer_id: null,
        provider_subscription_id: null,
        created_at: MAINTENANT,
        updated_at: MAINTENANT,
      },
    ],

    customers: [
      {
        id: CLIENT_ID,
        organization_id: ORGANISATION_ID,
        reference: 'CLI-0001',
        name: 'SCI Les Alizés',
        legal_name: 'SCI Les Alizés',
        registration_number: '85232291500018',
        customer_type: 'company',
        email: 'contact@alizes.test',
        phone: null,
        address_line1: '12 rue des Flamboyants',
        address_line2: null,
        postal_code: '97233',
        city: 'Schœlcher',
        country: 'FR',
        vat_number: null,
        notes: null,
        status: 'active',
        created_by: UTILISATEUR_ID,
        created_at: MAINTENANT,
        updated_at: MAINTENANT,
      },
    ],

    missions: [
      {
        id: MISSION_ID,
        organization_id: ORGANISATION_ID,
        reference: 'MIS-0413',
        title: 'Tirage fibre bâtiment C',
        description: 'Raccordement du bâtiment C, résidence Les Alizés.',
        status: 'in_progress',
        priority: 'high',
        customer_id: CLIENT_ID,
        site_id: null,
        intervention_type_id: null,
        category_id: null,
        /*
          TOUTES les colonnes de `public.missions`, même vides.

          PostgREST renvoie toujours la colonne, à `null`. L'interface s'appuie
          dessus : `mission.address_line1 !== null && mission.address_line1.trim()`
          plante sur `undefined`. Une fixture partielle ne se voit pas à la
          lecture — elle se voit en écran d'erreur.
        */
        // Types élargis : un parcours doit pouvoir affecter la mission sans que
        // TypeScript fige la colonne sur le littéral `null` du jeu de référence.
        assigned_user_id: null as string | null,
        assigned_team_id: null as string | null,
        actual_start: null,
        actual_end: null,
        location_label: 'Résidence Les Alizés — bât. C',
        address_line1: '12 rue des Flamboyants',
        address_line2: null,
        postal_code: '97233',
        city: 'Schœlcher',
        country: 'FR',
        latitude: null,
        longitude: null,
        customer_name: 'SCI Les Alizés',
        customer_contact: null,
        customer_phone: null,
        customer_email: null,
        notes: null,
        scheduled_start: '2026-09-19T11:30:00.000Z',
        scheduled_end: '2026-09-19T15:00:00.000Z',
        created_by: UTILISATEUR_ID,
        created_at: MAINTENANT,
        updated_at: MAINTENANT,
        /*
          Relations imbriquées de `MISSION_SELECT`.

          Elles sont écrites ici plutôt que résolues automatiquement : un
          résolveur générique reviendrait à réimplémenter PostgREST, et une
          jointure devinée de travers se verrait en vert. `null` explicite
          quand la relation est absente — l'interface teste `!== null`, et
          `undefined` la ferait planter (c'est exactement ce qui est arrivé
          au premier essai de ce parcours).
        */
        category: null,
        assigned_team: null,
        assigned_member: null,
        site: null,
        customer: { id: CLIENT_ID, reference: 'CLI-0001', name: 'SCI Les Alizés' },
      },
    ],

    /*
      Colonnes relevées sur `public.interventions`.

      `technician_id` porte l'identifiant de l'APPARTENANCE, pas celui du
      compte : `InterventionPage` calcule `canTrack` en le comparant à
      `membership.id`. S'y tromper ferait disparaître le chronomètre sans
      qu'aucun test ne l'explique.
    */
    interventions: [
      {
        id: INTERVENTION_ID,
        mission_id: MISSION_ID,
        organization_id: ORGANISATION_ID,
        technician_id: MEMBRE_ID,
        status: 'in_progress',
        start_time: '2026-09-19T09:48:00.000Z',
        end_time: null as string | null,
        start_latitude: null,
        start_longitude: null,
        notes: null,
        created_at: MAINTENANT,
        updated_at: MAINTENANT,
        // Embarqués par `select('*, report:…(*), attachments:…(*)')`.
        report: null as Record<string, unknown> | null,
        attachments: [] as Record<string, unknown>[],
      },
    ],

    intervention_time_entries: vide(),

    invoices: vide(),
    quotes: vide(),
    teams: vide(),
    notes: vide(),
    favorites: vide(),
    tool_history: vide(),
    audit_logs: vide(),
    leave_requests: vide(),
    stock_consumables: vide(),
    equipment: vide(),
    organization_documents: vide(),
    received_invoices: vide(),
    einvoicing_provider_connections: vide(),
  } satisfies Record<string, unknown[]>;
}

export type DonneesTest = ReturnType<typeof donneesPour>;
