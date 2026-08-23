/**
 * Types du module Assistant REZO360 IA.
 *
 * Conçu pour interfacer un futur backend IA (Edge Function sécurisée) tout en
 * fournissant une structure typée rigide pour l'UI, le streaming de réponses et
 * la validation humaine des actions sensibles.
 */

export type AiRole = 'user' | 'assistant' | 'system';

export type AiActionType =
  | 'view_late_interventions'
  | 'check_equipment_alerts'
  | 'summarize_week_missions'
  | 'draft_intervention_report'
  | 'view_planning'
  | 'navigate_route'
  | 'view_missions'
  | 'view_members'
  | 'view_technicians'
  | 'view_teams'
  | 'view_stock'
  | 'view_equipment'
  | 'view_vehicles'
  | 'view_suppliers'
  | 'view_purchases'
  | 'view_quotes'
  | 'view_customers'
  | 'view_analytics'
  | 'view_billing'
  | 'view_tools';

export interface AiProposedAction {
  id: string;
  title: string;
  description: string;
  actionType: AiActionType;
  payload?: Record<string, unknown>;
  /**
   * RÈGLE DE SÉCURITÉ : Toute action modificatrice ou sensible exige une
   * confirmation explicite de l'utilisateur dans l'interface avant exécution.
   */
  requiresConfirmation: boolean;
  status: 'idle' | 'executing' | 'completed' | 'rejected';
}

export interface AiMessage {
  id: string;
  role: AiRole;
  content: string;
  timestamp: string;
  suggestedActions?: AiProposedAction[];
  sources?: string[];
}

export interface AiSuggestion {
  id: string;
  label: string;
  category: 'interventions' | 'stock' | 'planning' | 'reports';
  prompt: string;
}

export interface AiSearchHistoryItem {
  id: string;
  query: string;
  timestamp: string;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  messages: AiMessage[];
}
