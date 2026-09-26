import { Camera, CheckCircle2, ExternalLink, RefreshCw, ShieldAlert, Unplug } from 'lucide-react';
import { useState } from 'react';

import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

import {
  useDisconnectInstagram,
  useInstagramAccount,
  useInstagramReadiness,
  useStartInstagramConnection,
  useSyncInstagramConnection,
} from '../hooks/useInstagramIntegration';
import { INSTAGRAM_SCOPES } from '../instagram-platform';

const STATUS: Record<
  'disconnected' | 'connected' | 'needs_reconnect' | 'error',
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  disconnected: { label: 'Non connecté', variant: 'neutral' },
  connected: { label: 'Connecté', variant: 'success' },
  needs_reconnect: { label: 'Reconnecter', variant: 'warning' },
  error: { label: 'Action requise', variant: 'error' },
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Jamais';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function InstagramIntegrationCard({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const accountQuery = useInstagramAccount(organizationId);
  const readinessQuery = useInstagramReadiness(organizationId, canManage);
  const start = useStartInstagramConnection(organizationId);
  const sync = useSyncInstagramConnection(organizationId);
  const disconnect = useDisconnectInstagram(organizationId);

  const account = accountQuery.data ?? null;
  const status = account?.status ?? 'disconnected';
  const badge =
    readinessQuery.data?.configured === false && status === 'disconnected'
      ? ({ label: 'Configuration requise', variant: 'info' } as const)
      : STATUS[status];
  const pending = start.isPending || sync.isPending || disconnect.isPending;
  const error =
    start.error ?? sync.error ?? disconnect.error ?? accountQuery.error ?? readinessQuery.error;

  const startConnection = () => {
    start.mutate(undefined, {
      onSuccess: setAuthorizationUrl,
    });
  };

  return (
    <Card aria-label="Instagram" className="overflow-hidden">
      <CardHeader className="border-border bg-surface-sunken/35 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={
                status === 'connected'
                  ? 'bg-success/10 text-success flex size-10 shrink-0 items-center justify-center rounded-lg'
                  : 'bg-surface text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg'
              }
            >
              {status === 'connected' ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                <Camera className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle>Instagram</CardTitle>
              <CardDescription>
                Connexion officielle Meta pour préparer Social Studio.
              </CardDescription>
            </div>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 sm:pt-5">
        {account && status === 'connected' ? (
          <div className="flex min-w-0 items-center gap-3">
            {account.profile_picture_url ? (
              <img
                src={account.profile_picture_url}
                alt=""
                className="bg-surface size-12 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="bg-surface text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-full">
                <Camera className="size-5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-semibold">
                @{account.username ?? 'compte'}
              </p>
              <p className="text-muted-foreground text-xs">
                {account.account_type ? `Compte ${account.account_type}` : 'Compte professionnel'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Connectez le compte Instagram professionnel de REZO360. Les identifiants et jetons Meta
            restent côté serveur.
          </p>
        )}

        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="border-border bg-surface-raised rounded-lg border p-3">
            <dt className="text-muted-foreground">Dernière synchronisation</dt>
            <dd className="text-foreground font-medium">{formatDate(account?.last_synced_at)}</dd>
          </div>
          <div className="border-border bg-surface-raised rounded-lg border p-3">
            <dt className="text-muted-foreground">Permissions demandées</dt>
            <dd className="text-foreground font-medium">
              {(account?.granted_permissions?.length
                ? account.granted_permissions
                : INSTAGRAM_SCOPES
              ).join(', ')}
            </dd>
          </div>
        </dl>

        {readinessQuery.data?.configured === false && canManage ? (
          <p className="border-info/30 bg-info/5 text-info rounded-lg border p-3 text-xs">
            Le connecteur est prêt côté application, mais les secrets Meta serveur ne sont pas
            encore configurés.
          </p>
        ) : null}

        {account?.last_error_message ? (
          <p
            role="alert"
            className="border-error/30 bg-error/5 text-error rounded-lg border p-3 text-xs"
          >
            {account.last_error_message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-error text-xs">
            {error instanceof Error ? error.message : 'La connexion Instagram a échoué.'}
          </p>
        ) : null}

        {canManage ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {status !== 'connected' && !authorizationUrl && (
              <Button
                isLoading={start.isPending}
                loadingLabel="Préparation de la connexion Instagram"
                disabled={pending && !start.isPending}
                onClick={startConnection}
                leadingIcon={<ExternalLink />}
                className="w-full sm:w-auto"
              >
                Connecter Instagram
              </Button>
            )}
            {authorizationUrl ? (
              <Button asChild className="w-full sm:w-auto">
                <a href={authorizationUrl}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Continuer chez Meta
                </a>
              </Button>
            ) : null}
            {status === 'connected' ? (
              <>
                <Button
                  variant="outline"
                  isLoading={sync.isPending}
                  loadingLabel="Synchronisation Instagram"
                  disabled={pending && !sync.isPending}
                  onClick={() => sync.mutate()}
                  leadingIcon={<RefreshCw />}
                  className="w-full sm:w-auto"
                >
                  Synchroniser
                </Button>
                <Button
                  variant="outline"
                  isLoading={start.isPending}
                  loadingLabel="Préparation de la reconnexion"
                  disabled={pending && !start.isPending}
                  onClick={startConnection}
                  leadingIcon={<ExternalLink />}
                  className="w-full sm:w-auto"
                >
                  Reconnecter
                </Button>
                <Button
                  variant="ghost"
                  isLoading={disconnect.isPending}
                  loadingLabel="Déconnexion Instagram"
                  disabled={pending && !disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                  leadingIcon={<Unplug />}
                  className="w-full sm:w-auto"
                >
                  Déconnecter
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>Un propriétaire ou administrateur peut gérer cette intégration.</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
