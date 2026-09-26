import { CalendarDays } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/Badge';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { SocialStudioWeekPlanner, currentWeekStartsOn } from '@/features/social';

export default function SocialStudioPage() {
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const startsOn = currentWeekStartsOn();

  if (!organization) return null;

  return (
    <PageShell width="7xl">
      <PageHeader
        title="Social Studio"
        description="Préparez la semaine Instagram de REZO360 en 7 publications image, puis validez-la avant programmation."
        actions={
          <Badge variant="info" size="button">
            <CalendarDays className="size-3" aria-hidden="true" />
            Ma semaine
          </Badge>
        }
      />

      <SocialStudioWeekPlanner
        organizationId={organization.id}
        startsOn={startsOn}
        canManage={can(PERMISSIONS.socialManage)}
        canPublish={can(PERMISSIONS.socialPublish)}
      />
    </PageShell>
  );
}
