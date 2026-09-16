import type { ProspectMessageTemplate } from '../api/prospecting.api';

/**
 * Préparation du brouillon de message (Phase 8, §17-18 du cahier des
 * charges). Fonctions PURES, testées isolément : la personnalisation ne doit
 * jamais dépendre d'une donnée non vérifiée, et ce fichier est le seul
 * endroit où le texte final est assemblé — jamais construit à la main dans
 * un composant.
 *
 * RÈGLES ABSOLUES (§17, §25) :
 *   - jamais « nous avons détecté votre entreprise dans SIRENE » ;
 *   - jamais un ton intrusif ou de surveillance ;
 *   - l'ouverture « félicitations pour le lancement » n'apparaît QUE si la
 *     date de création réelle le permet raisonnablement (< 6 mois) ;
 *   - aucune fonctionnalité n'est citée si elle n'est pas dans `features` —
 *     jamais une liste générée à la volée ou complétée par ce fichier.
 */

const RECENT_CREATION_MONTHS = 6;

/** « a » · « a et b » · « a, b et c ». Jamais une simple concaténation par virgules. */
export function joinFrench(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

export function isRecentCreation(createdOn: string | null, now: Date = new Date()): boolean {
  if (createdOn === null) return false;
  const created = new Date(createdOn);
  if (Number.isNaN(created.getTime())) return false;

  const months =
    (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  return months <= RECENT_CREATION_MONTHS;
}

export interface ProspectMessageInput {
  createdOn: string | null;
  commune: string | null;
  template: Pick<ProspectMessageTemplate, 'opening_variant' | 'features' | 'body_template'>;
  now?: Date;
}

export function buildProspectMessageDraft({ createdOn, commune, template, now }: ProspectMessageInput): string {
  const opening =
    isRecentCreation(createdOn, now) && template.opening_variant
      ? `${template.opening_variant}\n\n`
      : '';

  const body = template.body_template
    .replaceAll('{{FEATURES}}', joinFrench(template.features))
    .replaceAll('{{TERRITOIRE}}', commune ? ` à ${commune}` : '');

  return `Bonjour,\n\n${opening}${body}\n\nVous pouvez découvrir la plateforme sur REZO360.com.`;
}
