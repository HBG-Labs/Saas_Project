import { OwnerDashboard } from '@/components/dashboard/OwnerDashboard';
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { TechnicianDashboard } from '@/components/dashboard/TechnicianDashboard';
import { usePermission } from '@/features/organizations';

export default function DashboardPage() {
  const { role } = usePermission();

  if (role === 'owner' || role === 'admin') {
    return <OwnerDashboard />;
  }

  if (role === 'manager' || role === 'team_leader') {
    return <ManagerDashboard />;
  }

  return <TechnicianDashboard />;
}
