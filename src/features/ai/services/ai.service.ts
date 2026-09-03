import { supabase } from '@/services/supabase';

import type { AiMessage, AiProposedAction, AiSuggestion } from '../types/ai.types';

export const DEFAULT_AI_SUGGESTIONS: readonly AiSuggestion[] = [
  {
    id: 'sug-late',
    label: 'Quelles interventions sont en retard ?',
    category: 'interventions',
    prompt: 'Quelles interventions sont actuellement en retard ou nécessitent une attention urgente ?',
  },
  {
    id: 'sug-stock',
    label: 'Quels articles/matériels sont en alerte ?',
    category: 'stock',
    prompt: 'Quels matériels ou outillages ont un statut en révision ou nécessitent un contrôle ?',
  },
  {
    id: 'sug-summary',
    label: 'Résume les interventions de cette semaine',
    category: 'planning',
    prompt: 'Fais-moi un résumé synthétique des interventions et missions planifiées cette semaine.',
  },
  {
    id: 'sug-report',
    label: 'Prépare un compte-rendu pour une intervention',
    category: 'reports',
    prompt: 'Aide-moi à préparer la trame d’un compte-rendu d’intervention technique.',
  },
] as const;

export interface AiQueryResult {
  content: string;
  actions?: AiProposedAction[];
  sources?: string[];
  /** Conversation serveur à reprendre pour le message suivant du même fil. */
  conversationId?: string;
  /**
   * Vrai quand l'Edge Function `ai-assistant` n'a pas répondu et que la réponse
   * vient du mode dégradé local.
   *
   * Ce drapeau EXISTE pour être affiché. Tant qu'il est vrai, l'assistant n'a
   * lu aucune donnée de l'organisation : le taire reviendrait à laisser croire
   * le contraire.
   */
  degraded: boolean;
  /**
   * Vrai quand la formule a bien l'Assistant IA, mais que le quota mensuel de
   * l'organisation est épuisé. Distinct de `degraded` : ce n'est pas une panne,
   * c'est une réponse serveur explicite — un mode dégradé la présenterait à
   * tort comme « pas encore relié aux données ».
   */
  quotaExceeded?: boolean;
}

/**
 * Envoie un message à l'assistant IA.
 *
 * Interroge l'Edge Function `ai-assistant`, seule à disposer d'un accès serveur
 * aux données de l'organisation. Tant qu'elle n'est pas déployée, on répond en
 * mode dégradé : on ORIENTE vers le module qui détient la réponse, sans jamais
 * énoncer de chiffre ni d'état qu'on n'a pas lu.
 */
export async function sendAiQuery(params: {
  organizationId: string;
  query: string;
  history: AiMessage[];
  /** Reprend une conversation déjà commencée — absent au premier message. */
  conversationId?: string;
}): Promise<AiQueryResult> {
  try {
    const response: {
      data: {
        content?: string;
        actions?: AiProposedAction[];
        sources?: string[];
        conversationId?: string;
      } | null;
      error: unknown;
    } = await supabase.functions.invoke<{
      content: string;
      actions?: AiProposedAction[];
      sources?: string[];
      conversationId?: string;
    }>('ai-assistant', {
      body: {
        organizationId: params.organizationId,
        query: params.query,
        history: params.history.map((m) => ({ role: m.role, content: m.content })),
        ...(params.conversationId ? { conversationId: params.conversationId } : {}),
      },
    });

    if (response.error === null && response.data?.content) {
      return {
        content: response.data.content,
        ...(response.data.actions !== undefined ? { actions: response.data.actions } : {}),
        ...(response.data.sources !== undefined ? { sources: response.data.sources } : {}),
        ...(response.data.conversationId !== undefined
          ? { conversationId: response.data.conversationId }
          : {}),
        degraded: false,
      };
    }

    // Le quota épuisé est une réponse SERVEUR EXPLICITE, pas une panne : elle
    // ne doit pas tomber dans le mode dégradé ci-dessous, qui laisserait
    // croire à une fonction injoignable plutôt qu'à un plafond atteint pour de
    // bon. `functions.invoke` ne remonte le corps de la réponse que via
    // `error.context` (une `Response`), jamais dans `data`, sur un statut
    // non-2xx — même lecture que `sendInvitationEmail`.
    if (response.error) {
      const context: unknown = (response.error as { context?: unknown }).context;
      if (context instanceof Response) {
        try {
          const body = (await context.clone().json()) as { error?: string; message?: string };
          if (body.error === 'AI_QUOTA_EXCEEDED') {
            return {
              content:
                body.message ??
                "Vous avez atteint votre quota mensuel d'utilisation de l'Assistant IA.",
              quotaExceeded: true,
              degraded: false,
            };
          }
        } catch {
          // Réponse non-JSON (502 d'infrastructure, coupure) : on bascule sur
          // le mode dégradé, la meilleure information restante.
        }
      }
    }
  } catch {
    // Fonction absente ou injoignable : on bascule sur le mode dégradé.
  }

  return buildDegradedResponse(params.query);
}

/**
 * Réponse locale, sans accès aux données.
 *
 * Chaque branche fait la même chose : nommer ce que la question demande, dire
 * que l'assistant ne peut pas encore le lire, et proposer d'ouvrir le module où
 * la donnée se trouve réellement. Les actions renvoyées naviguent pour de bon —
 * c'est la seule chose que ce mode sache faire, et il ne prétend pas davantage.
 *
 * Aucune de ces réponses ne cite de chiffre. La version précédente en annonçait
 * (« 2 interventions en retard », « 3 rapports en attente », « 92 % ») et les
 * attribuait à « Base de données PostgreSQL » : des montants inventés présentés
 * comme lus en base, sur des décisions d'exploitation.
 */
function buildDegradedResponse(query: string): Promise<AiQueryResult> {
  const q = query.toLowerCase();

  return new Promise((resolve) => {
    setTimeout(() => {
      if (q.includes('retard') || q.includes('urgent') || q.includes('bloqu')) {
        resolve({
          content:
            `### Interventions à contrôler\n\n` +
            `Je ne suis pas encore relié aux données de votre organisation : je ne peux donc ` +
            `pas vous dire combien d'interventions sont en retard, ni lesquelles.\n\n` +
            `La file de contrôle liste les interventions dont l'échéance est passée sans ` +
            `compte-rendu validé, et le planning montre les créneaux réassignables.`,
          actions: [
            {
              id: `act-${Date.now()}-1`,
              title: 'Ouvrir la file des interventions à contrôler',
              description: 'Affiche les interventions en attente de validation.',
              actionType: 'view_late_interventions',
              requiresConfirmation: false,
              status: 'idle',
            },
            {
              id: `act-${Date.now()}-2`,
              title: 'Ouvrir le planning de la semaine',
              description: 'Affiche le planning d’équipe pour réassigner les créneaux.',
              actionType: 'view_planning',
              requiresConfirmation: false,
              status: 'idle',
            },
          ],
          degraded: true,
        });
        return;
      }

      if (
        q.includes('matériel') ||
        q.includes('materiel') ||
        q.includes('stock') ||
        q.includes('outillage') ||
        q.includes('rupture')
      ) {
        resolve({
          content:
            `### Parc matériel & véhicules\n\n` +
            `Je ne peux pas encore lire l'état de votre parc : je ne sais donc pas quels ` +
            `équipements sont en révision ni quelles échéances approchent.\n\n` +
            `Le module Parc matériel affiche les statuts et les dates de prochain contrôle ; ` +
            `le module Véhicules fait de même pour les contrôles techniques.`,
          actions: [
            {
              id: `act-${Date.now()}-3`,
              title: 'Ouvrir le parc matériel & outillage',
              description: 'Affiche les statuts et les échéances d’étalonnage.',
              actionType: 'check_equipment_alerts',
              requiresConfirmation: false,
              status: 'idle',
            },
          ],
          degraded: true,
        });
        return;
      }

      if (
        q.includes('résum') ||
        q.includes('resum') ||
        q.includes('semaine') ||
        q.includes('synthèse') ||
        q.includes('synthese')
      ) {
        resolve({
          content:
            `### Synthèse de la semaine\n\n` +
            `Une synthèse suppose de lire vos missions, et je n'y ai pas encore accès. ` +
            `Je préfère ne rien avancer plutôt que d'avancer des chiffres que je n'ai pas.\n\n` +
            `Le module Statistiques & performances calcule ces indicateurs à partir de vos ` +
            `données réelles.`,
          actions: [
            {
              id: `act-${Date.now()}-4`,
              title: 'Ouvrir les statistiques & performances',
              description: 'Affiche les métriques calculées sur vos données.',
              actionType: 'summarize_week_missions',
              requiresConfirmation: false,
              status: 'idle',
            },
          ],
          degraded: true,
        });
        return;
      }

      // La seule réponse que ce mode produise vraiment : une trame générique,
      // qui n'affirme rien sur l'organisation et reste donc valable hors ligne.
      if (
        q.includes('compte-rendu') ||
        q.includes('rapport') ||
        q.includes('trame') ||
        q.includes('rédig') ||
        q.includes('redig')
      ) {
        resolve({
          content:
            `### Trame de compte-rendu technique\n\n` +
            `Une structure de départ, à adapter à votre intervention :\n\n` +
            `1. **Contexte & constat initial** : état des installations à l'arrivée.\n` +
            `2. **Opérations effectuées** : mesures, câblage, raccordements, tests de continuité.\n` +
            `3. **Résultats des mesures** : valeurs relevées et conformité attendue.\n` +
            `4. **Conclusion & validation** : réserves éventuelles, signature client, photos horodatées.\n\n` +
            `Cette trame est générique : elle ne tient pas compte de votre intervention, ` +
            `que je ne peux pas encore consulter.`,
          actions: [
            {
              id: `act-${Date.now()}-5`,
              title: 'Ouvrir les comptes-rendus',
              description: 'Affiche le module de rédaction des comptes-rendus.',
              actionType: 'draft_intervention_report',
              requiresConfirmation: false,
              status: 'idle',
            },
          ],
          degraded: true,
        });
        return;
      }

      resolve({
        content:
          `Je n'ai pas encore accès aux données de votre organisation : je ne peux donc ` +
          `pas répondre sur vos interventions, votre parc ou votre planning.\n\n` +
          `Ce que je sais faire dès maintenant :\n` +
          `* Vous amener directement au module qui détient la réponse.\n` +
          `* Vous proposer une trame de compte-rendu d'intervention.\n\n` +
          `Les réponses appuyées sur vos données arriveront avec la connexion de l'assistant.`,
        degraded: true,
      });
    }, 600);
  });
}
