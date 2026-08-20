/**
 * Miroir typé du référentiel `industries`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN MIROIR PLUTÔT QU'UNE SIMPLE REQUÊTE
 *
 * Les codes de métier apparaissent dans le registre d'outils (`industry: 'hvac'`),
 * dans la navigation et dans les futurs packs métier. Ce sont des littéraux de
 * code, écrits à la main : ils doivent être typés, sans quoi une faute de frappe
 * produit un outil que personne ne verra jamais — et rien ne le signalera.
 *
 * Le libellé, l'icône et le vocabulaire, eux, viennent de la base : ils changent
 * sans redéploiement.
 *
 * `industries.test.ts` lit la migration SQL et échoue si cette liste diverge du
 * semis. Même garde-fou que `rbac.ts` et `entitlements.ts` : un miroir faux est
 * pire que pas de miroir, puisqu'il répond avec assurance.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const INDUSTRY_CODES = [
  'fiber_telecom',
  'hvac',
  'landscaping',
  'electrical',
  'plumbing',
  'heating',
  'pest_control',
  'cleaning',
  'home_care',
  'it_networks',
  'general',
] as const;

export type IndustryCode = (typeof INDUSTRY_CODES)[number];

/**
 * Métier appliqué quand l'organisation n'en déclare aucun.
 *
 * `general` donne accès au cœur entier sans spécialisation. Ce n'est pas un
 * état dégradé : c'est le choix honnête d'une entreprise dont le métier n'est
 * pas encore outillé.
 */
export const DEFAULT_INDUSTRY: IndustryCode = 'general';

export function isIndustryCode(value: unknown): value is IndustryCode {
  return typeof value === 'string' && (INDUSTRY_CODES as readonly string[]).includes(value);
}

/**
 * Vocabulaire d'un métier.
 *
 * Trois clés seulement, et c'est volontaire. Chaque terme ajouté ici doit être
 * traduit dans les onze métiers : la liste doit rester celle des mots qui
 * changent VRAIMENT d'un corps de métier à l'autre. « Client », « site » ou
 * « devis » se disent partout pareil.
 */
export interface IndustryVocabulary {
  /** Celui qui intervient : technicien, frigoriste, jardinier… */
  worker: string;
  /** L'unité de travail vendue : mission, chantier, prestation. */
  job: string;
  /** Le déplacement sur place : intervention, passage, visite. */
  visit: string;
}

export const DEFAULT_VOCABULARY: IndustryVocabulary = {
  worker: 'Intervenant',
  job: 'Mission',
  visit: 'Intervention',
};

/**
 * Pluriel d'un terme métier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN « s » SUFFIT — POUR L'INSTANT
 *
 * Les trente-trois termes semés sont tous des pluriels réguliers : technicien,
 * frigoriste, jardinier, chantier, prestation, passage, visite… Stocker
 * trente-trois formes plurielles en base pour ajouter un « s » serait une
 * cérémonie sans objet.
 *
 * Mais la règle française ne tient pas toujours — « travaux » est déjà pluriel,
 * un terme en -al ferait -aux. Le jour où un métier en apportera un, sa clé
 * `<terme>_plural` dans `industries.vocabulary` prendra le dessus, sans
 * migration de schéma ni changement ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function pluralize(singular: string, override?: string): string {
  if (override !== undefined && override !== '') return override;
  if (singular === '') return singular;

  // Un mot déjà terminé par s, x ou z est invariable.
  return /[sxz]$/i.test(singular) ? singular : `${singular}s`;
}

const FEMININE_NOUNS = new Set([
  'mission',
  'prestation',
  'visite',
  'intervention',
  'installation',
  'expertise',
  'maintenance',
  'demande',
]);

export function isFeminineNoun(noun: string): boolean {
  if (!noun) return false;
  const lower = noun.toLowerCase().trim();
  return (
    FEMININE_NOUNS.has(lower) ||
    lower.endsWith('tion') ||
    lower.endsWith('sion') ||
    lower.endsWith('ite')
  );
}

/**
 * Accorde « Nouveau » / « Nouvelle » avec le terme métier (ex: « Nouvelle mission », « Nouveau chantier »).
 */
export function formatNewNoun(noun: string): string {
  if (!noun) return 'Nouveau';
  const lower = noun.toLowerCase().trim();
  return isFeminineNoun(noun) ? `Nouvelle ${lower}` : `Nouveau ${lower}`;
}

/**
 * Accorde « Aucun » / « Aucune » avec le terme métier et son qualificatif optionnel.
 * Exemples :
 * - formatNoneNoun('mission', 'planifié') => "Aucune mission planifiée"
 * - formatNoneNoun('chantier', 'planifié') => "Aucun chantier planifié"
 * - formatNoneNoun('mission', 'en cours') => "Aucune mission en cours"
 * - formatNoneNoun('mission') => "Aucune mission"
 */
export function formatNoneNoun(
  noun: string,
  stateEnding?: 'planifié' | 'attribué' | 'enregistré' | 'en cours' | 'trouvé',
): string {
  if (!noun) return 'Aucun';
  const lower = noun.toLowerCase().trim();
  const fem = isFeminineNoun(noun);
  const prefix = fem ? `Aucune ${lower}` : `Aucun ${lower}`;
  if (!stateEnding) return prefix;
  if (stateEnding === 'en cours') return `${prefix} en cours`;
  const agreedState = fem ? `${stateEnding}e` : stateEnding;
  return `${prefix} ${agreedState}`;
}
