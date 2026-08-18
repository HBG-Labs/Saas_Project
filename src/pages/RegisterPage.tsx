import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Sparkles, Users } from 'lucide-react';
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
import { registerSchema, type RegisterValues } from '@/features/auth/schemas/auth.schema';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan') as PlanId | null;

  const initialPlan = PRICING_PLANS.find((p) => p.id === planParam)?.id ?? 'free';
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(initialPlan);

  const [submitError, setSubmitError] = useState<unknown>(null);
  const [emailSent, setEmailSent] = useState(false);

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
      description={
        activePlanInfo.priceMonthly === 0
          ? 'Gratuit à vie. Accédez à vos outils techniques et calculs certifiés.'
          : `Rejoignez NexoraTech avec la formule ${activePlanInfo.name} pour équiper votre entreprise.`
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
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Choisissez votre formule :</span>
            <Link to={ROUTES.pricing} className="text-primary text-3xs hover:underline font-normal">
              Voir le comparatif ↗
            </Link>
          </div>

          {/* L'essai était accordé par `app.start_organization_trial` sans que
              rien ne l'annonce. Un avantage que le visiteur ignore ne le
              décide pas — et il découvrait une échéance dont on ne lui avait
              jamais parlé. */}
          <p className="text-2xs text-muted-foreground">
            Quatorze jours d’essai gratuit sur les formules payantes, sans carte bancaire. À
            l’échéance, l’entreprise revient en formule Gratuite : vos données sont conservées,
            seuls les modules métier se referment.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-xl bg-surface-sunken border border-border/80">
            {PRICING_PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                      : 'bg-surface/50 border-border/40 text-muted-foreground hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-2xs font-semibold">{plan.name}</span>
                    {plan.popular ? (
                      <span className="text-3xs text-amber-300 font-black">★</span>
                    ) : null}
                  </div>
                  <span className={`text-xs font-mono font-extrabold tabular-nums tracking-tight ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {plan.priceMonthly === 0 ? 'Gratuit' : `${plan.priceMonthly}€/m`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Récapitulatif dynamique de la formule choisie */}
          <div className="rounded-xl border border-border/80 bg-surface/60 p-2.5 text-2xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Sparkles className="size-3 text-primary" />
                <span>Formule {activePlanInfo.name}</span>
                {activePlanInfo.popular ? (
                  <Badge variant="primary" className="text-3xs py-0 px-1">
                    Recommandé
                  </Badge>
                ) : null}
              </div>
              <span className="font-mono font-bold text-foreground">
                {activePlanInfo.priceMonthly === 0 ? '0 €' : `${activePlanInfo.priceMonthly} € / mois`}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed flex items-center gap-1">
              <Users className="size-3 shrink-0 text-muted-foreground" />
              <span>
                {activePlanInfo.includedUsers} utilisateur{activePlanInfo.includedUsers > 1 ? 's inclus' : ' inclus'}
                {activePlanInfo.additionalUserPriceMonthly > 0 ? ' (+5 €/user supp.)' : ' (monocompte strict)'}.
              </span>
            </p>
          </div>
        </div>

        <FormError error={submitError} />

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

          <Button type="submit" size="lg" className="w-full font-bold" isLoading={isSubmitting}>
            {activePlanInfo.priceMonthly === 0
              ? 'Créer mon compte gratuit'
              : `Démarrer avec ${activePlanInfo.name}`}
          </Button>

          <p className="text-center text-3xs text-muted-foreground">
            {activePlanInfo.priceMonthly === 0
              ? 'Compte gratuit sans carte bancaire. Vos outils et calculs sont accessibles immédiatement.'
              : 'Aucun paiement requis immédiatement. Vous configurerez votre abonnement après validation de votre e-mail.'}
          </p>
        </form>
      </div>
    </AuthCard>
  );
}
