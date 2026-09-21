/**
 * Le glossaire métier de base de la transcription, par secteur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * À QUOI IL SERT
 *
 * Le moteur reçoit, avant l'audio, une phrase de contexte qui liste les
 * termes, sigles et noms susceptibles d'apparaître : « PTO » plutôt que
 * « photo », « 36FO » plutôt que « trente-six fous ». Ce n'est pas une
 * consigne, c'est un indice — le moteur reste libre d'écrire ce qu'il entend.
 *
 * CE QUI Y EST, CE QUI N'Y EST PAS
 *
 * Ici : des termes de métier, publics, communs à toutes les entreprises d'un
 * secteur. Rien d'une organisation en particulier — les noms de clients, de
 * sites, de techniciens viendront du dictionnaire d'organisation (phase 6),
 * ajoutés à la volée et jamais mutualisés.
 *
 * Le prompt reste COURT : les termes du secteur de l'organisation, les
 * termes de gestion, et c'est tout. Whisper s'arrête à 224 tokens ; les
 * moteurs récents acceptent plus, mais un prompt qui liste tout n'oriente
 * plus rien. Ajouter un secteur = une entrée ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const GLOSSAIRE_GESTION: readonly string[] = [
  'devis',
  'facture',
  'avoir',
  'bon de commande',
  "bon d'intervention",
  'compte rendu',
  'intervention',
  'mission',
  'SIRET',
  'TVA',
  'hors taxes',
  'TTC',
  'acompte',
  'PV de réception',
];

/** Clés = codes de `public.industries`. */
export const GLOSSAIRE_PAR_SECTEUR: Readonly<Record<string, readonly string[]>> = {
  fiber_telecom: [
    'PTO',
    'PBO',
    'PMZ',
    'PM',
    'NRO',
    'SRO',
    'DTI',
    'FTTH',
    'FTTO',
    'jarretière',
    'réflectométrie',
    'soudure fibre',
    "boîtier d'épissurage",
    "protection d'épissure",
    'SC APC',
    'LC',
    'RJ45',
    'baie de brassage',
    '36FO',
    '12FO',
    '72FO',
    '144FO',
    'chambre télécom',
    'fourreau',
    'aiguille',
    'photomètre',
    'source lumineuse',
    'atténuation',
    'décibel',
    'dB',
    'câble G657',
    'raccordement',
    'tirage de câble',
  ],
  electrical: [
    'disjoncteur',
    'disjoncteur différentiel',
    'interrupteur différentiel',
    'tableau électrique',
    'phase',
    'neutre',
    'terre',
    'NF C 15-100',
    'contacteur',
    'télérupteur',
    'section de câble',
    'multimètre',
    'goulotte',
    'gaine ICTA',
    'ampère',
    'milliampère',
    'volt',
    'kilowatt',
    'triphasé',
    'monophasé',
    'boîte de dérivation',
    'Consuel',
    'prise de terre',
    'ohm',
    "défaut d'isolement",
    'parafoudre',
    'domino',
    'Wago',
  ],
  hvac: [
    'climatisation',
    'PAC',
    'pompe à chaleur',
    'compresseur',
    'fluide frigorigène',
    'R32',
    'R410A',
    'groupe extérieur',
    'unité intérieure',
    'split',
    'gainable',
    'VMC',
    'VMC double flux',
    'condensats',
    'détendeur',
    'évaporateur',
    'condenseur',
    'tirage au vide',
    'manifold',
    'kilowatt',
    'BTU',
    'attestation de capacité',
    'chauffe-eau thermodynamique',
  ],
  heating: [
    'chaudière',
    'chaudière à condensation',
    'circulateur',
    "vase d'expansion",
    'radiateur',
    'plancher chauffant',
    'thermostat',
    'brûleur',
    'fioul',
    'gaz',
    'ballon tampon',
    'désembouage',
    'purge',
    'entretien annuel',
  ],
  plumbing: [
    'chauffe-eau',
    'cumulus',
    'groupe de sécurité',
    'PER',
    'multicouche',
    'cuivre',
    'PVC',
    'siphon',
    'évacuation',
    'colonne montante',
    "vanne d'arrêt",
    'réducteur de pression',
    'mitigeur',
    'WC suspendu',
    'bâti-support',
    'fuite',
    'joint',
    'raccord',
    'diamètre',
    'fosse septique',
    'débouchage',
  ],
  landscaping: [
    'tonte',
    'taille de haie',
    'élagage',
    'débroussaillage',
    'arrosage automatique',
    'programmateur',
    'goutte-à-goutte',
    'engazonnement',
    'paillage',
    'terreau',
    'désherbage',
    'tronçonneuse',
    'broyeur',
    'taille-haie',
    'évacuation des déchets verts',
  ],
  cleaning: [
    'nettoyage',
    'remise en état',
    'vitrerie',
    'autolaveuse',
    'monobrosse',
    'décapage',
    'protection de sol',
    'désinfection',
    "produit d'entretien",
    'consommables',
    'fin de chantier',
  ],
  pest_control: [
    'dératisation',
    'désinsectisation',
    'punaises de lit',
    'cafards',
    'blattes',
    'rongeurs',
    'appât',
    "poste d'appâtage",
    'traitement thermique',
    'gel insecticide',
    'certibiocide',
  ],
  home_care: [
    'aide à domicile',
    'toilette',
    'repas',
    'courses',
    'accompagnement',
    "plan d'aide",
    'APA',
    'PCH',
    'tutelle',
    'aidant',
  ],
  it_networks: [
    'switch',
    'routeur',
    'box',
    'VLAN',
    'Wi-Fi',
    'borne',
    'RJ45',
    'baie',
    'onduleur',
    'serveur',
    'NAS',
    'sauvegarde',
    'pare-feu',
    'VPN',
    'adresse IP',
    'DHCP',
    'câblage catégorie 6',
    'certification de liens',
  ],
  mechanics: [
    'vidange',
    'plaquettes',
    'disques',
    'courroie de distribution',
    'embrayage',
    'amortisseurs',
    'diagnostic',
    'valise',
    'contrôle technique',
    'pneumatiques',
    'géométrie',
    'batterie',
    'alternateur',
    'injecteur',
    'turbo',
    'FAP',
    'AdBlue',
  ],
  transport: [
    'livraison',
    'tournée',
    'chargement',
    'déchargement',
    'lettre de voiture',
    'palette',
    'hayon',
    'chronotachygraphe',
    'point relais',
    'affrètement',
    'messagerie',
  ],
  general: [
    'chantier',
    'site',
    'matériel',
    'outillage',
    'véhicule',
    'EPI',
    'sécurité',
    'consignation',
    'habilitation',
    'planning',
  ],
};

/** Les termes de gestion + ceux du secteur ; `general` si le secteur est inconnu. */
export function glossaireDeBase(industry: string | null | undefined): string[] {
  const secteur = GLOSSAIRE_PAR_SECTEUR[industry ?? ''] ?? GLOSSAIRE_PAR_SECTEUR.general ?? [];
  return [...new Set([...secteur, ...GLOSSAIRE_GESTION])];
}

/** Un prompt de contexte ne doit pas dominer l'audio : ~1 500 caractères, c'est déjà long. */
export const PROMPT_MAX_CHARS = 1500;

/**
 * La phrase de contexte : une amorce non structurée (ce que le guide
 * OpenAI recommande), puis les termes. Les termes supplémentaires
 * (dictionnaire d'organisation) passent en premier — ce sont les plus
 * spécifiques — puis le glossaire de base, jusqu'à la limite.
 */
export function construirePromptStt(params: {
  industry: string | null | undefined;
  termesSupplementaires?: readonly string[];
  maxChars?: number;
}): string {
  const max = params.maxChars ?? PROMPT_MAX_CHARS;
  const amorce =
    "Enregistrement de terrain, en français, d'une entreprise de services techniques. Vocabulaire, sigles et noms qui peuvent apparaître : ";
  const vus = new Set<string>();
  const termes: string[] = [];
  for (const t of [...(params.termesSupplementaires ?? []), ...glossaireDeBase(params.industry)]) {
    const propre = String(t ?? '').trim();
    if (propre.length === 0) continue;
    const cle = propre.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    termes.push(propre);
  }
  let corps = '';
  for (const t of termes) {
    const suivant = corps.length === 0 ? t : `${corps}, ${t}`;
    if (amorce.length + suivant.length + 1 > max) break;
    corps = suivant;
  }
  return `${amorce}${corps}.`;
}

/** Whisper s'arrête à 224 tokens : on coupe le prompt à ~700 caractères pour lui. */
export const PROMPT_WHISPER_MAX_CHARS = 700;

export function tronquerPourWhisper(prompt: string): string {
  if (prompt.length <= PROMPT_WHISPER_MAX_CHARS) return prompt;
  const coupe = prompt.slice(0, PROMPT_WHISPER_MAX_CHARS);
  const derniereVirgule = coupe.lastIndexOf(',');
  return `${derniereVirgule > 0 ? coupe.slice(0, derniereVirgule) : coupe}.`;
}
