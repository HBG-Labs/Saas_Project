export interface HistoryEntry {
  id: string;
  toolSlug: string;
  toolTitle: string;
  expression: string;
  formattedResult: string;
  timestamp: number; // Date.now()
}

/**
 * `PlanTier` et `PLAN_HISTORY_LIMITS` ont été retirés d'ici.
 *
 * Deux vocabulaires de plans coexistaient — `'team'` dans cette feature et dans
 * la page de tarifs, `'business'` en base et dans `features/billing`. Un plan
 * `'team'` remonté du serveur serait retombé silencieusement sur `free`, faisant
 * perdre ses droits à un abonné sans le moindre message.
 *
 * Plus grave : la limite était choisie ici à partir d'un état local que
 * l'interface pouvait modifier. Le quota d'historique vient désormais de
 * `useUserEntitlements`, donc de la table `subscriptions`, fermée en écriture au
 * client.
 *
 * Source unique du vocabulaire : `features/billing/entitlements.ts`.
 */
