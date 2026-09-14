import { Clock, History, MessageSquare, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/Button';
import { formatRelativeTime } from '@/lib/format';

import type { AiSearchHistoryItem } from '../types/ai.types';

interface AiSearchHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: readonly AiSearchHistoryItem[];
  onSelectSearch: (query: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
}

export function AiSearchHistoryDrawer({
  isOpen,
  onClose,
  history,
  onSelectSearch,
  onRemoveItem,
  onClearAll,
}: AiSearchHistoryDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) =>
    item.query.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    onClearAll();
    setConfirmClear(false);
  };

  const handleClose = () => {
    setConfirmClear(false);
    setSearchTerm('');
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-history-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Fond sombre transparent cliquable pour fermer */}
      <div
        onClick={handleClose}
        className="backdrop-blur-2xs fixed inset-0 cursor-pointer bg-black/50"
        aria-hidden="true"
      />

      {/* Tiroir latéral droit */}
      <div className="bg-surface shadow-overlay border-border text-foreground relative z-10 flex h-full w-full max-w-sm flex-col border-l">
        {/* En-tête du volet */}
        <div className="border-border flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
              <History className="size-4" />
            </div>
            <div>
              <h2 id="ai-history-title" className="text-foreground text-sm font-bold">
                Historique des recherches
              </h2>
              <p className="text-2xs text-muted-foreground">
                {history.length}{' '}
                {history.length > 1 ? 'requêtes enregistrées' : 'requête enregistrée'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="text-subtle-foreground hover:bg-surface-hover hover:text-foreground flex size-11 cursor-pointer items-center justify-center rounded-lg transition-colors sm:size-7"
            aria-label="Fermer l'historique"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Barre de filtrage interne si plusieurs entrées */}
        {history.length > 3 && (
          <div className="border-border border-b p-3">
            <div className="relative flex items-center">
              <Search className="text-subtle-foreground absolute left-2.5 size-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrer l'historique…"
                className="border-border bg-surface-sunken text-foreground placeholder:text-subtle-foreground focus:border-primary focus:ring-primary w-full rounded-xl border py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Liste des recherches */}
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {history.length === 0 ? (
            <div className="text-subtle-foreground flex flex-col items-center justify-center py-12 text-center">
              <Clock className="mb-2 size-8 stroke-[1.5] opacity-50" />
              <p className="text-foreground text-xs font-semibold">Aucun historique de recherche</p>
              <p className="text-2xs mt-1 max-w-[220px]">
                Vos prochaines questions et analyses apparaîtront ici pour un accès rapide.
              </p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-subtle-foreground py-8 text-center text-xs">
              Aucune recherche ne correspond à « {searchTerm} »
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="group hover:border-border hover:bg-surface-hover relative flex items-center justify-between rounded-xl border border-transparent p-2.5 transition-all"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSearch(item.query);
                    handleClose();
                  }}
                  className="flex flex-1 cursor-pointer items-start gap-2.5 overflow-hidden pr-2 text-left"
                >
                  <MessageSquare className="text-subtle-foreground group-hover:text-primary mt-0.5 size-4 shrink-0 transition-colors" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground group-hover:text-primary line-clamp-2 text-xs font-medium transition-colors">
                      {item.query}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      {formatRelativeTime(item.timestamp) || 'Récemment'}
                    </p>
                  </div>
                </button>

                {/* Bouton de suppression individuelle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(item.id);
                  }}
                  className="text-subtle-foreground hover:bg-error-subtle hover:text-error flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg opacity-60 transition-[color,background-color,opacity] hover:opacity-100 sm:size-7"
                  title="Supprimer cette recherche"
                  aria-label="Supprimer cette recherche"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Pied de volet avec suppression totale */}
        {history.length > 0 && (
          <div className="border-border bg-surface-sunken/50 border-t p-3">
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-8 flex-1 text-xs font-semibold"
                >
                  Confirmer la suppression
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClear(false)}
                  className="h-8 text-xs"
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-error hover:bg-error-subtle hover:text-error h-8 w-full justify-center gap-1.5 text-xs"
              >
                <Trash2 className="size-3.5" />
                <span>Effacer tout l’historique</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
