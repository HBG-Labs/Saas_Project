import { Globe } from 'lucide-react';
import { useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="text-primary size-4" aria-hidden="true" />
          Portail client
        </CardTitle>
        <CardDescription>
          Un espace sécurisé où vos clients consultent leurs interventions, devis, factures et documents
          partagés, et échangent avec vous par messagerie. Tout reste privé tant que vous ne le partagez pas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FormError error={error} />

        <Switch
          checked={enabled}
          disabled={!access.canManage || update.isPending}
          onCheckedChange={(checked) => {
            save({ enabled: checked });
          }}
          label="Activer le portail client"
          description="Tant qu'il est désactivé, aucun client ne peut se connecter, même si son accès est ouvert."
        />

        <Switch
          checked={allowClientInitiated}
          disabled={!access.canManage || !enabled || update.isPending}
          onCheckedChange={(checked) => {
            save({ allow_client_initiated: checked });
          }}
          label="Autoriser les clients à ouvrir une conversation"
          description="Désactivé : ils ne peuvent que répondre à vos messages."
        />

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            save({ display_name: currentName.trim() || null });
          }}
        >
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
          <Button type="submit" variant="outline" size="sm" disabled={!access.canManage || update.isPending}>
            {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </form>

        <p className="text-muted-foreground text-xs">
          Pour donner accès à un client : ouvrez sa fiche, onglet <strong>Contacts</strong>, et activez
          « Accès au portail » sur l'interlocuteur concerné. Il recevra un code de connexion à chaque visite.
        </p>
      </CardContent>
    </Card>
  );
}
