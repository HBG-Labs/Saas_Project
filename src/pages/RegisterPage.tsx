import { PagePlaceholder } from '@/components/feedback/PagePlaceholder';

export default function RegisterPage() {
  return (
    <PagePlaceholder
      title="Créer un compte"
      description="L'inscription s'appuiera sur Supabase Auth et créera automatiquement le profil associé via un trigger Postgres."
      plannedFor="Phase 2"
    />
  );
}
