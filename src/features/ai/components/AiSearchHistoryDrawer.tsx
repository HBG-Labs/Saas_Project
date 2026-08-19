import {
  Clock,
  History,
  MessageSquare,
  Search,
  Trash2,
  X,
} from 'lucide-react';
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
        className="fixed inset-0 bg-black/50 backdrop-blur-2xs cursor-pointer"
        aria-hidden="true"
      />

      {/* Tiroir latéral droit */}
      <div className="relative z-10 flex h-full w-full max-w-sm flex-col bg-surface shadow-overlay border-l border-border text-foreground">
        {/* En-tête du volet */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <History className="size-4" />
            </div>
            <div>
              <h2 id="ai-history-title" className="text-sm font-bold text-foreground">
                Historique des recherches
              </h2>
              <p className="text-2xs text-muted-foreground">
                {history.length} {history.length > 1 ? 'requêtes enregistrées' : 'requête enregistrée'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex size-7 items-center justify-center rounded-lg text-subtle-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
            aria-label="Fermer l'historique"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Barre de filtrage interne si plusieurs entrées */}
        {history.length > 3 && (
          <div className="p-3 border-b border-border">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 size-3.5 text-subtle-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrer l'historique…"
                className="w-full rounded-xl border border-border bg-surface-sunken py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Liste des recherches */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-subtle-foreground">
              <Clock className="size-8 stroke-[1.5] mb-2 opacity-50" />
              <p className="text-xs font-semibold text-foreground">
                Aucun historique de recherche
              </p>
              <p className="text-2xs mt-1 max-w-[220px]">
                Vos prochaines questions et analyses apparaîtront ici pour un accès rapide.
              </p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-subtle-foreground">
              Aucune recherche ne correspond à « {searchTerm} »
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="group relative flex items-center justify-between rounded-xl border border-transparent p-2.5 hover:border-border hover:bg-surface-hover transition-all"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSearch(item.query);
                    handleClose();
                  }}
                  className="flex flex-1 items-start gap-2.5 text-left cursor-pointer overflow-hidden pr-2"
                >
                  <MessageSquare className="size-4 text-subtle-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {item.query}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
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
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-subtle-foreground opacity-60 hover:opacity-100 hover:bg-error-subtle hover:text-error transition-all cursor-pointer"
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
          <div className="border-t border-border p-3 bg-surface-sunken/50">
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleClearAll}
                  className="flex-1 text-xs h-8 font-semibold"
                >
                  Confirmer la suppression
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClear(false)}
                  className="text-xs h-8"
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="w-full text-xs text-error hover:bg-error-subtle hover:text-error h-8 justify-center gap-1.5"
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
