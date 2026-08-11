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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

const STORAGE_CUSTOMERS_KEY = 'nexoratech_local_customers';

const DEFAULT_DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    organization_id: 'org-demo',
    reference: 'CLI-0001',
    name: 'Aethel Telecom Solutions',
    legal_name: 'Aethel Telecom SA',
    registration_number: '123 456 789 00012',
    vat_number: 'FR12123456789',
    email: 'contact@aethel-telecom.com',
    phone: '0696 12 34 56',
    address_line1: 'Immeuble Aethel Tower',
    address_line2: 'Rue Henri Becquerel',
    postal_code: '97200',
    city: 'FORT-DE-FRANCE',
    country: 'FR',
    notes: 'Client grand compte infrastructure optique.',
    status: 'active',
    created_by: null,
    created_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-2',
    organization_id: 'org-demo',
    reference: 'CLI-0002',
    name: 'Nexis Networks & Infra',
    legal_name: 'Nexis Networks SAS',
    registration_number: '987 654 321 00054',
    vat_number: 'FR98987654321',
    email: 'exploitation@nexis-networks.io',
    phone: '0696 98 76 54',
    address_line1: 'Zone Technopole Nexis',
    address_line2: null,
    postal_code: '97232',
    city: 'LE LAMENTIN',
    country: 'FR',
    notes: 'Interventions sur réseau mobile et antennes FH.',
    status: 'active',
    created_by: null,
    created_at: new Date(Date.now() - 3600000 * 24 * 15).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-3',
    organization_id: 'org-demo',
    reference: 'CLI-0003',
    name: 'Voltaic Energy SA',
    legal_name: 'Voltaic Energy & Power SA',
    registration_number: '456 789 123 00088',
    vat_number: 'FR45456789123',
    email: 'maintenance@voltaic-energy.com',
    phone: '0696 55 44 33',
    address_line1: 'Zone Industrielle Voltaic',
    address_line2: null,
    postal_code: '97232',
    city: 'LE LAMENTIN',
    country: 'FR',
    notes: 'Accès site sécurisé avec port des EPI obligatoires.',
    status: 'active',
    created_by: null,
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-4',
    organization_id: 'org-demo',
    reference: 'CLI-0004',
    name: 'Solaria Communications',
    legal_name: 'Solaria Comms SARL',
    registration_number: '777 888 999 00011',
    vat_number: 'FR77777888999',
    email: 'contact@solaria-comms.net',
    phone: '0696 33 22 11',
    address_line1: 'Parc d’Activités Solaria',
    address_line2: null,
    postal_code: '97233',
    city: 'SCHOELCHER',
    country: 'FR',
    notes: 'Installations faisceaux hertziens et 5G.',
    status: 'active',
    created_by: null,
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-5',
    organization_id: 'org-demo',
    reference: 'CLI-0005',
    name: 'Kyros Fiber Engineering',
    legal_name: 'Kyros Fiber SAS',
    registration_number: '333 222 111 00044',
    vat_number: 'FR33333222111',
    email: 'projects@kyros-fiber.com',
    phone: '0696 44 88 11',
    address_line1: 'Espace Kyros Innovation',
    address_line2: null,
    postal_code: '97224',
    city: 'DUCOS',
    country: 'FR',
    notes: 'Projets tirage optique et maintenance HTA/BT.',
    status: 'active',
    created_by: null,
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function getLocalCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOMERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Customer[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(DEFAULT_DEMO_CUSTOMERS));
    return DEFAULT_DEMO_CUSTOMERS;
  } catch {
    return DEFAULT_DEMO_CUSTOMERS;
  }
}

function saveLocalCustomer(customer: Customer) {
  try {
    const existing = getLocalCustomers();
    const updated = [customer, ...existing.filter((c) => c.id !== customer.id)];
    localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
}

export interface CustomerFilters {
  search?: string;
  status?: ContentStatus;
  limit?: number;
}

export async function listCustomers(
  organizationId: string,
  filters: CustomerFilters = {},
): Promise<Customer[]> {
  const localCustomers = getLocalCustomers();
  const filterStatus = filters.status ?? 'active';

  // Si l'identifiant d'organisation n'est pas un UUID valide (ex: mode démo/local),
  // utiliser les données locales sans appeler Supabase (évite l'erreur Postgres 22P02)
  if (!isUUID(organizationId)) {
    return localCustomers
      .filter((c) => c.status === filterStatus)
      .filter((c) => {
        if (!filters.search?.trim()) return true;
        const term = filters.search.toLowerCase().trim();
        return (
          c.name.toLowerCase().includes(term) ||
          c.reference.toLowerCase().includes(term) ||
          (c.city !== null && c.city.toLowerCase().includes(term))
        );
      });
  }

  try {
    let query = supabase
      .from('customers')
      .select(CUSTOMER_SELECT)
      .eq('organization_id', organizationId);

    query = query.eq('status', filterStatus);

    if (filters.search) {
      const term = filters.search.replace(/[%,()]/g, ' ').trim();
      if (term !== '') {
        query = query.or(`name.ilike.%${term}%,reference.ilike.%${term}%,city.ilike.%${term}%`);
      }
    }

    const remoteCustomers = await unwrap(
      query.order('name', { ascending: true }).limit(filters.limit ?? 200).returns<Customer[]>(),
    );

    const remoteIds = new Set(remoteCustomers.map((c) => c.id));
    return [...remoteCustomers, ...localCustomers.filter((c) => !remoteIds.has(c.id) && c.status === filterStatus)];
  } catch {
    return localCustomers.filter((c) => c.status === filterStatus);
  }
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const local = getLocalCustomers().find((c) => c.id === customerId);
  if (!isUUID(customerId)) {
    return local ?? null;
  }

  try {
    const remote = await unwrapMaybe(supabase.from('customers').select('*').eq('id', customerId).single());
    return remote ?? local ?? null;
  } catch {
    return local ?? null;
  }
}

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
  const { data: userData } = await supabase.auth.getUser();

  if (!isUUID(input.organizationId)) {
    const localCustomers = getLocalCustomers();
    const nextNum = localCustomers.length + 1;
    const ref = `CLI-${String(nextNum).padStart(4, '0')}`;
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      organization_id: input.organizationId,
      reference: ref,
      name: input.name,
      legal_name: input.legalName ?? null,
      registration_number: null,
      vat_number: null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address_line1: input.addressLine1 ?? null,
      address_line2: null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      country: input.country ?? 'FR',
      notes: input.notes ?? null,
      status: 'active',
      created_by: userData?.user?.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalCustomer(newCustomer);
    return newCustomer;
  }

  if (!userData?.user) {
    throw new AppError('unauthenticated', 'Vous devez être connecté pour créer un client.');
  }

  try {
    const created = await unwrap(
      supabase
        .from('customers')
        .insert({
          organization_id: input.organizationId,
          name: input.name,
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
    saveLocalCustomer(created);
    return created;
  } catch {
    const localCustomers = getLocalCustomers();
    const nextNum = localCustomers.length + 1;
    const ref = `CLI-${String(nextNum).padStart(4, '0')}`;
    const fallbackCustomer: Customer = {
      id: `cust-${Date.now()}`,
      organization_id: input.organizationId,
      reference: ref,
      name: input.name,
      legal_name: input.legalName ?? null,
      registration_number: null,
      vat_number: null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address_line1: input.addressLine1 ?? null,
      address_line2: null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      country: input.country ?? 'FR',
      notes: input.notes ?? null,
      status: 'active',
      created_by: userData.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalCustomer(fallbackCustomer);
    return fallbackCustomer;
  }
}

export async function updateCustomer(
  customerId: string,
  patch: TablesUpdate<'customers'>,
): Promise<Customer> {
  if (!isUUID(customerId)) {
    const localCustomers = getLocalCustomers();
    const existing = localCustomers.find((c) => c.id === customerId);
    if (!existing) {
      throw new AppError('not_found', 'Client introuvable.');
    }
    const updated: Customer = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    saveLocalCustomer(updated);
    return updated;
  }

  try {
    const updated = await unwrap(
      supabase.from('customers').update(patch).eq('id', customerId).select('*').single(),
    );
    saveLocalCustomer(updated);
    return updated;
  } catch {
    const localCustomers = getLocalCustomers();
    const existing = localCustomers.find((c) => c.id === customerId);
    if (!existing) {
      throw new AppError('not_found', 'Client introuvable.');
    }
    const updated: Customer = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    saveLocalCustomer(updated);
    return updated;
  }
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

export async function deleteCustomer(customerId: string): Promise<void> {
  if (!isUUID(customerId)) {
    const localCustomers = getLocalCustomers();
    const updated = localCustomers.filter((c) => c.id !== customerId);
    try {
      localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
    return;
  }

  try {
    const { error } = await supabase.from('customers').delete().eq('id', customerId);
    if (error) throw error;
  } catch {
    const localCustomers = getLocalCustomers();
    const updated = localCustomers.filter((c) => c.id !== customerId);
    try {
      localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
}

// -----------------------------------------------------------------------------
// Contacts
// -----------------------------------------------------------------------------

const STORAGE_CONTACTS_KEY = 'nexoratech_local_contacts';

const DEFAULT_DEMO_CONTACTS: CustomerContact[] = [
  {
    id: 'contact-1',
    customer_id: 'cust-1',
    organization_id: 'org-demo',
    first_name: 'Jean-Marc',
    last_name: 'Desrosiers',
    role_label: 'Directeur des Infrastructures Optiques',
    email: 'jm.desrosiers@aethel-telecom.com',
    phone: '0696 12 34 56',
    is_primary: true,
    notes: 'Contact privilégié pour l’attribution des accès datacenters.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'contact-2',
    customer_id: 'cust-2',
    organization_id: 'org-demo',
    first_name: 'Sophie',
    last_name: 'Laval',
    role_label: 'Responsable Exploitation Réseau',
    email: 'sophie.laval@nexis-networks.io',
    phone: '0696 98 76 54',
    is_primary: true,
    notes: 'À contacter avant chaque intervention sur pylône radio.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function getLocalContacts(customerId?: string): CustomerContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_CONTACTS_KEY);
    let contacts: CustomerContact[] = DEFAULT_DEMO_CONTACTS;
    if (raw) {
      const parsed = JSON.parse(raw) as CustomerContact[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        contacts = parsed;
      }
    } else {
      localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(DEFAULT_DEMO_CONTACTS));
    }
    if (customerId) {
      return contacts.filter((c) => c.customer_id === customerId);
    }
    return contacts;
  } catch {
    return DEFAULT_DEMO_CONTACTS;
  }
}

function saveLocalContact(contact: CustomerContact) {
  try {
    const existing = getLocalContacts();
    const updated = [contact, ...existing.filter((c) => c.id !== contact.id)];
    localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
}

export async function listContacts(customerId: string): Promise<CustomerContact[]> {
  if (!isUUID(customerId)) {
    return getLocalContacts(customerId);
  }
  try {
    const remote = await unwrap(
      supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('last_name', { ascending: true }),
    );
    const local = getLocalContacts(customerId);
    const remoteIds = new Set(remote.map((c) => c.id));
    return [...remote, ...local.filter((c) => !remoteIds.has(c.id))];
  } catch {
    return getLocalContacts(customerId);
  }
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
  if (!isUUID(input.customerId) || !isUUID(input.organizationId)) {
    const newContact: CustomerContact = {
      id: `contact-${Date.now()}`,
      customer_id: input.customerId,
      organization_id: input.organizationId,
      first_name: input.firstName ?? null,
      last_name: input.lastName,
      role_label: input.roleLabel ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      is_primary: false,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalContact(newContact);
    return newContact;
  }

  try {
    const created = await unwrap(
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
    saveLocalContact(created);
    return created;
  } catch {
    const fallbackContact: CustomerContact = {
      id: `contact-${Date.now()}`,
      customer_id: input.customerId,
      organization_id: input.organizationId,
      first_name: input.firstName ?? null,
      last_name: input.lastName,
      role_label: input.roleLabel ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      is_primary: false,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalContact(fallbackContact);
    return fallbackContact;
  }
}

export async function updateContact(
  contactId: string,
  patch: TablesUpdate<'customer_contacts'>,
): Promise<CustomerContact> {
  if (!isUUID(contactId)) {
    const local = getLocalContacts().find((c) => c.id === contactId);
    const updated: CustomerContact = {
      id: contactId,
      customer_id: local?.customer_id ?? 'cust-1',
      organization_id: local?.organization_id ?? 'org-demo',
      first_name: patch.first_name ?? local?.first_name ?? null,
      last_name: patch.last_name ?? local?.last_name ?? 'Contact',
      role_label: patch.role_label ?? local?.role_label ?? null,
      email: patch.email ?? local?.email ?? null,
      phone: patch.phone ?? local?.phone ?? null,
      is_primary: patch.is_primary ?? local?.is_primary ?? false,
      notes: patch.notes ?? local?.notes ?? null,
      created_at: local?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalContact(updated);
    return updated;
  }
  try {
    const updated = await unwrap(
      supabase.from('customer_contacts').update(patch).eq('id', contactId).select('*').single(),
    );
    saveLocalContact(updated);
    return updated;
  } catch {
    const local = getLocalContacts().find((c) => c.id === contactId);
    const updated: CustomerContact = {
      id: contactId,
      customer_id: local?.customer_id ?? 'cust-1',
      organization_id: local?.organization_id ?? 'org-demo',
      first_name: patch.first_name ?? local?.first_name ?? null,
      last_name: patch.last_name ?? local?.last_name ?? 'Contact',
      role_label: patch.role_label ?? local?.role_label ?? null,
      email: patch.email ?? local?.email ?? null,
      phone: patch.phone ?? local?.phone ?? null,
      is_primary: patch.is_primary ?? local?.is_primary ?? false,
      notes: patch.notes ?? local?.notes ?? null,
      created_at: local?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalContact(updated);
    return updated;
  }
}

export async function deleteContact(contactId: string): Promise<void> {
  const localContacts = getLocalContacts();
  const updated = localContacts.filter((c) => c.id !== contactId);
  try {
    localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  if (!isUUID(contactId)) return;
  try {
    await supabase.from('customer_contacts').delete().eq('id', contactId);
  } catch {
    // Ignore
  }
}

export async function setPrimaryContact(
  customerId: string,
  contactId: string,
): Promise<CustomerContact> {
  if (!isUUID(customerId) || !isUUID(contactId)) {
    return updateContact(contactId, { is_primary: true });
  }

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

const STORAGE_SITES_KEY = 'nexoratech_local_sites';

const DEFAULT_DEMO_SITES: Site[] = [
  {
    id: 'site-1',
    customer_id: 'cust-1',
    organization_id: 'org-demo',
    name: 'Centre Datacenter Aethel',
    code: 'STE-001',
    address_line1: 'Immeuble Aethel Tower, Rue Becquerel',
    address_line2: null,
    postal_code: '97200',
    city: 'FORT-DE-FRANCE',
    country: 'FR',
    latitude: 14.6161,
    longitude: -61.0588,
    access_notes: 'Badging obligatoire au poste de garde principal.',
    contact_id: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'site-2',
    customer_id: 'cust-2',
    organization_id: 'org-demo',
    name: 'Pylône Radio Nexis P-42',
    code: 'STE-002',
    address_line1: 'Zone Technopole Nexis',
    address_line2: null,
    postal_code: '97232',
    city: 'LE LAMENTIN',
    country: 'FR',
    latitude: 14.6012,
    longitude: -60.9984,
    access_notes: 'Port du harnais et de la ligne de vie impératif.',
    contact_id: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'site-3',
    customer_id: 'cust-3',
    organization_id: 'org-demo',
    name: 'Centrale Solaire Voltaic Nord',
    code: 'STE-003',
    address_line1: 'Zone Industrielle Voltaic',
    address_line2: null,
    postal_code: '97232',
    city: 'LE LAMENTIN',
    country: 'FR',
    latitude: 14.6088,
    longitude: -60.9855,
    access_notes: 'Consignation haute tension HTA requise avant toute intervention.',
    contact_id: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function getLocalSites(customerId?: string): Site[] {
  try {
    const raw = localStorage.getItem(STORAGE_SITES_KEY);
    let sites: Site[] = DEFAULT_DEMO_SITES;
    if (raw) {
      const parsed = JSON.parse(raw) as Site[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        sites = parsed;
      }
    } else {
      localStorage.setItem(STORAGE_SITES_KEY, JSON.stringify(DEFAULT_DEMO_SITES));
    }
    if (customerId) {
      const filtered = sites.filter((s) => s.customer_id === customerId);
      if (filtered.length > 0) return filtered;
      
      // Si c'est un client créé localement sans site attribué, générer un site principal automatique
      const autoSite: Site = {
        id: `site-auto-${customerId}`,
        customer_id: customerId,
        organization_id: 'org-demo',
        name: 'Site Principal d’Intervention',
        code: `STE-${customerId.slice(-4).toUpperCase()}`,
        address_line1: 'Adresse du site d’exploitation',
        address_line2: null,
        postal_code: '97200',
        city: 'FORT-DE-FRANCE',
        country: 'FR',
        latitude: null,
        longitude: null,
        access_notes: 'Informations et consignes d’accès au site.',
        contact_id: null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return [autoSite];
    }
    return sites;
  } catch {
    return DEFAULT_DEMO_SITES;
  }
}

function saveLocalSite(site: Site) {
  try {
    const existing = getLocalSites();
    const updated = [site, ...existing.filter((s) => s.id !== site.id)];
    localStorage.setItem(STORAGE_SITES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
}

export async function listSites(customerId: string): Promise<Site[]> {
  if (!isUUID(customerId)) return getLocalSites(customerId);
  try {
    const remote = await unwrap(
      supabase
        .from('sites')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .order('name', { ascending: true }),
    );
    return remote.length > 0 ? remote : getLocalSites(customerId);
  } catch {
    return getLocalSites(customerId);
  }
}

/** Sites de l'organisation entière — alimente le sélecteur du formulaire de mission. */
export async function listOrganizationSites(organizationId: string): Promise<Site[]> {
  if (!isUUID(organizationId)) return getLocalSites();
  try {
    const remote = await unwrap(
      supabase
        .from('sites')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('name', { ascending: true }),
    );
    return remote.length > 0 ? remote : getLocalSites();
  } catch {
    return getLocalSites();
  }
}

export async function getSite(siteId: string): Promise<Site | null> {
  const local = getLocalSites().find((s) => s.id === siteId);
  if (!isUUID(siteId)) return local ?? null;
  try {
    const remote = await unwrapMaybe(supabase.from('sites').select('*').eq('id', siteId).single());
    return remote ?? local ?? null;
  } catch {
    return local ?? null;
  }
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
  if (!isUUID(input.customerId) || !isUUID(input.organizationId)) {
    const newSite: Site = {
      id: `site-${Date.now()}`,
      customer_id: input.customerId,
      organization_id: input.organizationId,
      name: input.name,
      code: input.code ?? null,
      address_line1: input.addressLine1 ?? null,
      address_line2: null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      country: input.country ?? 'FR',
      latitude: null,
      longitude: null,
      access_notes: input.accessNotes ?? null,
      contact_id: input.contactId ?? null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalSite(newSite);
    return newSite;
  }

  try {
    const created = await unwrap(
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
          ...(input.accessNotes !== undefined ? { access_notes: input.accessNotes } : {}),
          ...(input.contactId !== undefined ? { contact_id: input.contactId } : {}),
        })
        .select('*')
        .single(),
    );
    saveLocalSite(created);
    return created;
  } catch {
    const fallbackSite: Site = {
      id: `site-${Date.now()}`,
      customer_id: input.customerId,
      organization_id: input.organizationId,
      name: input.name,
      code: input.code ?? null,
      address_line1: input.addressLine1 ?? null,
      address_line2: null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      country: input.country ?? 'FR',
      latitude: null,
      longitude: null,
      access_notes: input.accessNotes ?? null,
      contact_id: input.contactId ?? null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalSite(fallbackSite);
    return fallbackSite;
  }
}

export async function updateSite(siteId: string, patch: TablesUpdate<'sites'>): Promise<Site> {
  if (!isUUID(siteId)) {
    return {
      id: siteId,
      customer_id: 'cust-1',
      organization_id: 'org-demo',
      name: patch.name ?? 'Site',
      code: patch.code ?? null,
      address_line1: patch.address_line1 ?? null,
      address_line2: patch.address_line2 ?? null,
      postal_code: patch.postal_code ?? null,
      city: patch.city ?? null,
      country: patch.country ?? 'FR',
      latitude: patch.latitude ?? null,
      longitude: patch.longitude ?? null,
      access_notes: patch.access_notes ?? null,
      contact_id: patch.contact_id ?? null,
      status: patch.status ?? 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return unwrap(supabase.from('sites').update(patch).eq('id', siteId).select('*').single());
}

export async function archiveSite(siteId: string): Promise<Site> {
  return updateSite(siteId, { status: 'archived' });
}

// -----------------------------------------------------------------------------
// Historique
// -----------------------------------------------------------------------------

export async function listCustomerMissions(
  customerId: string,
  limit = 50,
): Promise<MissionWithRelations[]> {
  if (!isUUID(customerId)) return [];
  try {
    return await unwrap(
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
  } catch {
    return [];
  }
}
