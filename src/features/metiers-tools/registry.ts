import type { MetierToolDefinition, TradeDefinition, TradeSlug } from './types';
import { btpTools } from './trades/btp';
import { plomberieTools } from './trades/plomberie';
import { electriciteTools } from './trades/electricite';
import { espacesVertsTools } from './trades/espaces-verts';
import { fibreOptiqueTools } from './trades/fibre-optique';
import { reseauxTools } from './trades/reseaux';

export const TRADES: TradeDefinition[] = [
  {
    slug: 'btp',
    name: 'BTP & Maçonnerie',
    shortName: 'BTP',
    subtitle: 'Béton, fondations, terrassement, toiture et métrés',
    description:
      'Calculateurs de dimensionnement, volumes de béton, parpaings, pentes, escaliers, toitures et chiffrage devis pour le bâtiment et les travaux publics.',
    icon: 'hammer',
    badgeColor: 'bg-warning-subtle text-warning border-warning/20',
    toolsCount: 13,
    toolSlugs: [
      'beton',
      'tranchee',
      'fondation',
      'parpaings',
      'sable',
      'gravier',
      'pente',
      'escalier',
      'toiture',
      'peinture',
      'carrelage',
      'materiaux',
      'devis',
    ],
  },
  {
    slug: 'plomberie',
    name: 'Plomberie & Fluides',
    shortName: 'Plomberie',
    subtitle: 'Débit, pertes de charge, contenance et pentes d’évacuation',
    description:
      'Outils hydrauliques pour installations sanitaires, dimensionnement des canalisations, pertes de charge et temps de chauffe d’eau chaude.',
    icon: 'droplet',
    badgeColor: 'bg-info-subtle text-info border-info/20',
    toolsCount: 5,
    toolSlugs: ['debit', 'canalisation', 'perte-charge', 'pente-evacuation', 'eau-chaude'],
  },
  {
    slug: 'electricite',
    name: 'Électricité & Câblage',
    shortName: 'Électricité',
    subtitle: 'Loi d’Ohm, puissance, chute de tension NFC 15-100 et section',
    description:
      'Dimensionnement électrique complet pour artisans et installateurs : calcul de puissance, intensité, section de câble et validation des chutes de tension.',
    icon: 'zap',
    badgeColor: 'bg-accent-subtle text-accent border-accent/20',
    toolsCount: 5,
    toolSlugs: ['loi-ohm', 'puissance', 'intensite', 'chute-tension', 'section-cable'],
  },
  {
    slug: 'espaces-verts',
    name: 'Espaces Verts & Paysage',
    shortName: 'Espaces verts',
    subtitle: 'Plantation, gazon, semences, arrosage et paillage',
    description:
      'Calculateurs dédiés aux paysagistes, pépiniéristes et jardiniers : densité de végétaux, création de pelouses, dosage d’engrais et consommation d’arrosage.',
    icon: 'flower',
    badgeColor: 'bg-success-subtle text-success border-success/20',
    toolsCount: 5,
    toolSlugs: ['plantation', 'gazon', 'semences', 'arrosage', 'paillage'],
  },
  {
    slug: 'fibre-optique',
    name: 'Fibre Optique & FTTH',
    shortName: 'Fibre optique',
    subtitle: 'Budget optique, longueurs de touret, pertes et réflectométrie',
    description:
      'Outils indispensables pour les techniciens FTTH / D1 / D2 / D3 : bilan de liaison optique, loveries de chambres, pertes connecteurs/splitters et conversions dBm.',
    icon: 'cable',
    badgeColor: 'bg-error-subtle text-error border-error/20',
    toolsCount: 4,
    toolSlugs: ['budget-optique', 'longueur-fibre', 'pertes-optiques', 'fo'],
  },
  {
    slug: 'reseaux',
    name: 'Réseaux & Télécoms',
    shortName: 'Réseaux',
    subtitle: 'Calculateur IPv4, convertisseur CIDR, subnetting et VLANs',
    description:
      'Outils d’ingénierie et d’administration réseau : calcul d’adresses IP, sous-réseaux, tables CIDR et plan d’adressage VLAN 802.1Q.',
    icon: 'network',
    badgeColor: 'bg-primary-subtle text-primary border-primary/20',
    toolsCount: 4,
    toolSlugs: ['ipv4', 'cidr', 'subnetting', 'vlan'],
  },
];

export const ALL_METIER_TOOLS: MetierToolDefinition[] = [
  ...btpTools,
  ...plomberieTools,
  ...electriciteTools,
  ...espacesVertsTools,
  ...fibreOptiqueTools,
  ...reseauxTools,
];

export function getTrade(slug: string): TradeDefinition | undefined {
  return TRADES.find((t) => t.slug === slug);
}

export function getMetierTool(
  tradeSlug: string,
  toolSlug: string,
): MetierToolDefinition | undefined {
  return ALL_METIER_TOOLS.find((t) => t.tradeSlug === tradeSlug && t.slug === toolSlug);
}

export function findMetierTool(toolSlug: string): MetierToolDefinition | undefined {
  return ALL_METIER_TOOLS.find((t) => t.slug === toolSlug);
}

export function listToolsForTrade(tradeSlug: TradeSlug): MetierToolDefinition[] {
  return ALL_METIER_TOOLS.filter((t) => t.tradeSlug === tradeSlug);
}

export function searchMetierTools(
  query: string,
  tradeFilter?: TradeSlug | 'all',
): MetierToolDefinition[] {
  let list = ALL_METIER_TOOLS;
  if (tradeFilter && tradeFilter !== 'all') {
    list = list.filter((t) => t.tradeSlug === tradeFilter);
  }

  const q = query.trim().toLowerCase();
  if (!q) return list;

  return list.filter((tool) => {
    return (
      tool.title.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      (tool.shortDescription && tool.shortDescription.toLowerCase().includes(q)) ||
      tool.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      tool.tradeSlug.toLowerCase().includes(q)
    );
  });
}
