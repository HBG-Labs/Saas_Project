import {
  ArrowUp,
  FileText,
  History,
  Loader2,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import type { AiMessage, AiSearchHistoryItem, AiSuggestion } from '../types/ai.types';

import { AiMessageItem } from './AiMessageItem';
import { AiSearchHistoryDrawer } from './AiSearchHistoryDrawer';
import { AiSuggestionChips } from './AiSuggestionChips';

interface AiChatBoxProps {
  messages: AiMessage[];
  isGenerating: boolean;
  error: string | null;
  /**
   * `true` quand l'assistant répond sans accès aux données de l'organisation,
   * `null` tant qu'aucune question n'a été posée.
   */
  isDegraded?: boolean | null;
  /** Quota mensuel de l'organisation épuisé — distinct de `isDegraded` : pas une panne, un plafond atteint. */
  isQuotaExceeded?: boolean;
  /** Affiche le lien vers la bibliothèque documentaire — réservé à `ai.manage_documents`. */
  canManageDocuments?: boolean;
  suggestions: readonly AiSuggestion[];
  searchHistory?: readonly AiSearchHistoryItem[];
  onSendMessage: (text: string) => void;
  onExecuteAction: (actionId: string, confirmed: boolean) => void;
  onClear: () => void;
  onSelectSuggestion: (suggestion: AiSuggestion) => void;
  onSelectSearchHistory?: (query: string) => void;
  onRemoveSearchHistoryItem?: (id: string) => void;
  onClearSearchHistory?: () => void;
}

export function AiChatBox({
  messages,
  isGenerating,
  error,
  isDegraded = null,
  isQuotaExceeded = false,
  canManageDocuments = false,
  suggestions,
  searchHistory = [],
  onSendMessage,
  onExecuteAction,
  onClear,
  onSelectSuggestion,
  onSelectSearchHistory,
  onRemoveSearchHistoryItem,
  onClearSearchHistory,
}: AiChatBoxProps) {
  const [input, setInput] = useState('');
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSelectHistory = (query: string) => {
    if (onSelectSearchHistory) {
      onSelectSearchHistory(query);
    } else {
      onSendMessage(query);
    }
  };

  return (
    <div className="bg-background text-foreground relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* Barre supérieure minimale & discrète (fixée en haut) */}
      <div className="border-border bg-surface/95 z-10 flex shrink-0 items-center justify-between border-b px-3 py-2 text-xs backdrop-blur-xs sm:px-4">
        <div className="flex items-center gap-2">
          <div className="text-foreground flex items-center gap-1.5 font-bold">
            {/* La pastille dit l'état réel de la liaison. Verte et clignotante
                alors que rien n'est branché, elle affirmait une connexion. */}
            <span
              className={cn(
                'size-2 rounded-full',
                isDegraded === true ? 'bg-warning' : 'bg-success animate-pulse',
              )}
            />
            <span className="truncate">Assistant REZO360 IA</span>
          </div>
          <span className="border-border bg-surface-hover text-3xs text-muted-foreground hidden rounded-md border px-1.5 py-0.5 font-medium sm:inline-block">
            {isDegraded === true ? 'Non relié aux données' : 'Lecture seule · Sécurisé'}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Bibliothèque documentaire — réservée à ai.manage_documents */}
          {canManageDocuments && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-surface-hover hover:text-foreground h-11 shrink-0 gap-1.5 rounded-lg px-2 text-xs sm:h-7"
              title="Gérer les documents de l’assistant"
            >
              <Link to={ROUTES.aiAssistantDocuments}>
                <FileText className="text-primary size-3.5" />
                <span className="hidden sm:inline">Documents</span>
              </Link>
            </Button>
          )}

          {/* Bouton Historique des recherches */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="text-muted-foreground hover:bg-surface-hover hover:text-foreground relative h-11 shrink-0 gap-1.5 rounded-lg px-2 text-xs sm:h-7"
            title="Consulter l'historique des recherches"
            aria-label="Historique des recherches"
          >
            <History className="text-primary size-3.5" />
            <span className="hidden sm:inline">Historique</span>
            {searchHistory.length > 0 && (
              <span className="bg-primary/15 text-primary flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                {searchHistory.length}
              </span>
            )}
          </Button>

          {/* Bouton Nouvelle discussion */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isGenerating || messages.length <= 1}
            className="text-muted-foreground hover:bg-surface-hover hover:text-foreground h-11 shrink-0 rounded-lg px-2 text-xs sm:h-7"
            title="Réinitialiser la conversation"
          >
            <RotateCcw className="mr-1 size-3" />
            <span className="hidden sm:inline">Nouvelle discussion</span>
          </Button>
        </div>
      </div>

      {/* Flux de messages défilant (absorbe la hauteur et défile indépendamment) */}
      <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
          {/* Dit une fois, en haut du fil, ce que les réponses répètent : rien
              de ce qui suit n'a été lu dans les données de l'organisation. */}
          {isQuotaExceeded ? (
            <div className="border-error-border bg-error-subtle text-foreground flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs">
              <TrendingUp className="text-error mt-0.5 size-4 shrink-0" />
              <div className="space-y-2">
                <div>
                  <p className="font-semibold">Quota mensuel de l’Assistant IA atteint</p>
                  <p className="text-muted-foreground mt-0.5">
                    Il sera réinitialisé le mois prochain. Passez à une formule supérieure pour
                    obtenir davantage de requêtes dès maintenant.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to={ROUTES.organizationBilling}>
                    <TrendingUp className="size-3.5" />
                    Voir les formules
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            isDegraded === true && (
              <div className="border-warning/40 bg-warning-subtle text-foreground flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs">
                <PlugZap className="text-warning mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">L’assistant n’est pas encore relié à vos données</p>
                  <p className="text-muted-foreground mt-0.5">
                    Il peut vous orienter vers le bon module et vous proposer des trames, mais il ne
                    lit ni vos interventions, ni votre parc, ni votre planning. Aucun chiffre
                    ci-dessous ne provient de votre organisation.
                  </p>
                </div>
              </div>
            )
          )}

          {messages.map((message) => (
            <AiMessageItem key={message.id} message={message} onExecuteAction={onExecuteAction} />
          ))}

          {isGenerating && (
            <div className="text-muted-foreground flex items-center gap-2.5 pl-1 text-xs">
              <Loader2 className="text-primary size-4 animate-spin" />
              <span>L’assistant génère une réponse…</span>
            </div>
          )}

          {error && (
            <div className="border-error-border bg-error-subtle text-error rounded-2xl border p-3.5 text-xs">
              <p className="font-semibold">Erreur de traitement</p>
              <p className="mt-0.5">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Barre de recherche / saisie TOUJOURS visible (shrink-0 & fixée en bas) */}
      <div className="from-background via-background/95 z-10 w-full shrink-0 bg-gradient-to-t to-transparent px-3 pt-2 pb-2 sm:px-4 sm:pb-3">
        <div className="mx-auto max-w-3xl space-y-2">
          {/* Suggestions rapides & Recherches récentes si début de discussion */}
          {messages.length <= 2 && (
            <div className="space-y-2 pb-0.5">
              {/* Recherches récentes avec suppression rapide */}
              {searchHistory.length > 0 && onRemoveSearchHistoryItem && (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {searchHistory.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="group border-border bg-surface hover:bg-surface-hover text-2xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 shadow-2xs transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectHistory(item.query)}
                        className="hover:text-primary inline-flex cursor-pointer items-center gap-1 transition-colors"
                      >
                        <History className="text-subtle-foreground size-3 shrink-0" />
                        <span className="max-w-[150px] truncate sm:max-w-[200px]">
                          {item.query}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSearchHistoryItem(item.id);
                        }}
                        className="text-subtle-foreground hover:bg-error-subtle hover:text-error ml-0.5 flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors sm:size-6"
                        title="Supprimer cette recherche"
                        aria-label="Supprimer cette recherche"
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions génériques */}
              <AiSuggestionChips
                suggestions={suggestions}
                onSelect={onSelectSuggestion}
                disabled={isGenerating || isQuotaExceeded}
              />
            </div>
          )}

          {/* Pilule de saisie flottante arrondie (adaptée au thème) */}
          <form
            onSubmit={handleSubmit}
            className="group border-border bg-surface shadow-raised focus-within:border-primary focus-within:ring-primary/20 relative flex items-end gap-1.5 rounded-[26px] border p-1.5 pl-3 transition-[border-color,box-shadow] duration-200 focus-within:ring-2 sm:gap-2 sm:p-2 sm:pl-3"
          >
            {/* Champ de texte expansible */}
            <div className="relative flex-1 py-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isQuotaExceeded
                    ? 'Quota mensuel atteint — réessayez le mois prochain'
                    : 'Poser une question sur vos interventions, matériels, missions ou planning…'
                }
                rows={1}
                disabled={isGenerating || isQuotaExceeded}
                className="text-foreground placeholder:text-subtle-foreground max-h-[120px] w-full resize-none border-none bg-transparent p-0 text-xs leading-relaxed focus:ring-0 focus:outline-none sm:text-sm"
              />
            </div>

            {/* Bouton d'envoi circulaire */}
            <button
              type="submit"
              disabled={!input.trim() || isGenerating || isQuotaExceeded}
              className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-surface-hover disabled:text-subtle-foreground flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[color,background-color,transform] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:size-8"
              title="Envoyer le message"
              aria-label="Envoyer"
            >
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin sm:size-4" />
              ) : (
                <ArrowUp className="size-3.5 sm:size-4" />
              )}
            </button>
          </form>

          {/* Mention légale discrète */}
          <div className="text-3xs text-subtle-foreground flex items-start justify-center gap-1.5 text-center leading-snug sm:text-xs">
            <ShieldCheck className="text-subtle-foreground size-3 shrink-0" />
            <span>
              L’IA REZO360 peut faire des erreurs. Vérifiez les informations opérationnelles
              importantes.
            </span>
          </div>
        </div>
      </div>

      {/* Tiroir d'historique des recherches avec possibilité de suppression */}
      <AiSearchHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        history={searchHistory}
        onSelectSearch={handleSelectHistory}
        onRemoveItem={onRemoveSearchHistoryItem ?? (() => {})}
        onClearAll={onClearSearchHistory ?? (() => {})}
      />
    </div>
  );
}
