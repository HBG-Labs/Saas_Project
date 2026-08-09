/**
 * API publique de la feature « customers ».
 *
 * Les autres features et les pages importent depuis ce point d'entrée, jamais
 * depuis un fichier interne : la règle ESLint `no-restricted-imports` l'impose.
 */
export {
  archiveCustomer,
  archiveSite,
  createContact,
  createCustomer,
  createSite,
  deleteContact,
  getCustomer,
  getSite,
  listContacts,
  listCustomerMissions,
  listCustomers,
  listOrganizationSites,
  listSites,
  restoreCustomer,
  setPrimaryContact,
  updateContact,
  updateCustomer,
  updateSite,
  type CustomerFilters,
} from './api/customers.api';

export {
  useArchiveCustomer,
  useCreateCustomer,
  useCustomer,
  useCustomerHistory,
  useCustomers,
  useRestoreCustomer,
  useUpdateCustomer,
} from './hooks/useCustomers';

export {
  useArchiveSite,
  useCreateContact,
  useCreateSite,
  useCustomerContacts,
  useCustomerSites,
  useDeleteContact,
  useOrganizationSites,
  useSetPrimaryContact,
  useUpdateContact,
  useUpdateSite,
} from './hooks/useCustomerChildren';

export { ContactsPanel } from './components/ContactsPanel';
export { CustomerFormDialog } from './components/CustomerFormDialog';
export { CustomerPicker, SitePicker } from './components/CustomerSitePicker';
export { SitesPanel } from './components/SitesPanel';

export {
  contactSchema,
  customerSchema,
  siteSchema,
  type ContactValues,
  type CustomerValues,
  type SiteValues,
} from './schemas/customer.schema';
