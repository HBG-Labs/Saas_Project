import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';
import { updatePassword, useAuth } from '@/features/auth';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/schemas/auth.schema';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function ResetPasswordPage() {
  useDocumentTitle('Nouveau mot de passe');

  const { signOut, status } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [updated, setUpdated] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setSubmitError(null);

    try {
      await updatePassword(password);
      setUpdated(true);

      // Le jeton de récupération a rempli son rôle. Fermer la session évite
      // qu'un appareil partagé reste connecté après le changement.
      await signOut();
    } catch (error) {
      setSubmitError(error);
    }
  });

  if (status === 'loading') {
    return <LoadingScreen label="Validation du lien de récupération…" />;
  }

  if (updated) {
    return (
      <AuthCard
        title="Mot de passe modifié"
        description="Votre nouveau mot de passe est maintenant actif."
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CheckCircle2 className="text-success size-10" aria-hidden="true" />
          <Button asChild variant="primary" className="w-full">
            <Link to={ROUTES.login}>Se connecter</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (status !== 'authenticated') {
    return (
      <AuthCard
        title="Lien invalide ou expiré"
        description="Aucune session de récupération n’a pu être ouverte depuis ce lien."
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <KeyRound className="text-muted-foreground size-10" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">
            Demandez un nouveau lien. Pour votre sécurité, chaque lien est temporaire et ne peut
            servir qu’une fois.
          </p>
          <Button asChild variant="primary" className="w-full">
            <Link to={ROUTES.forgotPassword}>Demander un nouveau lien</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choisissez un nouveau mot de passe"
      description="Saisissez-le deux fois pour éviter toute erreur."
    >
      <FormError error={submitError} />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          {...(errors.password?.message ? { error: errors.password.message } : {})}
          {...register('password')}
        />
        <Input
          label="Confirmer le nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          {...(errors.confirmPassword?.message ? { error: errors.confirmPassword.message } : {})}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Enregistrer le nouveau mot de passe
        </Button>
      </form>
    </AuthCard>
  );
}
