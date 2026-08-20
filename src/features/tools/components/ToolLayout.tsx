import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  RotateCcw,
  Star,
  Wrench,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useToolFavorites } from '../hooks/useToolFavorites';
import { useToolHistory } from '../hooks/useToolHistory';

interface ToolLayoutProps {
  toolSlug: string;
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }> | undefined;
  children: ReactNode;
  onReset?: (() => void) | undefined;
}

export function ToolLayout({
  toolSlug,
  title,
  description,
  icon: Icon = Wrench,
  children,
  onReset,
}: ToolLayoutProps) {
  const { isFavorite, toggleFavorite } = useToolFavorites();
  const { history, clearHistory, removeHistoryEntry } = useToolHistory();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const favorite = isFavorite(toolSlug);
  const toolHistory = history.filter((h) => h.toolSlug === toolSlug);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-16 px-1 sm:px-0">
      {/* Navigation retour & Actions en-tête */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to={ROUTES.tools}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-surface-raised"
        >
          <ArrowLeft className="size-4" />
          <span>Tous les outils</span>
        </Link>

        <div className="flex items-center gap-1.5">
          {/* Bouton Historique */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryOpen((v) => !v)}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            title="Consulter l'historique des calculs"
          >
            <Clock className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Historique</span>
            {toolHistory.length > 0 && (
              <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-3xs font-bold text-primary">
                {toolHistory.length}
              </span>
            )}
          </Button>

          {/* Bouton Favori */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleFavorite(toolSlug)}
            className={`h-8 gap-1.5 text-xs font-medium cursor-pointer ${
              favorite ? 'text-amber-500 border-amber-500/40 bg-amber-500/10' : ''
            }`}
            title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Star className={`size-3.5 ${favorite ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span className="hidden sm:inline">{favorite ? 'Favori' : 'Épingler'}</span>
          </Button>

          {/* Bouton Réinitialiser */}
          {onReset && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              title="Réinitialiser les champs"
            >
              <RotateCcw className="size-3.5" />
              <span className="sr-only sm:not-sr-only">Effacer</span>
            </Button>
          )}
        </div>
      </div>

      {/* En-tête de l'outil */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              <span className="rounded-md bg-surface-raised px-2 py-0.5 text-3xs font-bold uppercase tracking-wider text-primary border border-primary/20">
                Universel
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </Card>

      {/* Volet Historique déroulant */}
      {isHistoryOpen && (
        <Card className="border-border bg-surface p-4 space-y-3 shadow-md animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Historique des calculs récents
              </h2>
            </div>
            {toolHistory.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="text-3xs text-error hover:underline cursor-pointer font-semibold"
              >
                Effacer tout
              </button>
            )}
          </div>

          {toolHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucun calcul enregistré pour cet outil. Effectuez un calcul pour le voir apparaître ici.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {toolHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-surface-raised border border-border text-xs gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-foreground text-xs">{entry.result}</p>
                    <p className="text-3xs text-muted-foreground mt-0.5 truncate">{entry.summary}</p>
                    <p className="text-3xs text-subtle-foreground mt-0.5">
                      {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHistoryEntry(entry.id)}
                    className="text-muted-foreground hover:text-error text-3xs p-1 cursor-pointer"
                    title="Supprimer cette entrée"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Contenu interactif de l'outil */}
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/**
 * Bouton de copie avec feedback visuel
 */
export function CopyResultButton({
  textToCopy,
  label = 'Copier le résultat',
  className = '',
}: {
  textToCopy: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={`gap-1.5 text-xs font-semibold cursor-pointer ${
        copied ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : ''
      } ${className}`}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      <span>{copied ? 'Copié !' : label}</span>
    </Button>
  );
}
