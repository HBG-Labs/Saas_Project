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
    tool ? `${tool.title} — ${trade?.shortName ?? 'Métiers'} REZO360` : 'Outil introuvable — REZO360',
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 flex-wrap">
        <Link to="/metiers" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          <span>Outils Métiers</span>
        </Link>
        <span>/</span>
        <Link to={`/metiers/${trade.slug}`} className="hover:text-foreground transition-colors font-medium">
          {trade.name}
        </Link>
        <span>/</span>
        <span className="text-foreground font-bold truncate max-w-[200px] sm:max-w-none">
          {tool.title}
        </span>
      </div>

      {/* En-tête de l'outil */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              'flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-2xl shadow-2xs',
              trade.badgeColor,
            )}
            aria-hidden="true"
          >
            <Icon className="size-5 sm:size-6" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="neutral" className="text-3xs px-2 py-0.2 font-semibold">
                {trade.name}
              </Badge>
              {!isProUnlocked && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 px-2 py-0.5 text-[9px] font-black tracking-wider uppercase text-amber-700 dark:text-amber-300 shadow-[0_1px_4px_rgba(245,158,11,0.15)] backdrop-blur-xs">
                  <Sparkles className="size-2.5 text-amber-500" />
                  <span>Module Pro</span>
                </span>
              )}
              {tool.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-1.5 py-0.2 rounded text-3xs font-mono bg-surface-raised border border-border text-subtle-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {tool.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
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
            'gap-1.5 text-xs font-semibold cursor-pointer shrink-0 self-start sm:self-auto shadow-xs',
            fav && 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-slate-950',
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
