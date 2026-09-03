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
  raisonSociale: 'HBG Labs',
  formeJuridique: 'Entrepreneur individuel (EI)',
  capitalSocial: '',
  siege: 'Durand, 97212 Saint-Joseph',
  siret: '10919844000017',
  tvaIntracom: '',
  directeurPublication: 'Harry Bergoz, Fondateur de HBG Labs',
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
  // Zone VÉRIFIÉE auprès de l'API Supabase, et non supposée : le projet tourne
  // en `ca-central-1` (Montréal). L'annoncer « Union européenne » était une
  // erreur de fait dans un document que l'article 13 du RGPD rend opposable —
  // un client professionnel recopie cette ligne dans son propre registre de
  // traitements. Le Canada fait l'objet d'une décision d'adéquation de la
  // Commission pour les organismes privés, ce qui rend le transfert licite
  // sans clauses contractuelles types.
  {
    nom: 'Supabase',
    objet: 'Base de données, authentification, stockage',
    zone: 'Canada, décision d’adéquation',
  },
  { nom: 'Vercel', objet: 'Diffusion de l’application', zone: 'États-Unis, clauses contractuelles types' },
  { nom: 'Stripe', objet: 'Paiement et facturation des abonnements', zone: 'Union européenne / États-Unis' },
  { nom: 'Infomaniak', objet: 'Envoi des courriels transactionnels', zone: 'Suisse' },
  // Formules Pro et au-dessus uniquement (§ Assistant IA). Ce qui transite :
  // la question posée et un résumé des données de l'organisation pertinentes
  // pour y répondre (missions, stock, clients...), jamais les identifiants de
  // connexion ni les moyens de paiement.
  {
    nom: 'OpenAI',
    objet: 'Génération des réponses de l’Assistant IA, à partir de votre question et des données pertinentes de votre organisation',
    zone: 'États-Unis, clauses contractuelles types',
  },
] as const;

/** Durées de conservation annoncées, par nature de donnée. */
export const CONSERVATION = [
  { donnee: 'Compte et profil', duree: 'Pendant la vie du compte, puis 12 mois' },
  { donnee: 'Données d’entreprise (missions, clients, comptes rendus)', duree: 'Pendant l’abonnement, puis 12 mois' },
  { donnee: 'Factures et pièces comptables', duree: '10 ans — obligation du code de commerce' },
  { donnee: 'Journal d’activité', duree: '12 mois' },
  { donnee: 'Demandes d’assistance', duree: '24 mois' },
] as const;

/**
 * Ce que le navigateur conserve localement, en dehors de tout cookie.
 *
 * Vérifié directement dans le code (grep sur `localStorage.setItem`) plutôt
 * que supposé : aucune de ces entrées ne sert à la mesure d'audience ni à la
 * publicité, donc aucune ne requiert de consentement au sens de la
 * recommandation « Cookies et autres traceurs » de la CNIL.
 */
export const DEPOTS_LOCAUX = [
  {
    nom: 'Session de connexion',
    finalite: 'Vous garder connecté entre deux visites (géré par Supabase Auth)',
    duree: 'Jusqu’à déconnexion',
  },
  {
    nom: 'Préférences d’affichage',
    finalite: 'Thème, couleur d’accent, mode compact, menu latéral replié, affichage en grille ou en liste',
    duree: 'Jusqu’à modification',
  },
  {
    nom: 'Territoire et organisation actifs',
    finalite: 'Retrouver votre contexte de travail au rechargement de la page',
    duree: 'Jusqu’à changement',
  },
  {
    nom: 'Historique, favoris et brouillons des outils',
    finalite: 'Retrouver vos derniers calculs, favoris et notes techniques en cours',
    duree: 'Nombre d’entrées limité, ou jusqu’à suppression manuelle',
  },
  {
    nom: 'Position du widget d’assistance, bannière d’installation',
    finalite: 'Mémoriser où vous avez déplacé la bulle d’aide, ou que vous avez fermé la proposition d’installation',
    duree: 'Jusqu’à réinitialisation du navigateur',
  },
  {
    nom: 'Avatar et intitulé de poste du profil',
    finalite: 'Personnaliser l’affichage de votre profil',
    duree: 'Jusqu’à modification',
  },
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
