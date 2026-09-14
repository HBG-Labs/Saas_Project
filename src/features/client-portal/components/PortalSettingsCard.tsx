import { Globe } from 'lucide-react';
import { useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';

import { useClientPortalAccess, useUpdatePortalSettings } from '../hooks/useClientPortal';

/**
 * Réglages du portail client pour l'entreprise.
 *
 * Les catégories de documents visibles ne sont pas éditées ici en V1 : le
 * partage se décide document par document, ce qui est le réglage prudent
 * (« privé par défaut »). La colonne existe en base pour une règle par
 * catégorie, quand le besoin se présentera.
 */
export function PortalSettingsCard() {
  const access = useClientPortalAccess();
  const update = useUpdatePortalSettings(access.organizationId);
  const [error, setError] = useState<unknown>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  if (access.isLoading) return <Skeleton className="h-40 w-full" />;
  if (access.settings.isError) {
    return (
      <ErrorState
        error={access.settings.error}
        onRetry={() => {
          void access.settings.refetch();
        }}
      />
    );
  }

  const settings = access.settings.data ?? null;
  const enabled = settings?.enabled ?? false;
  const allowClientInitiated = settings?.allow_client_initiated ?? true;
  const currentName = displayName ?? settings?.display_name ?? '';

  const save = (patch: Parameters<typeof update.mutate>[0]) => {
    setError(null);
    update.mutate(patch, {
      onError: (e) => {
        setError(e);
      },
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-border bg-surface-sunken/35 border-b">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Globe className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Configuration du portail</CardTitle>
              <Badge variant={enabled ? 'success' : 'neutral'}>
                {enabled ? 'Actif' : 'Désactivé'}
              </Badge>
            </div>
            <CardDescription>
              Vos clients consultent leurs interventions, devis, factures et documents partagés dans
              un espace sécurisé.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 sm:pt-5">
        <FormError error={error} />

        <Switch
          className="border-border bg-surface-raised flex-row-reverse items-center justify-between rounded-xl border p-3"
          checked={enabled}
          disabled={!access.canManage || update.isPending}
          onCheckedChange={(checked) => {
            save({ enabled: checked });
          }}
          label="Activer le portail client"
          description="Tant qu'il est désactivé, aucun client ne peut se connecter, même si son accès est ouvert."
        />

        <Switch
          className="border-border bg-surface-raised flex-row-reverse items-center justify-between rounded-xl border p-3"
          checked={allowClientInitiated}
          disabled={!access.canManage || !enabled || update.isPending}
          onCheckedChange={(checked) => {
            save({ allow_client_initiated: checked });
          }}
          label="Autoriser les clients à ouvrir une conversation"
          description="Désactivé : ils ne peuvent que répondre à vos messages."
        />

        <form
          className="border-border bg-surface-raised rounded-xl border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            save({ display_name: currentName.trim() || null });
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Nom affiché sur le portail et dans les e-mails"
              placeholder="Nom de votre entreprise"
              hint="Vide : le nom de l'entreprise est utilisé."
              value={currentName}
              maxLength={120}
              disabled={!access.canManage}
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={!access.canManage}
              isLoading={update.isPending}
              loadingLabel="Enregistrement du nom du portail"
              className="w-full sm:w-auto"
            >
              {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>

        <p className="border-primary/20 bg-primary/[0.04] text-muted-foreground rounded-lg border p-3 text-xs leading-relaxed">
          Pour donner accès à un client : ouvrez sa fiche, onglet <strong>Contacts</strong>, et
          activez « Accès au portail » sur l'interlocuteur concerné. Il recevra un code de connexion
          à chaque visite.
        </p>
      </CardContent>
    </Card>
  );
}
