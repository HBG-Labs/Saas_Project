import { ArrowLeft, BookOpen, Star, Wrench } from 'lucide-react';
import { Suspense } from 'react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FALLBACK_TOOL_ICON, TOOL_ICONS } from '@/components/ui/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ROUTES } from '@/config/routes';
import {
  useCatalogTool,
  useFavorites,
  useRecordToolUsage,
  useToggleFavorite,
} from '@/features/catalog';
import { getCategoryMetadata } from '@/features/tools/catalog-metadata';
import { getTool, ToolErrorBoundary } from '@/features/tools';
import { cn } from '@/lib/cn';

/**
 * Page d'un outil.
 *
 * L'outil interactif est placé AVANT la documentation, conformément au principe
 * « le résultat d'abord » (§2.1) : un utilisateur qui connaît l'outil ne doit
 * jamais faire défiler pour atteindre ce qu'il vient chercher.
 *
 * Trois garanties se superposent ici :
 *   • `ToolErrorBoundary` confine un crash à la zone de l'outil (Phase 1) ;
 *   • `Suspense` couvre le chargement paresseux du composant ;
 *   • un slug inconnu produit un message clair plutôt qu'un écran blanc.
 */
export default function ToolDetailPage() {
  const { toolSlug } = useParams<{ toolSlug: string }>();
  const tool = toolSlug ? getTool(toolSlug) : undefined;

  /**
   * Le favori vient du serveur, il n'est plus un état local.
   *
   * La version précédente le stockait dans un `useState` : l'étoile
   * s'allumait, et l'information disparaissait au rechargement. C'est le même
   * défaut que le plan tarifaire corrigé en Phase 2 — un état d'interface qui
   * se fait passer pour une donnée.
   */
  useRecordToolUsage(toolSlug);
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const dbTool = useCatalogTool(toolSlug);

  const favorite = (favorites.data ?? []).find((entry) => entry.slug === toolSlug) ?? null;
  const isFavorite = favorite !== null;

  if (!tool) {
    // `PageHeader` porte le <h1> : une page dont le contenu principal est un
    // état vide doit malgré tout avoir un titre de niveau 1, sans quoi elle est
    // impossible à situer avec un lecteur d'écran.
    return (
      <>
        <PageHeader
          title="Outil introuvable"
          description={`Aucun outil ne correspond à « ${toolSlug ?? ''} ».`}
        />
        <EmptyState
          icon={Wrench}
          title="Cet outil n’est pas disponible"
          description="Il n’est peut-être pas encore publié, ou son adresse a changé."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={ROUTES.tools}>Voir tous les outils</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { Component } = tool;
  const category = getCategoryMetadata(tool.category);
  const Icon = TOOL_ICONS[tool.icon] ?? FALLBACK_TOOL_ICON;

  return (
    <>
      <Link
        to={ROUTES.tools}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Tous les outils
      </Link>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-lg',
              category?.tint ?? 'bg-surface-hover text-muted-foreground',
            )}
            aria-hidden="true"
          >
            <Icon className="size-6" />
          </span>

          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{tool.title}</h1>
            <p className="text-muted-foreground mt-1 max-w-prose text-sm">{tool.description}</p>
            {category ? (
              <Link to={ROUTES.category(category.slug)} className="mt-2 inline-block">
                <Badge variant="neutral">{category.name}</Badge>
              </Link>
            ) : null}
          </div>
        </div>

        <Button
          variant={isFavorite ? 'secondary' : 'outline'}
          onClick={() => {
            // Sans favori enregistré, il faut l'identifiant en base — que seule
            // la liste des favoris porte. On la consulte donc pour retirer, et
            // on résout le slug pour ajouter.
            if (favorite !== null) {
              toggleFavorite.mutate({ toolId: favorite.id, isFavorite: true });
            } else if (dbTool.data != null) {
              toggleFavorite.mutate({ toolId: dbTool.data.id, isFavorite: false });
            }
          }}
          disabled={toggleFavorite.isPending || (favorite === null && dbTool.data == null)}
          aria-pressed={isFavorite}
          leadingIcon={<Star className={cn(isFavorite && 'text-warning fill-current')} />}
          className="shrink-0"
        >
          {isFavorite ? 'Dans vos favoris' : 'Ajouter aux favoris'}
        </Button>
      </header>

      <Tabs defaultValue="tool">
        <TabsList>
          <TabsTrigger value="tool">Outil</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
          <TabsTrigger value="references">Références</TabsTrigger>
        </TabsList>

        <TabsContent value="tool">
          <ToolErrorBoundary toolSlug={tool.slug} toolTitle={tool.title}>
            <Suspense fallback={<LoadingScreen variant="inline" label="Chargement de l’outil…" />}>
              <Component />
            </Suspense>
          </ToolErrorBoundary>
        </TabsContent>

        <TabsContent value="docs">
          <EmptyState
            icon={BookOpen}
            size="sm"
            title="Documentation à venir"
            description="Le mode d’emploi et les formules utilisées par cet outil seront publiés avec sa mise en service."
          />
        </TabsContent>

        <TabsContent value="references">
          <EmptyState
            icon={BookOpen}
            size="sm"
            title="Aucune référence"
            description="Normes, abaques et documents de référence associés à cet outil apparaîtront ici."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
