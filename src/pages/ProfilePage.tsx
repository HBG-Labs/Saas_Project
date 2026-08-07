import { PagePlaceholder } from '@/components/feedback/PagePlaceholder';

export default function ProfilePage() {
  return (
    <PagePlaceholder
      title="Profil"
      description="La table `profiles` est alimentée automatiquement à l'inscription par un trigger, et n'est lisible que par son propriétaire."
      plannedFor="Phase 2"
    />
  );
}
