import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Eye, EyeOff, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { type PlanId, PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { registerSchema, type RegisterValues } from '@/features/auth/schemas/auth.schema';

export default function RegisterPage() {
  const { signInWithGoogle, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan') as PlanId | null;

  const initialPlan = PRICING_PLANS.find((p) => p.id === planParam)?.id ?? 'free';
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(initialPlan);

  const [submitError, setSubmitError] = useState<unknown>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  const activePlanInfo = PRICING_PLANS.find((p) => p.id === selectedPlan) ?? PRICING_PLANS[0]!;

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
      await signUp(values.email, values.password, values.displayName);
      setEmailSent(true);
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
      description={
        activePlanInfo.priceMonthly === 0
          ? 'Gratuit à vie. Accédez à vos outils techniques et calculs certifiés.'
          : `Rejoignez REZO360 avec la formule ${activePlanInfo.name} pour équiper votre entreprise.`
      }
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to={ROUTES.login} className="text-primary font-medium hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {/* Sélecteur de formule */}
        <div className="space-y-2">
          {/* Intitulé de GROUPE, pas d'un contrôle : le choix se fait sur des
              cartes cliquables, et il contient lui-même un lien. Un `<label>`
              promettrait une association qui n'existe pas — et rendrait le lien
              inatteignable au clavier dans certains lecteurs d'écran. */}
          <div className="text-foreground flex items-center justify-between text-xs font-semibold">
            <span>Choisissez votre formule :</span>
            <Link to={ROUTES.pricing} className="text-primary text-3xs font-normal hover:underline">
              Voir le comparatif ↗
            </Link>
          </div>

          {/* L'essai était accordé par `app.start_organization_trial` sans que
              rien ne l'annonce. Un avantage que le visiteur ignore ne le
              décide pas — et il découvrait une échéance dont on ne lui avait
              jamais parlé. */}
          {/* Message explicatif dynamique selon la formule sélectionnée */}
          {activePlanInfo.priceMonthly === 0 ? (
            <p className="text-2xs text-muted-foreground">
              La formule <strong className="text-foreground">Free</strong> est 100% gratuite à vie,
              sans carte bancaire. Vous accédez immédiatement aux calculateurs et outils techniques.
            </p>
          ) : (
            <p className="text-2xs text-muted-foreground">
              <strong className="text-foreground">14 jours d’essai offerts</strong> sur la formule{' '}
              {activePlanInfo.name} (0 € débité aujourd’hui, carte bancaire requise pour valider
              l’accès). Annulable à tout moment.
            </p>
          )}

          <div className="bg-surface-sunken border-border/80 grid grid-cols-2 gap-1.5 rounded-xl border p-1 sm:grid-cols-5">
            {PRICING_PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                      : 'bg-surface/50 border-border/40 text-muted-foreground hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-2xs font-semibold">{plan.name}</span>
                    {plan.popular ? (
                      <span className="text-3xs text-warning font-black">★</span>
                    ) : null}
                  </div>
                  <span
                    className={`font-mono text-xs font-extrabold tracking-tight tabular-nums ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}
                  >
                    {plan.priceMonthly === 0 ? 'Gratuit' : `${plan.priceMonthly}€/m`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Récapitulatif dynamique de la formule choisie */}
          <div className="border-border/80 bg-surface/60 text-2xs space-y-1 rounded-xl border p-2.5">
            <div className="flex items-center justify-between">
              <div className="text-foreground flex items-center gap-1.5 font-bold">
                <Sparkles className="text-primary size-3" />
                <span>Formule {activePlanInfo.name}</span>
                {activePlanInfo.popular ? (
                  <Badge variant="primary" className="text-3xs px-1 py-0">
                    Recommandé
                  </Badge>
                ) : null}
              </div>
              <span className="text-foreground font-mono font-bold">
                {activePlanInfo.priceMonthly === 0
                  ? '0 €'
                  : `${activePlanInfo.priceMonthly} € / mois`}
              </span>
            </div>
            <p className="text-muted-foreground flex items-center gap-1 leading-relaxed">
              <Users className="text-muted-foreground size-3 shrink-0" />
              <span>
                {activePlanInfo.includedUsers} utilisateur
                {activePlanInfo.includedUsers > 1 ? 's inclus' : ' inclus'}
                {activePlanInfo.additionalUserPriceMonthly > 0
                  ? ' (+5 €/user supp.)'
                  : ' (monocompte strict)'}
                .
              </span>
            </p>
          </div>
        </div>

        <FormError error={submitError} />

        <GoogleAuthButton
          isLoading={isGoogleSubmitting}
          disabled={isSubmitting}
          onClick={() => void onGoogleSignIn()}
        />

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="bg-border h-px flex-1" />
          <span className="text-3xs text-muted-foreground font-medium">
            ou s’inscrire avec une adresse e-mail
          </span>
          <span className="bg-border h-px flex-1" />
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4 pt-1">
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
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            hint="8 caractères minimum. Privilégiez une phrase longue à une suite de symboles."
            {...(errors.password?.message ? { error: errors.password.message } : {})}
            {...register('password')}
            trailingSlot={
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="size-touch text-subtle-foreground hover:text-foreground flex items-center justify-center rounded transition-colors sm:size-7"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            }
          />

          <Input
            label="Confirmer le mot de passe"
            type={showPasswordConfirmation ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            {...(errors.confirmPassword?.message ? { error: errors.confirmPassword.message } : {})}
            {...register('confirmPassword')}
            trailingSlot={
              <button
                type="button"
                onClick={() => setShowPasswordConfirmation((visible) => !visible)}
                aria-label={
                  showPasswordConfirmation
                    ? 'Masquer la confirmation du mot de passe'
                    : 'Afficher la confirmation du mot de passe'
                }
                className="size-touch text-subtle-foreground hover:text-foreground flex items-center justify-center rounded transition-colors sm:size-7"
              >
                {showPasswordConfirmation ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            }
          />

          <Button
            type="submit"
            size="lg"
            className="w-full font-bold"
            isLoading={isSubmitting}
            disabled={isGoogleSubmitting}
          >
            {activePlanInfo.priceMonthly === 0
              ? 'Créer mon compte gratuit'
              : `Démarrer mon essai ${activePlanInfo.name} (0 €)`}
          </Button>

          <p className="text-3xs text-muted-foreground text-center">
            {activePlanInfo.priceMonthly === 0
              ? 'Compte gratuit sans carte bancaire. Vos outils et calculs sont accessibles immédiatement.'
              : `14 jours d’essai offerts sur la formule ${activePlanInfo.name}. Vous validerez votre empreinte bancaire sans débit après confirmation de votre e-mail.`}
          </p>
        </form>
      </div>
    </AuthCard>
  );
}
