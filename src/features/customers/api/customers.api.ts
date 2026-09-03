import { AppError } from '@/lib/errors';
import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { ContentStatus, TablesUpdate } from '@/types/database';
import type { Customer, CustomerContact, MissionWithRelations, Site } from '@/types/domain';

/**
 * Accès au portefeuille clients : fiches, contacts, sites.
 *
 * Seul endroit de la feature autorisé à parler à Supabase. Les trois tables
 * partagent la même discipline côté serveur :
 *
 *   • `customers_*` filtre par `app.can_use_pro_module(organization_id, 'customers')`
 *     et exige `customer.*` pour écrire ;
 *   • `customer_contacts` et `sites` héritent de l'organisation du client par le
 *     trigger `enforce_customer_child_org` — le client ne choisit pas son tenant ;
 *   • `customers_generate_reference` pose la référence `CLI-nnnn`. Ne jamais la
 *     calculer ici : deux sessions simultanées produiraient le même numéro.
 *
 * Aucun repli local. Un refus de droits ou une panne réseau remonte en erreur.
 */

// -----------------------------------------------------------------------------
// Clients
// -----------------------------------------------------------------------------

export interface CustomerFilters {
  search?: string;
  status?: ContentStatus;
  limit?: number;
}

export async function listCustomers(
  organizationId: string,
  filters: CustomerFilters = {},
): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', filters.status ?? 'active');

  if (filters.search) {
    // `%`, `,` et les parenthèses sont la syntaxe du filtre `or` de PostgREST :
    // les laisser passer permettrait de réécrire la requête depuis le champ de
    // recherche. Les neutraliser suffit, la RLS restant de toute façon en place.
    const term = filters.search.replace(/[%,()]/g, ' ').trim();
    if (term !== '') {
      query = query.or(`name.ilike.%${term}%,reference.ilike.%${term}%,city.ilike.%${term}%`);
    }
  }

  return unwrap(
    query
      .order('name', { ascending: true })
      .limit(filters.limit ?? 200)
      .returns<Customer[]>(),
  );
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  return unwrapMaybe(supabase.from('customers').select('*').eq('id', customerId).single());
}

export async function createCustomer(input: {
  organizationId: string;
  name: string;
  legalName?: string;
  /**
   * SIRET ou SIREN. Absent de cette signature jusqu'au 03/09/2026 : le champ
   * existait en base et dans le schéma de validation, mais aucun chemin
   * d'écriture ne l'atteignait à la création. Sans lui, aucune facture
   * électronique ne peut être émise vers ce client — l'identifiant du
   * destinataire est une mention obligatoire.
   */
  registrationNumber?: string;
  /**
   * Même histoire : le formulaire proposait déjà un champ « N° TVA », et sa
   * valeur était perdue en silence à la création. Elle n'était conservée qu'en
   * modifiant la fiche ensuite.
   */
  vatNumber?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
}): Promise<Customer> {
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    throw new AppError('unauthenticated', 'Vous devez être connecté pour créer un client.');
  }

  const customer = await unwrap(
    supabase
      .from('customers')
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        created_by: userData.user.id,
        ...(input.legalName !== undefined ? { legal_name: input.legalName } : {}),
        ...(input.registrationNumber !== undefined
          ? { registration_number: input.registrationNumber }
          : {}),
        ...(input.vatNumber !== undefined ? { vat_number: input.vatNumber } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.addressLine1 !== undefined ? { address_line1: input.addressLine1 } : {}),
        ...(input.postalCode !== undefined ? { postal_code: input.postalCode } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      })
      .select('*')
      .single(),
  );

  // Création automatique du site principal rattaché avec coordonnées pour affichage en cartographie
  if (input.addressLine1 || input.city || input.postalCode || input.latitude != null) {
    try {
      await supabase.from('sites').insert({
        customer_id: customer.id,
        organization_id: input.organizationId,
        name: 'Site Principal',
        address_line1: input.addressLine1 ?? null,
        postal_code: input.postalCode ?? null,
        city: input.city ?? null,
        country: input.country ?? 'FR',
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });
    } catch {
      // Ignorer si la création du site échoue
    }
  }

  return customer;
}

export async function updateCustomer(
  customerId: string,
  patch: TablesUpdate<'customers'>,
): Promise<Customer> {
  return unwrap(supabase.from('customers').update(patch).eq('id', customerId).select('*').single());
}

/**
 * Archive un client plutôt que de le supprimer.
 *
 * Missions, interventions et comptes rendus le référencent. Supprimer la fiche
 * romprait ces liens — les colonnes sont en `on delete set null` — et l'on
 * perdrait la trace de chez qui l'intervention a eu lieu. `archived` le retire
 * des listes sans altérer le passé.
 */
export async function archiveCustomer(customerId: string): Promise<Customer> {
  return updateCustomer(customerId, { status: 'archived' });
}

export async function restoreCustomer(customerId: string): Promise<Customer> {
  return updateCustomer(customerId, { status: 'active' });
}

/**
 * Suppression définitive — réservée à `customer.delete`, donc aux propriétaires
 * et administrateurs. Préférer `archiveCustomer` dans l'interface courante.
 */
export async function deleteCustomer(customerId: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', customerId);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Contacts
// -----------------------------------------------------------------------------

export async function listContacts(customerId: string): Promise<CustomerContact[]> {
  return unwrap(
    supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false })
      .order('last_name', { ascending: true }),
  );
}

export async function createContact(input: {
  customerId: string;
  organizationId: string;
  lastName: string;
  firstName?: string;
  roleLabel?: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<CustomerContact> {
  return unwrap(
    supabase
      .from('customer_contacts')
      .insert({
        customer_id: input.customerId,
        organization_id: input.organizationId,
        last_name: input.lastName,
        ...(input.firstName !== undefined ? { first_name: input.firstName } : {}),
        ...(input.roleLabel !== undefined ? { role_label: input.roleLabel } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      })
      .select('*')
      .single(),
  );
}

export async function updateContact(
  contactId: string,
  patch: TablesUpdate<'customer_contacts'>,
): Promise<CustomerContact> {
  return unwrap(
    supabase.from('customer_contacts').update(patch).eq('id', contactId).select('*').single(),
  );
}

export async function deleteContact(contactId: string): Promise<void> {
  const { error } = await supabase.from('customer_contacts').delete().eq('id', contactId);
  if (error) throw error;
}

/**
 * Désigne le contact principal d'un client.
 *
 * En deux temps, faute de contrainte d'unicité en base : on rétrograde d'abord
 * le contact principal en place, puis on promeut le nouveau. Si la première
 * écriture est refusée, la seconde n'a pas lieu — le client ne se retrouve pas
 * avec deux contacts principaux.
 */
export async function setPrimaryContact(
  customerId: string,
  contactId: string,
): Promise<CustomerContact> {
  const { error } = await supabase
    .from('customer_contacts')
    .update({ is_primary: false })
    .eq('customer_id', customerId)
    .eq('is_primary', true);

  if (error) throw error;

  return updateContact(contactId, { is_primary: true });
}

// -----------------------------------------------------------------------------
// Sites
// -----------------------------------------------------------------------------

export async function listSites(customerId: string): Promise<Site[]> {
  return unwrap(
    supabase
      .from('sites')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('name', { ascending: true }),
  );
}

/** Sites de l'organisation entière — alimente le sélecteur du formulaire de mission. */
export async function listOrganizationSites(organizationId: string): Promise<Site[]> {
  return unwrap(
    supabase
      .from('sites')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('name', { ascending: true }),
  );
}

export async function getSite(siteId: string): Promise<Site | null> {
  return unwrapMaybe(supabase.from('sites').select('*').eq('id', siteId).single());
}

export async function createSite(input: {
  customerId: string;
  organizationId: string;
  name: string;
  code?: string;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  accessNotes?: string;
  contactId?: string;
}): Promise<Site> {
  return unwrap(
    supabase
      .from('sites')
      .insert({
        customer_id: input.customerId,
        organization_id: input.organizationId,
        name: input.name,
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.addressLine1 !== undefined ? { address_line1: input.addressLine1 } : {}),
        ...(input.postalCode !== undefined ? { postal_code: input.postalCode } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.accessNotes !== undefined ? { access_notes: input.accessNotes } : {}),
        ...(input.contactId !== undefined ? { contact_id: input.contactId } : {}),
      })
      .select('*')
      .single(),
  );
}

export async function updateSite(siteId: string, patch: TablesUpdate<'sites'>): Promise<Site> {
  return unwrap(supabase.from('sites').update(patch).eq('id', siteId).select('*').single());
}

export async function archiveSite(siteId: string): Promise<Site> {
  return updateSite(siteId, { status: 'archived' });
}

/**
 * Reporte l'adresse et la position d'une fiche client sur son site principal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE DÉTOUR PLUTÔT QU'UNE COLONNE SUR `customers`
 *
 * `customers` ne porte ni `latitude` ni `longitude` — seul `sites` les a. Le
 * formulaire d'édition les glissait pourtant dans son patch, que PostgREST
 * rejetait : toute modification de fiche échouait. Corrigé le 03/09/2026.
 *
 * Les coordonnées ont bien une destination, mais c'est le site principal, celui
 * que `createCustomer` fabrique à la création. Cette fonction est le chemin qui
 * manquait pour l'atteindre depuis une édition.
 *
 * CE QU'ELLE REFUSE DE DEVINER
 *
 * Un client peut avoir plusieurs sites, et rien ne dit alors lequel porte
 * « l'adresse du client ». En déplacer un au hasard vaudrait moins que ne rien
 * faire — un chantier qui bouge sur la carte sans raison est pire qu'un
 * chantier non géolocalisé. D'où trois cas seulement :
 *
 *   • aucun site        → on crée « Site Principal » ;
 *   • un seul site      → c'est lui, sans ambiguïté ;
 *   • plusieurs sites   → uniquement celui nommé « Site Principal », sinon rien.
 *
 * Les erreurs ne sont pas avalées : `updateCustomer` étant idempotent, une
 * nouvelle soumission réessaie sans dégât.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const PRIMARY_SITE_NAME = 'Site Principal';

export async function syncPrimarySiteLocation(input: {
  customerId: string;
  organizationId: string;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
}): Promise<Site | null> {
  const sites = await listSites(input.customerId);

  const patch: TablesUpdate<'sites'> = {
    address_line1: input.addressLine1 ?? null,
    postal_code: input.postalCode ?? null,
    city: input.city ?? null,
    country: input.country ?? 'FR',
    latitude: input.latitude,
    longitude: input.longitude,
  };

  if (sites.length === 0) {
    return createSite({
      customerId: input.customerId,
      organizationId: input.organizationId,
      name: PRIMARY_SITE_NAME,
      ...(input.addressLine1 != null ? { addressLine1: input.addressLine1 } : {}),
      ...(input.postalCode != null ? { postalCode: input.postalCode } : {}),
      ...(input.city != null ? { city: input.city } : {}),
      ...(input.country != null ? { country: input.country } : {}),
      latitude: input.latitude,
      longitude: input.longitude,
    });
  }

  const cible =
    sites.length === 1 ? sites[0] : sites.find((s) => s.name === PRIMARY_SITE_NAME);

  // Plusieurs sites et aucun « Site Principal » : on ne choisit pas à la place
  // de l'utilisateur, il modifiera le bon site depuis l'onglet Sites.
  if (!cible) return null;

  return updateSite(cible.id, patch);
}

// -----------------------------------------------------------------------------
// Historique
// -----------------------------------------------------------------------------

export async function listCustomerMissions(
  customerId: string,
  limit = 50,
): Promise<MissionWithRelations[]> {
  return unwrap(
    supabase
      .from('missions')
      .select(
        `*,
         category:categories(id, slug, name),
         assigned_team:teams(id, name, color),
         assigned_member:organization_members(*, profile:profiles(id, display_name, avatar_id)),
         customer:customers(id, reference, name),
         site:sites(id, name, city, access_notes)`,
      )
      .eq('customer_id', customerId)
      .order('scheduled_start', { ascending: false, nullsFirst: false })
      .limit(limit)
      .returns<MissionWithRelations[]>(),
  );
}
