import { AppError } from '@/lib/errors';
import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { ContentStatus, TablesUpdate } from '@/types/database';
import type { Customer, CustomerContact, MissionWithRelations, Site } from '@/types/domain';

/**
 * Accès aux clients, contacts et sites d'intervention.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE MODULE NE VÉRIFIE AUCUN DROIT.
 *
 * `customers_select` décide de ce qui est visible, et les policies d'écriture de
 * ce qui est permis. Dupliquer ces règles ici les ferait diverger — c'est la
 * couche qu'on oublie de mettre à jour.
 *
 * Une nuance vaut d'être connue en lisant ce fichier : la visibilité d'un client
 * a DEUX origines. Ceux qui tiennent le portefeuille (`customer.view`) les voient
 * tous ; un technicien ne voit que le client CHEZ QUI il intervient, par une
 * seconde branche de la policy qui passe par ses missions. Une liste réduite à
 * un seul élément n'est donc pas une anomalie.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CUSTOMER_SELECT = '*' as const;

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
    .select(CUSTOMER_SELECT)
    .eq('organization_id', organizationId);

  // Par défaut, les fiches archivées restent hors de la liste : on les archive
  // précisément pour ne plus les voir au quotidien.
  query = query.eq('status', filters.status ?? 'active');

  if (filters.search) {
    // `%`, `,` et les parenthèses sont significatifs dans la syntaxe `or()` de
    // PostgREST : les laisser passer permettrait d'injecter des conditions.
    const term = filters.search.replace(/[%,()]/g, ' ').trim();
    if (term !== '') {
      query = query.or(`name.ilike.%${term}%,reference.ilike.%${term}%,city.ilike.%${term}%`);
    }
  }

  return unwrap(
    query.order('name', { ascending: true }).limit(filters.limit ?? 200).returns<Customer[]>(),
  );
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  return unwrapMaybe(supabase.from('customers').select('*').eq('id', customerId).single());
}

/**
 * Crée un client.
 *
 * `reference` est absente des paramètres : le trigger `generate_customer_reference`
 * la calcule par organisation (`CLI-0042`). La laisser au client produirait des
 * collisions, et des numéros devinables d'une entreprise à l'autre.
 */
export async function createCustomer(input: {
  organizationId: string;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  notes?: string;
}): Promise<Customer> {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    throw new AppError('unauthenticated', 'Vous devez être connecté pour créer un client.', {
      ...(error ? { cause: error } : {}),
    });
  }

  return unwrap(
    supabase
      .from('customers')
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        // Imposé à `auth.uid()` par la policy d'insertion : le fournir depuis
        // l'appelant permettrait d'attribuer la création à un tiers.
        created_by: userData.user.id,
        ...(input.legalName !== undefined ? { legal_name: input.legalName } : {}),
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
}

export async function updateCustomer(
  customerId: string,
  patch: TablesUpdate<'customers'>,
): Promise<Customer> {
  return unwrap(
    supabase.from('customers').update(patch).eq('id', customerId).select('*').single(),
  );
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

// -----------------------------------------------------------------------------
// Contacts
// -----------------------------------------------------------------------------

export async function listContacts(customerId: string): Promise<CustomerContact[]> {
  return unwrap(
    supabase
      .from('customer_contacts')
      .select('*')
      // L'interlocuteur principal en tête : c'est celui qu'on appelle.
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
        // Écrasé par le trigger `enforce_customer_child_org` depuis le client
        // parent : la valeur envoyée ici n'est jamais retenue. Elle reste exigée
        // par la contrainte `not null`, d'où sa présence.
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
 * Désigne l'interlocuteur principal.
 *
 * DEUX écritures, dans cet ordre imposé. Un index unique partiel n'autorise
 * qu'un seul `is_primary` par client : promouvoir avant de rétrograder violerait
 * la contrainte. PostgREST n'exposant pas de transaction depuis le client, si la
 * seconde écriture échoue le client se retrouve sans interlocuteur principal —
 * état dégradé mais valide, là où l'ordre inverse produirait une erreur
 * systématique.
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
  accessNotes?: string;
  contactId?: string;
}): Promise<Site> {
  return unwrap(
    supabase
      .from('sites')
      .insert({
        customer_id: input.customerId,
        // Écrasé par trigger, comme pour les contacts.
        organization_id: input.organizationId,
        name: input.name,
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.addressLine1 !== undefined ? { address_line1: input.addressLine1 } : {}),
        ...(input.postalCode !== undefined ? { postal_code: input.postalCode } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
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

// -----------------------------------------------------------------------------
// Historique
// -----------------------------------------------------------------------------

/**
 * Missions rattachées à un client.
 *
 * C'est la vue qui donne sa valeur au module : sans elle, un client n'est qu'un
 * carnet d'adresses. La policy `missions_select_scoped` s'applique — un
 * technicien n'y verra que SES interventions chez ce client, un responsable
 * toutes.
 */
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
         assigned_member:organization_members(*, profile:profiles(id, display_name, avatar_url)),
         customer:customers(id, reference, name),
         site:sites(id, name, city, access_notes)`,
      )
      .eq('customer_id', customerId)
      .order('scheduled_start', { ascending: false, nullsFirst: false })
      .limit(limit)
      .returns<MissionWithRelations[]>(),
  );
}
