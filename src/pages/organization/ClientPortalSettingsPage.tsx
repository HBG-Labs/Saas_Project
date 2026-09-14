import { PageHeader } from '@/components/layout/PageHeader';
import { PortalSettingsCard } from '@/features/client-portal';
import { OrganizationNavTabs } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Réglages du portail client. La route est gardée par la formule
 * (`client_portal`) et la permission `client_portal.manage` ; les policies
 * rejugent chaque écriture.
 */
export default function ClientPortalSettingsPage() {
  useDocumentTitle('Portail client');

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <PageHeader
        title="Portail client"
        description="Contrôlez l'accès, l'identité affichée et les échanges proposés à vos clients."
      />
      <OrganizationNavTabs />
      <PortalSettingsCard />
    </div>
  );
}
