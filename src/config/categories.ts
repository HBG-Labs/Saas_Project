/**
 * SOURCE UNIQUE DE VÉRITÉ des catégories du catalogue.
 *
 * Avant ce fichier, les catégories étaient déclarées à TROIS endroits :
 *   • `TOOL_CATEGORIES` dans features/tools/registry/types.ts (le type union)
 *   • `CATEGORY_METADATA` dans features/tools/catalog-metadata.ts (l'affichage)
 *   • le seed SQL dans supabase/migrations/
 *
 * Ajouter une catégorie imposait donc trois éditions synchronisées, dont l'une
 * finissait par être oubliée. Désormais tout dérive d'ici :
 *
 *     config/categories.ts  ──┬──►  registry/types.ts   (type ToolCategorySlug)
 *                             ├──►  catalog-metadata.ts (affichage)
 *                             └──►  seed SQL            (vérifié par test)
 *
 * La cohérence avec le SQL n'est pas laissée à la vigilance : `categories.test.ts`
 * lit le fichier de seed et compare slug, nom, description et ordre. Une
 * divergence casse `npm test`.
 *
 * Placé dans `config/` (couche la plus basse) : les features et les pages en
 * dépendent, l'inverse serait une inversion de couche.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AJOUTER UNE CATÉGORIE
 *   1. Ajouter l'entrée ci-dessous (slug en kebab-case, `sortOrder` multiple de 10).
 *   2. Ajouter l'icône correspondante dans components/ui/icons.ts.
 *   3. Ajouter la ligne dans le seed SQL (le test vous dira exactement laquelle).
 * Aucun autre fichier n'est à modifier.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CategoryDefinition {
  /** Identifiant stable, kebab-case. Jamais renommé : il est dans les URL. */
  readonly slug: string;
  readonly name: string;
  /** Texte long, affiché sur la page de catégorie. */
  readonly description: string;
  /** Texte court, affiché sur les cartes et dans les listes denses. */
  readonly shortDescription: string;
  /** Nom d'icône lucide, résolu par `TOOL_ICONS`. Une chaîne : le catalogue en base stocke la même valeur. */
  readonly icon: string;
  /** Classes de teinte, en tokens sémantiques uniquement (jamais de couleur brute). */
  readonly tint: string;
  /** Ordre d'affichage. Multiples de 10 pour pouvoir intercaler sans tout renuméroter. */
  readonly sortOrder: number;
}

/**
 * Les huit domaines techniques de NexoraTech.
 *
 * ⚠️ Les slugs `electrical`, `fiber-optics`, `networking` et `general`
 * PRÉEXISTENT et sont référencés par les `defineTool()` des outils déjà livrés
 * ainsi que par des URL publiques `/categories/<slug>`. Seuls leurs libellés
 * ont évolué. Les renommer casserait les liens existants sans bénéfice.
 */
export const CATEGORIES = [
  {
    slug: 'electrical',
    name: 'Électricité',
    description:
      "Loi d'Ohm, puissance, chute de tension, sections de câbles, protections et dimensionnement selon la norme NF C 15-100.",
    shortDescription: "Loi d'Ohm, puissance, tension, courant, résistance.",
    icon: 'zap',
    tint: 'bg-warning-subtle text-warning',
    sortOrder: 10,
  },
  {
    slug: 'fiber-optics',
    name: 'Fibre optique',
    description:
      "Codes couleur jusqu'à 3456 FO, bilans de liaison, budgets optiques, atténuation et conversions dBm/mW.",
    shortDescription: 'Codes couleur, bilans de liaison, atténuation, dBm/mW.',
    icon: 'cable',
    tint: 'bg-info-subtle text-info',
    sortOrder: 20,
  },
  {
    slug: 'telecom',
    name: 'Télécoms',
    description:
      "Bilans de liaison radio, calculs d'antennes, affaiblissement en espace libre, zones de Fresnel et budgets de puissance.",
    shortDescription: 'Liaisons radio, antennes, propagation, budgets de puissance.',
    icon: 'radio-tower',
    tint: 'bg-primary-subtle text-primary',
    sortOrder: 30,
  },
  {
    slug: 'networking',
    name: 'Réseaux & Informatique',
    description:
      "Adressage IPv4 et IPv6, CIDR, sous-réseaux, VLSM, masques, plages d'adresses et conversions binaires.",
    shortDescription: "IPv4, IPv6, CIDR, sous-réseaux, plages d'adresses.",
    icon: 'network',
    tint: 'bg-primary-subtle text-primary',
    sortOrder: 40,
  },
  {
    slug: 'mechanical',
    name: 'Mécanique',
    description:
      'Couples de serrage, transmissions, engrenages, résistance des matériaux, contraintes et facteurs de sécurité.',
    shortDescription: 'Couples, transmissions, engrenages, résistance des matériaux.',
    icon: 'cog',
    tint: 'bg-muted text-muted-foreground',
    sortOrder: 50,
  },
  {
    slug: 'hydraulics',
    name: 'Hydraulique',
    description:
      'Débits, pertes de charge, pressions, dimensionnement de conduites, pompes et vérins hydrauliques.',
    shortDescription: 'Débits, pertes de charge, pressions, conduites, pompes.',
    icon: 'droplets',
    tint: 'bg-info-subtle text-info',
    sortOrder: 60,
  },
  {
    slug: 'construction',
    name: 'BTP',
    description:
      'Métrés, volumes de béton, dosages, surfaces, pentes, terrassement et quantitatifs de chantier.',
    shortDescription: 'Métrés, béton, dosages, surfaces, pentes, terrassement.',
    icon: 'hard-hat',
    tint: 'bg-warning-subtle text-warning',
    sortOrder: 70,
  },
  {
    slug: 'general',
    name: 'Outils généraux',
    description:
      "Calculatrice scientifique, pourcentages, conversions d'unités, temps, distances et décibels.",
    shortDescription: "Calculatrice, pourcentages, conversions d'unités, temps.",
    icon: 'calculator',
    tint: 'bg-success-subtle text-success',
    sortOrder: 80,
  },
] as const satisfies readonly CategoryDefinition[];

/**
 * Union des slugs, dérivée du tableau — jamais réécrite à la main.
 *
 * `as const satisfies` ci-dessus est ce qui rend cette dérivation possible :
 * `satisfies` valide la forme sans élargir les littéraux, `as const` les fige.
 * Sans l'un ou l'autre, ce type retomberait sur `string` et le registry
 * accepterait n'importe quelle catégorie.
 */
export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

/** Liste des slugs, pour les validations à l'exécution. */
export const CATEGORY_SLUGS = CATEGORIES.map(
  (category) => category.slug,
) as readonly CategorySlug[];

export function getCategory(slug: string): CategoryDefinition | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function isCategorySlug(value: string): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}
