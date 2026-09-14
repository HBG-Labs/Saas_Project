import { ArrowRight, Building2, Mail, MailWarning, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { FormError } from '@/components/feedback/FormError';
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  useAcceptInvitation,
  useAcceptInvitationWithSignup,
  useInvitationPreview,
} from '@/features/organizations';
import { Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function AcceptInvitationPage() {
  useDocumentTitle('Invitation');

  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const preview = useInvitationPreview(token);
  const acceptInvitation = useAcceptInvitation();
  const rejoindre = useAcceptInvitationWithSignup();
  const [motDePasse, setMotDePasse] = useState('');
  const [submitError, setSubmitError] = useState<unknown>(null);

  if (preview.isPending) {
    return <LoadingScreen label="Vérification de l’invitation…" />;
  }

  /**
   * Un jeton inconnu, révoqué, déjà accepté ou expiré renvoie tous quatre zéro
   * ligne : le serveur ne les distingue pas, et c'est délibéré — distinguer
   * « expirée » de « inexistante » confirmerait l'existence d'une invitation à
   * qui essaierait des jetons au hasard.
   *
   * Le message couvre donc les quatre cas sans mentir sur aucun.
   */
  if (preview.isError || preview.data === null || preview.data === undefined) {
    return (
      <div className="mx-auto max-w-md py-12">
        <EmptyState
          icon={MailWarning}
          title="Cette invitation n’est plus valable"
          description="Le lien est peut-être expiré, déjà utilisé, ou révoqué. Demandez une nouvelle invitation à la personne qui vous a contacté."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={ROUTES.dashboard}>Retour au tableau de bord</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const invitation = preview.data;

  const accept = async () => {
    if (token === undefined) return;

    setSubmitError(null);
    try {
      await acceptInvitation.mutateAsync(token);
      await navigate(ROUTES.dashboard);
    } catch (error) {
      // L'erreur la plus fréquente : l'adresse du compte connecté ne correspond
      // pas à celle invitée. `accept_organization_invitation` la refuse, et le
      // message traduit doit le dire — masquer ce refus laisserait l'utilisateur
      // réessayer indéfiniment.
      setSubmitError(error);
    }
  };

  return (
    <div className="mx-auto max-w-md py-8 sm:py-12">
      <Card className="overflow-hidden">
        <div className="from-primary/[0.12] via-primary/[0.05] to-surface border-border relative flex justify-center border-b bg-gradient-to-br px-6 py-7">
          <div className="bg-primary text-primary-foreground ring-surface shadow-raised flex size-14 items-center justify-center rounded-2xl ring-4">
            <Building2 className="size-6" aria-hidden="true" />
          </div>
        </div>

        <CardContent className="space-y-5 pt-5 text-center sm:pt-6">
          <div className="space-y-1">
            <h1 className="text-foreground text-xl font-semibold">
              Rejoindre {invitation.organizationName}
            </h1>
            <Badge variant="primary" className="mt-2">
              {ROLE_LABELS[invitation.role]}
            </Badge>
            <p className="text-subtle-foreground text-xs">{ROLE_DESCRIPTIONS[invitation.role]}</p>
          </div>

          <FormError error={submitError} />

          {/*
            DEUX SITUATIONS, ET LA SECONDE EST LA PLUS COURANTE. Cette page
            s'adresse d'abord à quelqu'un qui n'a pas encore de compte — c'est
            la définition même d'une invitation. Lui montrer un bouton
            « Accepter » qu'il ne peut pas utiliser, ou le renvoyer à la
            connexion sans explication, était le défaut d'origine.
          */}
          {user === null ? (
            <form
              className="space-y-3 text-left"
              onSubmit={(e) => {
                e.preventDefault();
                if (token === undefined) return;
                setSubmitError(null);
                rejoindre.mutate(
                  { token, password: motDePasse },
                  {
                    onSuccess: () => {
                      void navigate(ROUTES.dashboard);
                    },
                    onError: setSubmitError,
                  },
                );
              }}
            >
              {/*
                UN SEUL CHAMP, ET AUCUN CHOIX DE FORMULE. L'invité rejoint une
                entreprise qui a déjà la sienne : le tunnel d'inscription
                générique lui faisait choisir un abonnement qu'il ne paiera
                jamais, confirmer son adresse, se reconnecter, puis revenir sur
                ce lien. Six étapes pour une décision qui n'était pas la sienne.

                L'adresse est imposée et non modifiable : c'est celle qui a reçu
                l'invitation, et le serveur n'en acceptera aucune autre — il la
                relit lui-même à partir du jeton.
              */}
              <div className="border-border bg-surface-sunken/45 flex items-center gap-3 rounded-xl border p-3">
                <span className="bg-surface text-primary flex size-9 shrink-0 items-center justify-center rounded-lg shadow-xs">
                  <Mail className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <span className="text-subtle-foreground text-2xs block font-medium">
                    Adresse invitée
                  </span>
                  <p className="text-foreground truncate text-sm font-semibold">
                    {invitation.invitedEmail}
                  </p>
                </div>
              </div>

              <Input
                label="Choisissez un mot de passe"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={motDePasse}
                onChange={(e) => {
                  setMotDePasse(e.target.value);
                }}
                hint="Huit caractères au minimum."
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={rejoindre.isPending}
                isLoading={rejoindre.isPending}
                loadingLabel="Création du compte et acceptation de l’invitation"
                trailingIcon={<ArrowRight />}
              >
                Rejoindre {invitation.organizationName}
              </Button>

              <Button asChild variant="ghost" size="sm" className="w-full">
                {/* `state.from` : la connexion sait déjà y revenir. */}
                <Link to={ROUTES.login} state={{ from: location.pathname }}>
                  J’ai déjà un compte
                </Link>
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    void accept();
                  }}
                  disabled={acceptInvitation.isPending}
                  isLoading={acceptInvitation.isPending}
                  loadingLabel="Acceptation de l’invitation"
                  trailingIcon={<ArrowRight />}
                >
                  Accepter l’invitation
                </Button>

                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link to={ROUTES.dashboard}>Plus tard</Link>
                </Button>
              </div>

              {/*
                L'adresse connectée est rappelée : c'est LA cause d'échec la plus
                fréquente, et la voir avant de cliquer évite un refus incompris.
              */}
              <div className="border-border bg-surface-sunken/45 flex items-start gap-2.5 rounded-xl border p-3 text-left">
                <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p className="text-subtle-foreground text-2xs leading-relaxed">
                  Connecté en tant que{' '}
                  <strong className="text-foreground">{user.email ?? 'inconnu'}</strong>.
                  L’invitation ne fonctionnera que si cette adresse est celle qui a été invitée.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
