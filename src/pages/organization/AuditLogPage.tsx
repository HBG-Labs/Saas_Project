import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { AUDIT_ACTION_LABELS, describeAuditAction, useAuditLogs } from '@/features/audit';
import { useCurrentOrganization } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

const ENTITY_LABELS: Record<string, string> = {
  mission: 'Mission',
  report: 'Compte rendu',
  member: 'Membre',
  team: 'Équipe',
  customer: 'Client',
};

/**
 * Journal d'audit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE JOURNAL VAUT
 *
 * Il est écrit exclusivement par des triggers PostgreSQL, et un trigger
 * d'immuabilité refuse toute modification ou suppression — y compris à un rôle
 * privilégié, ce que le scénario de test vérifie.
 *
 * C'est ce qui le distingue d'un simple historique : personne, pas même le
 * propriétaire de l'entreprise, ne peut en effacer une ligne gênante. Un
 * journal que l'on peut nettoyer ne prouve rien.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function AuditLogPage() {
  useDocumentTitle('Journal');

  const { organization } = useCurrentOrganization();
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  const logs = useAuditLogs(organization?.id ?? null, {
    ...(action !== '' ? { action } : {}),
    ...(entityType !== '' ? { entityType } : {}),
  });

  const list = logs.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal"
        description="Toutes les actions engageantes de l’entreprise. Écrit par la base de données, et modifiable par personne."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          options={[
            { value: '', label: 'Toutes les actions' },
            ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          value={action}
          onValueChange={setAction}
          label="Action"
          hideLabel
        />

        <Select
          options={[
            { value: '', label: 'Tous les objets' },
            ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          value={entityType}
          onValueChange={setEntityType}
          label="Type d’objet"
          hideLabel
        />
      </div>

      {logs.isPending ? (
        <ListSkeleton />
      ) : logs.isError ? (
        <ErrorState
          error={logs.error}
          onRetry={() => {
            void logs.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={action === '' && entityType === '' ? 'Journal vide' : 'Aucun résultat'}
          description={
            action !== '' || entityType !== ''
              ? 'Aucune action ne correspond à ces filtres.'
              : 'Les actions engageantes — création de mission, validation de compte rendu, changement de rôle — apparaîtront ici.'
          }
        />
      ) : (
        <ul className="divide-border divide-y">
          {list.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-3 py-3">
              <span className="text-subtle-foreground w-36 shrink-0 font-mono text-xs tabular-nums">
                {new Date(entry.created_at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>

              <span className="text-foreground min-w-0 flex-1 text-sm">
                {describeAuditAction(entry.action)}
              </span>

              {/*
                `actor_label` est figé au moment de l'action par le trigger. Un
                membre retiré depuis, ou renommé, reste identifié tel qu'il était
                — c'est précisément ce qu'on attend d'un journal.
              */}
              <span className="text-muted-foreground text-xs">
                {entry.actor_label ?? 'Système'}
              </span>

              <Badge variant="outline">
                {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {list.length >= 100 ? (
        <p className="text-subtle-foreground text-xs">
          Les cent dernières actions sont affichées. Affinez les filtres pour remonter plus loin.
        </p>
      ) : null}
    </div>
  );
}
