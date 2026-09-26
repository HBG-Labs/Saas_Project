export const SOCIAL_CONTENT_GENERATOR_VERSION = 'social-weekly-text-v1';

const VERIFIED_FEATURES = [
  'clients',
  'contacts',
  'sites',
  'planning',
  'equipes',
  'missions',
  'interventions',
  'comptes rendus',
  'signatures',
  'photos et pieces jointes',
  'documents',
  'stock',
  'devis',
  'factures',
  'relances',
  'portail client',
  'outils IA',
  'transcription audio',
  'workspace',
];

const CORE_AUDIENCES = [
  'artisans',
  'TPE',
  'PME',
  'entreprises de terrain',
  'plomberie',
  'electricite',
  'climatisation',
  'espaces verts',
  'nettoyage',
  'BTP',
  'maintenance',
  'fibre et reseaux',
  'services techniques',
];

const CORE_ZONES = ['Martinique', 'Guadeloupe', 'Guyane', 'France metropolitaine'];

/**
 * Contexte marketing compact, maintenu cote serveur.
 *
 * Il doit rester factuel : aucun chiffre client, gain de temps, temoignage ou
 * promesse de resultat n'est introduit ici sans source verifiee.
 */
export function buildRezo360MarketingContext(): string {
  return [
    'MARQUE: REZO360.',
    'PRODUIT: plateforme de gestion pour entreprises de terrain.',
    `FONCTIONNALITES VERIFIEES: ${VERIFIED_FEATURES.join(', ')}.`,
    `AUDIENCES PRIORITAIRES: ${CORE_AUDIENCES.join(', ')}.`,
    `ZONES PRIORITAIRES: ${CORE_ZONES.join(', ')}.`,
    [
      'POSITIONNEMENT:',
      'outil professionnel sobre, utile au bureau comme au terrain,',
      'oriente organisation, suivi, transmission des informations et reduction du flou operationnel.',
    ].join(' '),
    [
      'INTERDIT:',
      'ne jamais inventer de chiffres, avis, clients, certifications, partenariats,',
      'economies de temps ou garanties de croissance.',
    ].join(' '),
  ].join('\n');
}
