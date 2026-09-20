import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useState } from 'react';

import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { qk } from '@/lib/query-keys';
import { frenchSiren } from '../provider/superpdp-contract';
import {
  activateSuperPdpReception,
  disconnectSuperPdp,
  getEinvoicingProviderConnection,
  getSuperPdpReadiness,
  startSuperPdpConnection,
  verifySuperPdpConnection,
} from '../api/provider.api';

const STATUS: Record<
  'pending_verification' | 'connected' | 'action_required' | 'disconnected',
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  pending_verification: { label: 'Vérification en cours', variant: 'info' },
  connected: { label: 'Connectée', variant: 'success' },
  action_required: { label: 'Action requise', variant: 'error' },
  disconnected: { label: 'Non connectée', variant: 'neutral' },
};

const RECEPTION_STATUS: Record<
  'not_requested' | 'pending_verification' | 'active' | 'failed',
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  not_requested: { label: 'Non activée', variant: 'neutral' },
  pending_verification: { label: 'Vérification en cours', variant: 'info' },
  active: { label: 'Active', variant: 'success' },
  failed: { label: 'Échec de l’activation', variant: 'error' },
};

export function ProviderConnectionCard({
  organizationId,
  canManage,
  registrationNumber = null,
}: {
  organizationId: string;
  canManage: boolean;
  /** Utilisé uniquement pour afficher l'adresse de facturation électronique une fois la réception active. */
  registrationNumber?: string | null;
}) {
  const queryClient = useQueryClient();
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [receptionAuthorizationUrl, setReceptionAuthorizationUrl] = useState<string | null>(null);
  const query = useQuery({
    queryKey: qk.einvoicing.connection(organizationId),
    queryFn: () => getEinvoicingProviderConnection(organizationId),
  });
  const readinessQuery = useQuery({
    queryKey: qk.einvoicing.providerReadiness(organizationId),
    queryFn: () => getSuperPdpReadiness(organizationId),
    enabled: canManage,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.einvoicing.connection(organizationId) });
  };
  const start = useMutation({
    mutationFn: () => startSuperPdpConnection(organizationId),
    onSuccess: setAuthorizationUrl,
  });
  const verify = useMutation({
    mutationFn: () => verifySuperPdpConnection(organizationId),
    onSuccess: refresh,
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectSuperPdp(organizationId),
    onSuccess: refresh,
  });
  const activateReception = useMutation({
    mutationFn: () => activateSuperPdpReception(organizationId),
    onSuccess: setReceptionAuthorizationUrl,
  });
  const connection = query.data ?? null;
  const status = connection?.status ?? 'disconnected';
  const receptionStatus = connection?.reception_status ?? 'not_requested';
  const awaitingConfiguration =
    canManage &&
    status === 'disconnected' &&
    readinessQuery.isSuccess &&
    !readinessQuery.data.configured;
  const config = awaitingConfiguration
    ? ({ label: 'Configuration en cours', variant: 'info' } as const)
    : STATUS[status];
  const pending =
    start.isPending || verify.isPending || disconnect.isPending || activateReception.isPending;
  const error =
    start.error ??
    verify.error ??
    disconnect.error ??
    activateReception.error ??
    query.error ??
    readinessQuery.error;
  const electronicAddress = frenchSiren(registrationNumber);

  return (
    <Card aria-label="Plateforme agréée" className="overflow-hidden">
      <CardHeader className="border-border bg-surface-sunken/35 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                status === 'connected'
                  ? 'bg-success/10 text-success'
                  : 'bg-surface text-muted-foreground'
              }`}
            >
              {status === 'connected' ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                <Unplug className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="space-y-1">
              <CardTitle>Plateforme agréée</CardTitle>
              <CardDescription>Connexion sécurisée pour transmettre vos factures.</CardDescription>
            </div>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 sm:pt-5">
        <div className="space-y-1">
          <p className="text-foreground text-sm font-semibold">SUPER PDP</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            L’autorisation se fait sur le site de SUPER PDP. REZO360 n’affiche ni ne demande vos
            identifiants de plateforme.
          </p>
        </div>

        {connection?.provider_environment && (
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="border-border bg-surface-raised rounded-lg border p-3">
              <dt className="text-muted-foreground">Environnement</dt>
              <dd className="text-foreground font-medium">
                {connection.provider_environment === 'sandbox' ? 'Bac à sable' : 'Production'}
              </dd>
            </div>
            <div className="border-border bg-surface-raised rounded-lg border p-3">
              <dt className="text-muted-foreground">Vérification de l’entreprise</dt>
              <dd className="text-foreground font-medium">
                {connection.company_verification_status === 'verified'
                  ? 'Validée'
                  : connection.company_verification_status === 'failed'
                    ? 'Refusée'
                    : 'En cours'}
              </dd>
            </div>
          </dl>
        )}

        {status === 'pending_verification' && (
          <p className="border-info/30 bg-info/5 text-info rounded-lg border p-3 text-xs">
            SUPER PDP contrôle encore le rattachement de l’entreprise. Aucun envoi n’est possible
            avant sa validation.
          </p>
        )}
        {awaitingConfiguration && (
          <p className="border-info/30 bg-info/5 text-info rounded-lg border p-3 text-xs">
            Le connecteur sécurisé est installé en bac à sable. L’administrateur de REZO360 doit
            encore ajouter les identifiants de l’application SUPER PDP. Vous n’avez aucune clé à
            saisir ici.
          </p>
        )}
        {connection?.last_error_message && (
          <p
            role="alert"
            className="border-error/30 bg-error/5 text-error rounded-lg border p-3 text-xs"
          >
            {connection.last_error_message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-error text-xs">
            {error instanceof Error ? error.message : 'La connexion n’a pas pu être mise à jour.'}
          </p>
        )}

        {canManage ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {readinessQuery.isPending && status === 'disconnected' && (
              <Button disabled className="w-full sm:w-auto">
                Vérification de la disponibilité…
              </Button>
            )}
            {awaitingConfiguration && (
              <Button disabled className="w-full sm:w-auto">
                Connexion bientôt disponible
              </Button>
            )}
            {!readinessQuery.isPending &&
              !awaitingConfiguration &&
              (status === 'disconnected' || status === 'action_required') &&
              !authorizationUrl && (
                <Button
                  isLoading={start.isPending}
                  loadingLabel="Préparation de la connexion"
                  disabled={pending && !start.isPending}
                  onClick={() => start.mutate()}
                  leadingIcon={<ExternalLink />}
                  className="w-full sm:w-auto"
                >
                  {start.isPending ? 'Préparation…' : 'Préparer la connexion'}
                </Button>
              )}
            {(status === 'disconnected' || status === 'action_required') && authorizationUrl && (
              <Button
                asChild
                className="w-full sm:w-auto"
              >
                <a href={authorizationUrl}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Continuer sur SUPER PDP
                </a>
              </Button>
            )}
            {status === 'pending_verification' && (
              <Button
                variant="outline"
                isLoading={verify.isPending}
                loadingLabel="Vérification de la connexion"
                disabled={pending && !verify.isPending}
                onClick={() => verify.mutate()}
                leadingIcon={<RefreshCw />}
                className="w-full sm:w-auto"
              >
                Vérifier maintenant
              </Button>
            )}
            {status === 'connected' && (
              <>
                <Button
                  variant="outline"
                  isLoading={verify.isPending}
                  loadingLabel="Vérification de la connexion"
                  disabled={pending && !verify.isPending}
                  onClick={() => verify.mutate()}
                  leadingIcon={<ShieldCheck />}
                  className="w-full sm:w-auto"
                >
                  Vérifier la connexion
                </Button>
                <Button
                  variant="ghost"
                  isLoading={disconnect.isPending}
                  loadingLabel="Déconnexion de SUPER PDP"
                  disabled={pending && !disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                  className="w-full sm:w-auto"
                >
                  Déconnecter
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Un propriétaire ou administrateur peut gérer cette connexion.
          </p>
        )}

        {status === 'connected' && (
          <div className="border-border mt-2 space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="bg-surface text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Inbox className="size-4" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-semibold">
                    Réception des factures fournisseurs
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Optionnelle et distincte de l’émission : une autorisation supplémentaire est
                    demandée sur SUPER PDP.
                  </p>
                </div>
              </div>
              <Badge variant={RECEPTION_STATUS[receptionStatus].variant}>
                {RECEPTION_STATUS[receptionStatus].label}
              </Badge>
            </div>

            {receptionStatus === 'active' && electronicAddress && (
              <dl className="border-border bg-surface-raised rounded-lg border p-3 text-xs">
                <dt className="text-muted-foreground">Adresse de facturation électronique</dt>
                <dd className="text-foreground font-medium">{electronicAddress}</dd>
              </dl>
            )}
            {receptionStatus === 'pending_verification' && (
              <p className="border-info/30 bg-info/5 text-info rounded-lg border p-3 text-xs">
                SUPER PDP contrôle encore l’accès à la réception. Utilisez « Vérifier la connexion »
                ci-dessus pour actualiser ce statut.
              </p>
            )}
            {receptionStatus === 'failed' && connection?.reception_last_error_message && (
              <p
                role="alert"
                className="border-error/30 bg-error/5 text-error rounded-lg border p-3 text-xs"
              >
                {connection.reception_last_error_message}
              </p>
            )}

            {canManage && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {(receptionStatus === 'not_requested' || receptionStatus === 'failed') &&
                  !receptionAuthorizationUrl && (
                    <Button
                      variant="outline"
                      isLoading={activateReception.isPending}
                      loadingLabel="Préparation de l’activation"
                      disabled={pending && !activateReception.isPending}
                      onClick={() => activateReception.mutate()}
                      leadingIcon={<Inbox />}
                      className="w-full sm:w-auto"
                    >
                      {receptionStatus === 'failed'
                        ? 'Réessayer l’activation'
                        : 'Activer la réception'}
                    </Button>
                  )}
                {(receptionStatus === 'not_requested' || receptionStatus === 'failed') &&
                  receptionAuthorizationUrl && (
                    <Button
                      asChild
                      className="w-full sm:w-auto"
                    >
                      <a href={receptionAuthorizationUrl}>
                        <ExternalLink className="size-4" aria-hidden="true" />
                        Continuer sur SUPER PDP
                      </a>
                    </Button>
                  )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
