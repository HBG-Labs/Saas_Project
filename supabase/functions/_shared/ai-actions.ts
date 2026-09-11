import {
  AI_KNOWLEDGE_DOMAINS,
  selectKnowledgeDomains,
  type AiKnowledgeDomain,
} from './ai-domain-catalog.ts';
import { canAccessKnowledgeDomain, type AiCapabilities } from './ai-business-context.ts';

export interface ServerAiAction {
  id: string;
  title: string;
  description: string;
  actionType: string;
  requiresConfirmation: false;
  status: 'idle';
}

const ACTION_COPY: Record<string, { title: string; description: string }> = {
  view_members: {
    title: 'Annuaire des membres',
    description: 'Consulter les membres, leurs rôles et les invitations.',
  },
  view_teams: { title: 'Équipes', description: 'Consulter les équipes et leurs affectations.' },
  view_customers: {
    title: 'Répertoire clients',
    description: 'Consulter les clients, contacts et sites d’intervention.',
  },
  view_missions: { title: 'Missions', description: 'Consulter les missions et leurs statuts.' },
  view_late_interventions: {
    title: 'File de contrôle',
    description: 'Consulter les interventions et comptes rendus à contrôler.',
  },
  view_planning: {
    title: 'Planning',
    description: 'Consulter le planning, les congés et les disponibilités.',
  },
  view_stock: {
    title: 'Stock et mouvements',
    description: 'Consulter les quantités, seuils et mouvements de stock.',
  },
  view_equipment: {
    title: 'Parc matériel',
    description: 'Consulter les équipements, états et étalonnages.',
  },
  view_vehicles: {
    title: 'Véhicules',
    description: 'Consulter la flotte, les kilométrages et les entretiens.',
  },
  view_purchases: {
    title: 'Achats et commandes',
    description: 'Consulter les fournisseurs, commandes et réceptions.',
  },
  view_quotes: { title: 'Devis', description: 'Consulter les devis, lignes et échéances.' },
  view_invoices: {
    title: 'Factures et avoirs',
    description: 'Consulter les factures, règlements, taxes et avoirs.',
  },
  view_einvoicing: {
    title: 'Facturation électronique',
    description: 'Consulter la connexion PDP et les transmissions électroniques.',
  },
  view_documents: {
    title: 'Bibliothèque documentaire',
    description: 'Consulter les dossiers et documents de l’entreprise.',
  },
  view_ai_documents: {
    title: 'Documents de l’Assistant IA',
    description: 'Consulter l’état d’indexation des documents de l’assistant.',
  },
  view_notes: { title: 'Mon bloc-notes', description: 'Consulter vos notes personnelles.' },
  view_analytics: {
    title: 'Statistiques',
    description: 'Consulter les indicateurs calculés sur les données réelles.',
  },
  view_audit_log: {
    title: 'Journal d’activité',
    description: 'Consulter les actions enregistrées pour l’organisation.',
  },
  view_settings: {
    title: 'Préférences',
    description: 'Modifier vos préférences et notifications.',
  },
  view_tools: { title: 'Outils métier', description: 'Ouvrir le catalogue des outils.' },
  view_history: {
    title: 'Historique des outils',
    description: 'Consulter vos favoris et vos derniers calculs.',
  },
  view_tutorials: {
    title: 'Tutoriels et formation',
    description: 'Ouvrir les cours et reprendre votre progression.',
  },
  view_billing: {
    title: 'Abonnement et facturation',
    description: 'Consulter la formule, les quotas et les échéances.',
  },
};

function actionDomain(actionType: string): AiKnowledgeDomain | undefined {
  return AI_KNOWLEDGE_DOMAINS.find((domain) => domain.actionType === actionType);
}

export function buildAuthorizedActions(
  query: string,
  capabilities: AiCapabilities,
): ServerAiAction[] {
  const seen = new Set<string>();
  const actions: ServerAiAction[] = [];

  for (const domain of selectKnowledgeDomains(query)) {
    if (!domain.actionType || seen.has(domain.actionType)) continue;
    const canonicalDomain = actionDomain(domain.actionType) ?? domain;
    if (!canAccessKnowledgeDomain(canonicalDomain, capabilities)) continue;
    const copy = ACTION_COPY[domain.actionType];
    if (!copy) continue;

    seen.add(domain.actionType);
    actions.push({
      id: `act-${crypto.randomUUID()}`,
      ...copy,
      actionType: domain.actionType,
      requiresConfirmation: false,
      status: 'idle',
    });
  }

  return actions.slice(0, 3);
}

