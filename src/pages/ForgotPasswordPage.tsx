import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormError } from '@/components/feedback/FormError';
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from '@/features/auth/schemas/auth.schema';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await resetPassword(values.email);
      setSent(true);
    } catch (error) {
      setSubmitError(error);
    }
  });

  if (sent) {
    return (
      <AuthCard title="E-mail envoyé" description="Si un compte existe, vous recevrez un lien.">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <MailCheck className="text-success size-10" aria-hidden="true" />
          {/* Formulation neutre volontaire : confirmer l'existence d'un compte
              permettrait d'énumérer les adresses inscrites. */}
          <p className="text-muted-foreground text-sm">
            Consultez votre boîte mail et suivez le lien pour définir un nouveau mot de passe.
            Pensez à vérifier vos courriers indésirables.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to={ROUTES.login}>Retour à la connexion</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez votre adresse, nous vous enverrons un lien de réinitialisation."
      footer={
        <Link to={ROUTES.login} className="text-primary font-medium hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <FormError error={submitError} />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          required
          {...(errors.email?.message ? { error: errors.email.message } : {})}
          {...register('email')}
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Envoyer le lien
        </Button>
      </form>
    </AuthCard>
  );
}
