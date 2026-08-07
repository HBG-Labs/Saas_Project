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
import { FormError } from '@/features/auth/components/FormError';
import { loginSchema, type LoginValues } from '@/features/auth/schemas/auth.schema';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [showPassword, setShowPassword] = useState(false);

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
                className="text-subtle-foreground hover:text-foreground flex size-7 items-center justify-center rounded transition-colors"
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

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}
