import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { qk } from '@/lib/query-keys';
import {
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

export function ProviderConnectionCard({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
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
    onSuccess: (url) => window.location.assign(url),
  });
  const verify = useMutation({
    mutationFn: () => verifySuperPdpConnection(organizationId),
    onSuccess: refresh,
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectSuperPdp(organizationId),
    onSuccess: refresh,
  });
  const connection = query.data ?? null;
  const status = connection?.status ?? 'disconnected';
  const awaitingConfiguration =
    canManage &&
    status === 'disconnected' &&
    readinessQuery.isSuccess &&
    !readinessQuery.data.configured;
  const config = awaitingConfiguration
    ? ({ label: 'Configuration en cours', variant: 'info' } as const)
    : STATUS[status];
  const pending = start.isPending || verify.isPending || disconnect.isPending;
  const error =
    start.error ?? verify.error ?? disconnect.error ?? query.error ?? readinessQuery.error;

  return (
    <Card aria-label="Plateforme agréée">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            {status === 'connected' ? (
              <CheckCircle2 className="text-success size-4" aria-hidden="true" />
            ) : (
              <Unplug className="text-muted-foreground size-4" aria-hidden="true" />
            )}
            Plateforme agréée
          </CardTitle>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-foreground text-sm font-semibold">SUPER PDP</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            L’autorisation se fait sur le site de SUPER PDP. REZO360 n’affiche ni ne demande vos
            identifiants de plateforme.
          </p>
        </div>

        {connection?.provider_environment && (
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Environnement</dt>
              <dd className="text-foreground font-medium">
                {connection.provider_environment === 'sandbox' ? 'Bac à sable' : 'Production'}
              </dd>
            </div>
            <div>
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
          <div className="flex flex-wrap gap-2">
            {readinessQuery.isPending && status === 'disconnected' && (
              <Button disabled>Vérification de la disponibilité…</Button>
            )}
            {awaitingConfiguration && <Button disabled>Connexion bientôt disponible</Button>}
            {!readinessQuery.isPending &&
              !awaitingConfiguration &&
              (status === 'disconnected' || status === 'action_required') && (
                <Button className="gap-2" disabled={pending} onClick={() => start.mutate()}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {start.isPending ? 'Préparation…' : 'Connecter SUPER PDP'}
                </Button>
              )}
            {status === 'pending_verification' && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={pending}
                onClick={() => verify.mutate()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Vérifier maintenant
              </Button>
            )}
            {status === 'connected' && (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={pending}
                  onClick={() => verify.mutate()}
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Vérifier la connexion
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => disconnect.mutate()}>
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
      </CardContent>
    </Card>
  );
}
