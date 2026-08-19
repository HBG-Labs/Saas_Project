import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/config/routes';
import { useCurrentOrganization } from '@/features/organizations';

import { DEFAULT_AI_SUGGESTIONS, sendAiQuery } from '../services/ai.service';
import type { AiMessage, AiSuggestion } from '../types/ai.types';

import { useAiSearchHistory } from './useAiSearchHistory';

// Volontairement formulé en « vous orienter » et non « analyser vos données » :
// tant que l'Edge Function n'est pas déployée, l'assistant ne lit rien. Une
// salutation qui promet l'analyse serait démentie dès la première question.
const INITIAL_GREETING: AiMessage = {
  id: 'msg-init',
  role: 'assistant',
  content:
    `Bonjour ! Je suis l’**Assistant IA de REZO360**.\n\n` +
    `Je peux vous orienter dans vos interventions, votre parc matériel et votre planning, ` +
    `et vous aider à préparer vos comptes-rendus techniques. Que souhaitez-vous savoir ?`,
  timestamp: new Date().toISOString(),
};

export function useAiAssistant() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? 'default-org';
  const navigate = useNavigate();

  const [messages, setMessages] = useState<AiMessage[]>([INITIAL_GREETING]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `null` tant qu'aucune question n'a été posée : on ne sait pas encore si le
  // backend répond, et afficher un avertissement avant de le savoir serait
  // aussi faux que de ne jamais l'afficher.
  const [isDegraded, setIsDegraded] = useState<boolean | null>(null);

  const {
    history: searchHistory,
    addEntry: addSearchEntry,
    removeEntry: removeSearchHistoryItem,
    clearHistory: clearSearchHistory,
  } = useAiSearchHistory(organizationId);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      addSearchEntry(trimmed);

      const userMsg: AiMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsGenerating(true);
      setError(null);

      try {
        const response = await sendAiQuery({
          organizationId,
          query: trimmed,
          history: [...messages, userMsg],
        });

        const assistantMsg: AiMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString(),
          ...(response.actions !== undefined ? { suggestedActions: response.actions } : {}),
          ...(response.sources !== undefined ? { sources: response.sources } : {}),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsDegraded(response.degraded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue lors du traitement.');
      } finally {
        setIsGenerating(false);
      }
    },
    [addSearchEntry, isGenerating, messages, organizationId],
  );

  const executeAction = useCallback(
    (actionId: string, confirmed = true) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg.suggestedActions) return msg;
          const updatedActions = msg.suggestedActions.map((act) => {
            if (act.id !== actionId) return act;
            return {
              ...act,
              status: confirmed ? ('completed' as const) : ('rejected' as const),
            };
          });
          return { ...msg, suggestedActions: updatedActions };
        }),
      );

      // Traitement des redirections d'actions sécurisées
      const targetAction = messages
        .flatMap((m) => m.suggestedActions ?? [])
        .find((a) => a.id === actionId);

      if (targetAction && confirmed) {
        switch (targetAction.actionType) {
          case 'view_late_interventions':
            void navigate(ROUTES.review);
            break;
          case 'view_planning':
            void navigate(ROUTES.planning);
            break;
          case 'check_equipment_alerts':
            void navigate(ROUTES.equipment);
            break;
          case 'summarize_week_missions':
            void navigate(ROUTES.analytics);
            break;
          case 'draft_intervention_report':
            void navigate(ROUTES.reports);
            break;
          default:
            break;
        }
      }
    },
    [messages, navigate],
  );

  const clearConversation = useCallback(() => {
    setMessages([INITIAL_GREETING]);
    setError(null);
    setIsDegraded(null);
  }, []);

  const selectSuggestion = useCallback(
    (suggestion: AiSuggestion) => {
      void sendMessage(suggestion.prompt);
    },
    [sendMessage],
  );

  return {
    messages,
    isGenerating,
    error,
    isDegraded,
    suggestions: DEFAULT_AI_SUGGESTIONS,
    searchHistory,
    sendMessage,
    executeAction,
    clearConversation,
    selectSuggestion,
    removeSearchHistoryItem,
    clearSearchHistory,
  };
}
