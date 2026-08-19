import {
  ArrowUp,
  History,
  Loader2,
  Plus,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

import type {
  AiMessage,
  AiSearchHistoryItem,
  AiSuggestion,
} from '../types/ai.types';

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
    <div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      {/* Barre supérieure minimale & discrète (fixée en haut) */}
      <div className="shrink-0 flex items-center justify-between border-b border-border px-3 sm:px-4 py-2 text-xs bg-surface/95 backdrop-blur-xs z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
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
          <span className="hidden sm:inline-block rounded-md border border-border bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {isDegraded === true ? 'Non relié aux données' : 'Lecture seule · Sécurisé'}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Bouton Historique des recherches */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="relative h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover px-2 rounded-lg shrink-0 gap-1.5"
            title="Consulter l'historique des recherches"
            aria-label="Historique des recherches"
          >
            <History className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Historique</span>
            {searchHistory.length > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
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
            className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover px-2 rounded-lg shrink-0"
            title="Réinitialiser la conversation"
          >
            <RotateCcw className="size-3 mr-1" />
            <span className="hidden sm:inline">Nouvelle discussion</span>
          </Button>
        </div>
      </div>

      {/* Flux de messages défilant (absorbe la hauteur et défile indépendamment) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 scroll-smooth">
        <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
          {/* Dit une fois, en haut du fil, ce que les réponses répètent : rien
              de ce qui suit n'a été lu dans les données de l'organisation. */}
          {isDegraded === true && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-warning/40 bg-warning-subtle p-3.5 text-xs text-foreground">
              <PlugZap className="size-4 shrink-0 text-warning mt-0.5" />
              <div>
                <p className="font-semibold">L’assistant n’est pas encore relié à vos données</p>
                <p className="mt-0.5 text-muted-foreground">
                  Il peut vous orienter vers le bon module et vous proposer des trames, mais il ne
                  lit ni vos interventions, ni votre parc, ni votre planning. Aucun chiffre ci-dessous
                  ne provient de votre organisation.
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <AiMessageItem
              key={message.id}
              message={message}
              onExecuteAction={onExecuteAction}
            />
          ))}

          {isGenerating && (
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground pl-1">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>L’assistant génère une réponse…</span>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-error-border bg-error-subtle p-3.5 text-xs text-error">
              <p className="font-semibold">Erreur de traitement</p>
              <p className="mt-0.5">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Barre de recherche / saisie TOUJOURS visible (shrink-0 & fixée en bas) */}
      <div className="shrink-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-2 pb-2 sm:pb-3 px-3 sm:px-4 z-10">
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
                      className="group inline-flex items-center gap-1 rounded-full border border-border bg-surface hover:bg-surface-hover px-2.5 py-1 text-2xs text-muted-foreground hover:text-foreground shadow-2xs transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectHistory(item.query)}
                        className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                      >
                        <History className="size-3 text-subtle-foreground shrink-0" />
                        <span className="truncate max-w-[150px] sm:max-w-[200px]">
                          {item.query}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSearchHistoryItem(item.id);
                        }}
                        className="flex size-3.5 items-center justify-center rounded-full text-subtle-foreground hover:bg-error-subtle hover:text-error transition-colors ml-0.5 cursor-pointer"
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
                disabled={isGenerating}
              />
            </div>
          )}

          {/* Pilule de saisie flottante arrondie (adaptée au thème) */}
          <form
            onSubmit={handleSubmit}
            className="group relative flex items-end gap-1.5 sm:gap-2 rounded-[26px] border border-border bg-surface shadow-raised p-1.5 sm:p-2 pl-2.5 sm:pl-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200"
          >
            {/* Bouton d'action / options */}
            <button
              type="button"
              className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full text-subtle-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
              title="Ajouter un contexte ou une intervention"
              aria-label="Options"
            >
              <Plus className="size-4" />
            </button>

            {/* Champ de texte expansible */}
            <div className="relative flex-1 py-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Poser une question sur vos interventions, matériels, missions ou planning…"
                rows={1}
                disabled={isGenerating}
                className="w-full resize-none border-none bg-transparent p-0 text-xs sm:text-sm text-foreground placeholder:text-subtle-foreground focus:outline-none focus:ring-0 leading-relaxed max-h-[120px]"
              />
            </div>

            {/* Bouton d'envoi circulaire */}
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover active:scale-95 disabled:opacity-30 disabled:bg-surface-hover disabled:text-subtle-foreground transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Envoyer le message"
              aria-label="Envoyer"
            >
              {isGenerating ? (
                <Loader2 className="size-3.5 sm:size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-3.5 sm:size-4" />
              )}
            </button>
          </form>

          {/* Mention légale discrète */}
          <div className="flex items-center justify-center gap-1.5 text-center text-[10px] sm:text-[11px] text-subtle-foreground">
            <ShieldCheck className="size-3 text-subtle-foreground shrink-0" />
            <span className="truncate">
              L’IA REZO360 peut faire des erreurs. Vérifiez les informations opérationnelles importantes.
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
