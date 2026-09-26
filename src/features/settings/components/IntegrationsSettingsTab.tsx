import { InstagramIntegrationCard } from '@/features/social';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';

export function IntegrationsSettingsTab() {
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();

  if (!organization) {
    return (
      <p className="text-muted-foreground text-sm">
        Sélectionnez une organisation pour gérer ses intégrations.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <InstagramIntegrationCard
        organizationId={organization.id}
        canManage={can(PERMISSIONS.socialPublish)}
      />
    </div>
  );
}
