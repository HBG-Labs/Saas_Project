import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { type PlanId, PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { registerSchema, type RegisterValues } from '@/features/auth/schemas/auth.schema';
import { trackInscription } from '@/lib/meta-pixel';

export default function RegisterPage() {
  const { signInWithGoogle, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan') as PlanId | null;

  const initialPlan = PRICING_PLANS.find((p) => p.id === planParam)?.id ?? 'free';
  const planVise: PlanId = initialPlan;

  const [submitError, setSubmitError] = useState<unknown>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  const activePlanInfo = PRICING_PLANS.find((p) => p.id === planVise) ?? PRICING_PLANS[0]!;
  const viseUnePayante = activePlanInfo.priceMonthly > 0;

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
      const { sessionOuverte } = await signUp(values.email, values.password, values.displayName);
      /*
        Dans le gestionnaire, pas dans un effet.

        Un effet déclenché sur `emailSent` compterait deux inscriptions pour
        une seule sous `StrictMode`, et une de plus à chaque remontage du
        composant. Ici, le code ne s'exécute qu'une fois par soumission
        réussie — et jamais si `signUp` a levé, puisque nous ne serions pas
        sur cette ligne.
      */
      trackInscription();

      /*
        ON N'ANNONCE UN E-MAIL QUE S'IL EST RÉELLEMENT ATTENDU.

        Quand le projet Supabase n'exige pas la confirmation, `signUp` ouvre
        une session sur-le-champ. Il n'y a alors rien à aller vérifier, et
        `PublicOnlyRoute` renvoie déjà l'utilisateur connecté vers son tableau
        de bord — aucune navigation à écrire ici.

        Afficher malgré tout « Vérifiez votre boîte mail » enverrait la
        personne chercher un message dont elle n'a pas besoin, alors qu'elle
        est déjà entrée. C'est exactement le mur qu'on vient de retirer.
      */
      if (!sessionOuverte) {
        setEmailSent(true);
      }
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
        {/*
          LE CHOIX DE FORMULE A QUITTÉ CE FORMULAIRE.

          Il ne décidait rien. `selectedPlan` n'était jamais transmis à
          `signUp` : quelle que soit la carte cliquée, le compte créé était
          exactement le même. Le visiteur arbitrait donc entre cinq offres au
          moment le plus coûteux du tunnel — juste avant de valider — pour un
          choix qui ne tenait pas au-delà de l'écran.

          Ce qui subsiste est un RAPPEL, pas une décision : la formule visée
          quand on arrive depuis la page des tarifs (`?plan=`), et le fait que
          l'inscription elle-même ne coûte rien. Le vrai choix se fait dans le
          produit, une fois qu'on a vu à quoi il ressemble — c'est-à-dire au
          moment où l'on peut le faire en connaissance de cause.
        */}
        <div className="border-border/80 bg-surface/60 space-y-1.5 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground flex items-center gap-1.5 text-xs font-bold">
              <Sparkles className="text-primary size-3.5" aria-hidden="true" />
              Inscription gratuite
            </span>
            <Link to={ROUTES.pricing} className="text-primary text-3xs font-normal hover:underline">
              Voir les formules ↗
            </Link>
          </div>
          <p className="text-2xs text-muted-foreground leading-relaxed">
            {viseUnePayante ? (
              <>
                Vous pourrez activer la formule{' '}
                <strong className="text-foreground">{activePlanInfo.name}</strong> et ses 14 jours
                d’essai depuis votre espace. Aucun paiement à cette étape.
              </>
            ) : (
              <>
                Aucune carte bancaire demandée. Vous entrez immédiatement dans votre espace, et
                choisirez une formule plus tard si vous en avez besoin.
              </>
            )}
          </p>
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
            {/*
              UN SEUL LIBELLE, PARCE QU'IL N'Y A QU'UNE SEULE ACTION.

              Le bouton annoncait « Démarrer mon essai Pro (0 €) » quand une
              formule payante etait selectionnee. C'etait faux a deux titres :
              aucun essai ne demarrait a cet instant, et la formule choisie
              n'etait meme pas transmise. Promettre un acte que le clic
              n'accomplit pas est le plus sur moyen de perdre la confiance
              gagnee sur la page precedente.
            */}
            Créer mon compte gratuit
          </Button>

          <p className="text-3xs text-muted-foreground text-center">
            {/*
              La mention « après confirmation de votre e-mail » decrivait un
              parcours qui n'existe plus : l'acces est desormais immediat, et
              la confirmation n'est exigee qu'avant d'inviter un collegue ou
              de souscrire. Voir `features/auth/email-confirmation.ts`.
            */}
            Sans carte bancaire. Vous entrez dans votre espace immédiatement.
          </p>
        </form>
      </div>
    </AuthCard>
  );
}
