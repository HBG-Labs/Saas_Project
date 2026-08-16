import type { IndustryCode } from '@/config/industries';

import type { ToolDefinition } from './types';

/**
 * Pertinence d'un outil pour un métier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI TRIER PLUTÔT QUE MASQUER
 *
 * La tentation est de ne montrer à un paysagiste que les outils du paysage.
 * Elle se heurte à deux faits.
 *
 * Le premier : les corps de métier se recouvrent. L'entreprise qui utilise
 * aujourd'hui ce produit se décrit elle-même comme « Ingénierie Réseaux, Fibre
 * Optique & Électricité BT » — filtrer strictement sur `fiber_telecom` lui
 * retirerait la loi d'Ohm, dont elle se sert. Une pertinence qui enlève un
 * outil utilisé est une régression, pas une amélioration.
 *
 * Le second : `/tools` est PUBLIC, consultable sans compte. C'est aussi une
 * vitrine. Un visiteur sans organisation n'a pas de métier ; lui montrer un
 * catalogue vide ou amputé serait absurde.
 *
 * D'où la règle : le métier ORDONNE le catalogue, il ne le tronque jamais. La
 * page propose de se restreindre — c'est un choix visible, réversible d'un
 * clic, et le nombre d'outils écartés est annoncé.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Un outil sans métier déclaré sert tout le monde : calculatrice, convertisseurs. */
export function isTransverseTool(tool: ToolDefinition): boolean {
  return tool.industry === undefined;
}

export function servesIndustry(tool: ToolDefinition, industry: IndustryCode): boolean {
  if (tool.industry === undefined) return true;
  if (typeof tool.industry === 'string') return tool.industry === industry;
  return tool.industry.includes(industry);
}

/**
 * Outils du métier d'abord, le reste ensuite.
 *
 * Tri STABLE : à pertinence égale, l'ordre reçu est conservé. Sans cette
 * garantie, le classement d'origine — qui place la calculatrice en tête —
 * serait défait à chaque changement de métier.
 */
export function sortByIndustryRelevance(
  tools: readonly ToolDefinition[],
  industry: IndustryCode,
): ToolDefinition[] {
  const relevant: ToolDefinition[] = [];
  const rest: ToolDefinition[] = [];

  for (const tool of tools) {
    (servesIndustry(tool, industry) ? relevant : rest).push(tool);
  }

  return [...relevant, ...rest];
}

/** Combien d'outils le métier écarterait-il, si l'on restreignait ? */
export function countOutsideIndustry(
  tools: readonly ToolDefinition[],
  industry: IndustryCode,
): number {
  return tools.filter((tool) => !servesIndustry(tool, industry)).length;
}
