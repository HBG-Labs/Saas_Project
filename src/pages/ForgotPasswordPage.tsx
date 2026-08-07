import { PagePlaceholder } from '@/components/feedback/PagePlaceholder';

export default function ForgotPasswordPage() {
  return (
    <PagePlaceholder
      title="Mot de passe oublié"
      description="La demande de réinitialisation enverra un lien e-mail redirigeant vers /auth/callback."
      plannedFor="Phase 2"
    />
  );
}
