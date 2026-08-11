import { ArrowLeft, Wrench } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { FALLBACK_TOOL_ICON, TOOL_ICONS } from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { getCategoryMetadata } from '@/features/tools/catalog-metadata';
import { ToolCard } from '@/features/tools/components/ToolCard';
import { listTools } from '@/features/tools';
import { cn } from '@/lib/cn';

export default function CategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const category = categorySlug ? getCategoryMetadata(categorySlug) : undefined;

  if (!category) {
    return (
      <>
        <PageHeader
          title="Catégorie introuvable"
          description={`Aucune catégorie ne correspond à « ${categorySlug ?? ''} ».`}
        />
        <EmptyState
          icon={Wrench}
          title="Cette catégorie n’existe pas"
          description="Elle a peut-être été renommée. Le catalogue complet reste accessible."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={ROUTES.tools}>Voir le catalogue</Link>
            </Button>
          }
        />
      </>
    );
  }

  const Icon = TOOL_ICONS[category.icon] ?? FALLBACK_TOOL_ICON;
  const tools = listTools().filter((tool) => tool.category === category.slug);

  return (
    <>
      <Link
        to={ROUTES.tools}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Tous les outils
      </Link>

      <div className="mb-6 flex items-start gap-4">
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-lg',
            category.tint,
          )}
          aria-hidden="true"
        >
          <Icon className="size-6" />
        </span>
        <PageHeader title={category.name} description={category.description} className="mb-0" />
      </div>

      {tools.length > 0 ? (
        category.slug === 'general' ? (
          <div className="space-y-8">
            {/* Sous-catégorie 1 : Calculatrices */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border/80 pb-2">
                <span className="rounded-lg bg-primary/10 px-3 py-1 font-mono text-xs font-extrabold text-primary">
                  🧮 Calculatrices
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Calculatrices scientifiques, trigonométrie et fonctions mathématiques
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tools
                  .filter((t) => t.subcategory === 'calculator' || !t.subcategory)
                  .map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
                  ))}
              </div>
            </div>

            {/* Sous-catégorie 2 : Convertisseurs */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border/80 pb-2">
                <span className="rounded-lg bg-info/10 px-3 py-1 font-mono text-xs font-extrabold text-info">
                  🔄 Convertisseurs
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Convertisseurs d&apos;unités techniques, de puissance et de décibels
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tools
                  .filter((t) => t.subcategory === 'converter')
                  .map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={Icon}
          title="Bientôt disponible"
          description={`Les outils de la catégorie « ${category.name} » sont en cours de développement et seront publiés progressivement.`}
        />
      )}
    </>
  );
}
