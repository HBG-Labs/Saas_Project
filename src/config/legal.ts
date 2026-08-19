/**
 * Les informations légales de l'éditeur, en un seul endroit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * Les mentions légales, la politique de confidentialité et les conditions de
 * vente répètent les mêmes éléments : qui édite, où, sous quel numéro, qui
 * héberge. Les recopier dans trois pages garantit qu'un déménagement en
 * corrigera deux.
 *
 * CE QUI EST VOLONTAIREMENT VIDE
 *
 * Les valeurs ci-dessous engagent juridiquement celui qui les publie. Je ne
 * peux pas les inventer : un SIRET ou un numéro de TVA erroné vaut mieux
 * absent qu'approximatif. Les champs laissés vides sont signalés à l'écran par
 * un encart visible — pas par un blanc silencieux qu'on ne remarquerait qu'au
 * premier litige.
 *
 * ⚠️ Ce fichier et les pages qui le lisent sont une base de travail rédigée par
 * un ingénieur, pas par un juriste. Le contenu doit être relu avant l'ouverture
 * commerciale.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface MentionEditeur {
  /** Dénomination sociale exacte, telle qu'immatriculée. */
  raisonSociale: string;
  /** SARL, SAS, EI, auto-entrepreneur… */
  formeJuridique: string;
  /** Capital social, si la forme en comporte un. */
  capitalSocial: string;
  /** Adresse complète du siège. */
  siege: string;
  /** SIRET à quatorze chiffres. */
  siret: string;
  /** Numéro de TVA intracommunautaire, si assujetti. */
  tvaIntracom: string;
  /** Nom du directeur de la publication. */
  directeurPublication: string;
  /** Adresse de contact, publiée. */
  email: string;
  /** Téléphone, facultatif mais attendu par les clients professionnels. */
  telephone: string;
}

export const EDITEUR: MentionEditeur = {
  raisonSociale: '',
  formeJuridique: '',
  capitalSocial: '',
  siege: '',
  siret: '',
  tvaIntracom: '',
  directeurPublication: '',
  email: 'contact@rezo360.fr',
  telephone: '',
};

/**
 * L'hébergeur, que la loi impose de nommer avec ses coordonnées.
 *
 * Deux prestataires interviennent : Vercel sert l'application, Supabase
 * héberge la base. Les deux sont nommés — désigner le seul front laisserait
 * croire que les données dorment ailleurs qu'elles ne dorment.
 */
export const HEBERGEURS = [
  {
    nom: 'Vercel Inc.',
    adresse: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
    role: 'Hébergement de l’application web',
    site: 'https://vercel.com',
  },
  {
    nom: 'Supabase, Inc.',
    adresse: '970 Toa Payoh North, #07-04, Singapour 318992',
    role: 'Hébergement de la base de données et des fichiers',
    site: 'https://supabase.com',
  },
] as const;

/**
 * Sous-traitants au sens du RGPD.
 *
 * Les nommer n'est pas une politesse : l'article 13 impose d'informer des
 * destinataires des données, et un client professionnel qui tient son propre
 * registre de traitements en a besoin.
 */
export const SOUS_TRAITANTS = [
  { nom: 'Supabase', objet: 'Base de données, authentification, stockage', zone: 'Union européenne' },
  { nom: 'Vercel', objet: 'Diffusion de l’application', zone: 'États-Unis, clauses contractuelles types' },
  { nom: 'Stripe', objet: 'Paiement et facturation des abonnements', zone: 'Union européenne / États-Unis' },
  { nom: 'Infomaniak', objet: 'Envoi des courriels transactionnels', zone: 'Suisse' },
] as const;

/** Durées de conservation annoncées, par nature de donnée. */
export const CONSERVATION = [
  { donnee: 'Compte et profil', duree: 'Pendant la vie du compte, puis 12 mois' },
  { donnee: 'Données d’entreprise (missions, clients, comptes rendus)', duree: 'Pendant l’abonnement, puis 12 mois' },
  { donnee: 'Factures et pièces comptables', duree: '10 ans — obligation du code de commerce' },
  { donnee: 'Journal d’activité', duree: '12 mois' },
  { donnee: 'Demandes d’assistance', duree: '24 mois' },
] as const;

/** Un champ non renseigné se voit, plutôt que de passer pour une omission. */
export function estRenseigne(valeur: string): boolean {
  return valeur.trim() !== '';
}

/** Les champs indispensables aux mentions légales, et leur état. */
export function champsManquants(): string[] {
  const requis: [string, string][] = [
    ['Raison sociale', EDITEUR.raisonSociale],
    ['Forme juridique', EDITEUR.formeJuridique],
    ['Siège social', EDITEUR.siege],
    ['SIRET', EDITEUR.siret],
    ['Directeur de la publication', EDITEUR.directeurPublication],
  ];

  return requis.filter(([, valeur]) => !estRenseigne(valeur)).map(([nom]) => nom);
}
