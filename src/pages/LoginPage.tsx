import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { FormError } from '@/components/feedback/FormError';
import { loginSchema, type LoginValues } from '@/features/auth/schemas/auth.schema';

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signIn(values.email, values.password);
      // Retour à la page initialement demandée, déposée par ProtectedRoute.
      const from = (location.state as { from?: string } | null)?.from;
      await navigate(from ?? ROUTES.dashboard, { replace: true });
    } catch (error) {
      setSubmitError(error);
    }
  });

  const onGoogleSignIn = async () => {
    setSubmitError(null);
    setIsGoogleSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Connexion"
      description="Accédez à vos outils, favoris et historique."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to={ROUTES.register} className="text-primary font-medium hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <FormError error={submitError} />

      <div className="space-y-4">
        <GoogleAuthButton
          isLoading={isGoogleSubmitting}
          disabled={isSubmitting}
          onClick={() => void onGoogleSignIn()}
        />

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="bg-border h-px flex-1" />
          <span className="text-3xs text-muted-foreground font-medium">
            ou se connecter avec une adresse e-mail
          </span>
          <span className="bg-border h-px flex-1" />
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        <Input
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          required
          {...(errors.email?.message ? { error: errors.email.message } : {})}
          {...register('email')}
        />

        <div>
          <Input
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            {...(errors.password?.message ? { error: errors.password.message } : {})}
            {...register('password')}
            trailingSlot={
              <button
                type="button"
                onClick={() => {
                  setShowPassword((visible) => !visible);
                }}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                // 28 px : le pouce visait l'œil et sélectionnait le champ.
                className="text-subtle-foreground hover:text-foreground size-touch flex items-center justify-center rounded transition-colors sm:size-7"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            }
          />
          <div className="mt-1.5 text-right">
            <Link
              to={ROUTES.forgotPassword}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          isLoading={isSubmitting}
          disabled={isGoogleSubmitting}
        >
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}
