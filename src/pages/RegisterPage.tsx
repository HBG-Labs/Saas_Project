import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormError } from '@/features/auth/components/FormError';
import { registerSchema, type RegisterValues } from '@/features/auth/schemas/auth.schema';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signUp(values.email, values.password);
      setEmailSent(true);
    } catch (error) {
      setSubmitError(error);
    }
  });

  // Supabase envoie un lien de confirmation : on ne redirige pas vers le
  // tableau de bord, la session n'est pas encore active.
  if (emailSent) {
    return (
      <AuthCard
        title="Vérifiez votre boîte mail"
        description="Un lien de confirmation vous a été envoyé."
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CheckCircle2 className="text-success size-10" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">
            Cliquez sur le lien reçu pour activer votre compte, puis revenez vous connecter.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to={ROUTES.login}>Aller à la connexion</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Créer un compte"
      description="Gratuit. Vos favoris et votre historique vous suivent partout."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to={ROUTES.login} className="text-primary font-medium hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <FormError error={submitError} />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label="Nom affiché"
          autoComplete="name"
          placeholder="Jean Dupont"
          required
          {...(errors.displayName?.message ? { error: errors.displayName.message } : {})}
          {...register('displayName')}
        />

        <Input
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          required
          {...(errors.email?.message ? { error: errors.email.message } : {})}
          {...register('email')}
        />

        <Input
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          hint="8 caractères minimum. Privilégiez une phrase longue à une suite de symboles."
          {...(errors.password?.message ? { error: errors.password.message } : {})}
          {...register('password')}
        />

        <Input
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          {...(errors.confirmPassword?.message ? { error: errors.confirmPassword.message } : {})}
          {...register('confirmPassword')}
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Créer mon compte
        </Button>
      </form>
    </AuthCard>
  );
}
