import { ArrowLeft, Sparkles, Star, Wrench, type LucideIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useUserEntitlements } from '@/features/billing';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';
import { MetierToolRunner } from '@/features/metiers-tools/components/MetierToolRunner';
import { useMetierFavorites } from '@/features/metiers-tools/hooks/useMetierFavorites';
import { getMetierTool, getTrade } from '@/features/metiers-tools/registry';
import { FALLBACK_NAV_ICON, NAV_ICONS } from '@/components/layout/nav-icons';

export default function MetierToolPage() {
  const { tradeSlug, toolSlug } = useParams<{ tradeSlug: string; toolSlug: string }>();

  const tool = tradeSlug && toolSlug ? getMetierTool(tradeSlug, toolSlug) : undefined;
  const trade = tradeSlug ? getTrade(tradeSlug) : undefined;
  const { has } = useUserEntitlements();
  const isProUnlocked = has('pro_tools');

  useDocumentTitle(
    tool
      ? `${tool.title} — ${trade?.shortName ?? 'Métiers'} REZO360`
      : 'Outil introuvable — REZO360',
  );

  const { isFavorite, toggleFavorite } = useMetierFavorites();

  if (!tool || !trade) {
    return (
      <>
        <PageHeader
          title="Outil métier introuvable"
          description="L’outil recherché n’existe pas ou a été déplacé."
        />
        <EmptyState
          icon={Wrench}
          title="Calculateur introuvable"
          description="Retrouvez l’ensemble des calculateurs dans le catalogue des outils métiers."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/metiers">Retour aux outils métiers</Link>
            </Button>
          }
        />
      </>
    );
  }

  const Icon: LucideIcon = NAV_ICONS[tool.icon] ?? NAV_ICONS[trade.icon] ?? FALLBACK_NAV_ICON;
  const fav = isFavorite(tool.slug);

  return (
    <>
      {/* Fil d'Ariane */}
      <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Link
          to="/metiers"
          className="hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Outils Métiers</span>
        </Link>
        <span>/</span>
        <Link
          to={`/metiers/${trade.slug}`}
          className="hover:text-foreground font-medium transition-colors"
        >
          {trade.name}
        </Link>
        <span>/</span>
        <span className="text-foreground max-w-[200px] truncate font-bold sm:max-w-none">
          {tool.title}
        </span>
      </div>

      {/* En-tête de l'outil */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-lg sm:size-12',
              trade.badgeColor,
            )}
            aria-hidden="true"
          >
            <Icon className="size-5 sm:size-6" />
          </span>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="neutral" className="text-3xs py-0.2 px-2 font-semibold">
                {trade.name}
              </Badge>
              {!isProUnlocked && (
                <span className="border-primary/25 bg-primary-subtle text-primary text-3xs inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 font-bold tracking-wider uppercase">
                  <Sparkles className="text-primary size-2.5" />
                  <span>Module Pro</span>
                </span>
              )}
              {tool.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="py-0.2 text-3xs bg-surface-raised border-border text-subtle-foreground inline-block rounded border px-1.5 font-mono"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-foreground text-xl font-black tracking-tight sm:text-2xl">
              {tool.title}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed sm:text-sm">
              {tool.description}
            </p>
          </div>
        </div>

        {/* Bouton Favori */}
        <Button
          type="button"
          variant={fav ? 'primary' : 'outline'}
          size="sm"
          onClick={() => toggleFavorite(tool.slug)}
          className={cn(
            'shrink-0 cursor-pointer gap-1.5 self-start text-xs font-semibold shadow-xs sm:self-auto',
            fav && 'bg-warning hover:bg-warning border-warning text-foreground',
          )}
        >
          <Star className={cn('size-4', fav && 'fill-current')} />
          <span>{fav ? 'Dans vos favoris' : 'Ajouter aux favoris'}</span>
        </Button>
      </div>

      {/* Exécuteur de calcul interactif */}
      <MetierToolRunner tool={tool} />
    </>
  );
}
