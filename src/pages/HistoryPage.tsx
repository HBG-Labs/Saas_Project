import { Clock } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { useToolHistory } from '@/features/catalog';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Historique d'utilisation des outils.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX HISTORIQUES COEXISTENT, ET CE N'EST PAS UN DOUBLON
 *
 * Celui-ci enregistre QUEL OUTIL a été ouvert : il vit sur le serveur, suit
 * l'utilisateur d'un appareil à l'autre, et sert à retrouver ce qu'on utilisait
 * la semaine dernière.
 *
 * `features/history` enregistre CE QUI Y A ÉTÉ CALCULÉ — expressions et
 * résultats. Il vit dans le navigateur, parce qu'un technicien calcule souvent
 * sans réseau, et parce que ses brouillons de calcul ne regardent personne.
 *
 * Le premier est un usage, le second un résultat.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function HistoryPage() {
  useDocumentTitle('Historique');

  const history = useToolHistory();
  const entries = history.data ?? [];

  return (
    <>
      <PageHeader
        title="Historique"
        description="Les outils que vous avez ouverts, du plus récent au plus ancien."
      />

      {history.isPending ? (
        <ListSkeleton />
      ) : history.isError ? (
        <ErrorState
          error={history.error}
          onRetry={() => {
            void history.refetch();
          }}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Aucun outil consulté"
          description="Les outils que vous ouvrez apparaîtront ici, sur tous vos appareils."
          action={
            <Button asChild size="sm">
              <Link to={ROUTES.tools}>Parcourir les outils</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-border divide-y">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={ROUTES.tool(entry.tool.slug)}
                className="hover:bg-surface-hover -mx-2 flex flex-wrap items-center gap-3 rounded-md px-2 py-3 transition-colors"
              >
                <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                  {entry.tool.name}
                </span>

                <Badge variant="outline">{entry.tool.category.name}</Badge>

                <span className="text-subtle-foreground font-mono text-xs tabular-nums">
                  {new Date(entry.usedAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
