import type { CustomerType, VatRegime } from '../../../types/database.ts';
import { frenchRegistrationError, frenchVatError } from '../../../lib/business-identifiers.ts';

/**
 * Les règles de conformité d'une facture, en un seul endroit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * Ces règles viennent du droit : code de commerce pour les mentions
 * obligatoires, norme EN 16931 pour les données structurées, code général des
 * impôts pour la TVA. Elles changeront — la réforme de la facturation
 * électronique en est la preuve en cours.
 *
 * Éparpillées dans des composants React, elles seraient introuvables le jour où
 * il faudra les corriger, et intestables autrement qu'en rendant une page. Ici,
 * ce sont des fonctions pures : on leur donne un état, elles rendent une liste
 * de manques.
 *
 * CE QU'ELLES NE SAVENT PAS, ET NE DOIVENT PAS SAVOIR
 *
 * Où cliquer pour corriger. Une règle rend une CIBLE — l'organisation, le
 * client, la facture — et l'interface décide du lien. Une règle qui connaît une
 * route n'est plus testable seule, et déménage avec elle.
 *
 * BLOQUANT vs AVERTISSEMENT
 *
 * `bloquant` empêche l’émission ; `avertissement` signale une information à vérifier.
 * Ces contrôles de préparation ne constituent pas une validation réglementaire exhaustive.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Gravite = 'bloquant' | 'avertissement';

/** Où se corrige un manque. L'interface en déduit le lien. */
export type Cible = 'organisation' | 'client' | 'facture';

export interface Manque {
  /** Identifiant stable — sert aux tests et au regroupement, jamais affiché. */
  code: string;
  gravite: Gravite;
  cible: Cible;
  /** Dit à l'utilisateur ce qui manque, sans jargon. */
  message: string;
}

/** L'émetteur, tel que la validation a besoin de le connaître. */
export interface EmetteurAValider {
  name?: string | null;
  legal_name?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  address_line1?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  legal_form?: string | null;
  vat_regime?: VatRegime | null;
  iban?: string | null;
  share_capital_cents?: number | null;
}

/** Le destinataire, lu sur l'instantané de la facture ou sur la fiche client. */
export interface DestinataireAValider {
  name?: string | null;
  customer_type?: CustomerType | null;
  registration_number?: string | null;
  vat_number?: string | null;
  address_line1?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface LigneAValider {
  description: string;
  quantity: number;
  unit_price_cents: number;
  vat_rate: number;
  unit?: string;
}

export interface FactureAValider {
  reference?: string | null;
  issued_at?: string | null;
  due_date?: string | null;
  payment_terms?: string | null;
  items: readonly LigneAValider[];
}

function vide(valeur: string | null | undefined): boolean {
  return valeur === null || valeur === undefined || valeur.trim() === '';
}

// -----------------------------------------------------------------------------
// L'émetteur
// -----------------------------------------------------------------------------

export function validerEmetteur(emetteur: EmetteurAValider): Manque[] {
  const manques: Manque[] = [];

  if (vide(emetteur.name) && vide(emetteur.legal_name)) {
    manques.push({
      code: 'emetteur.denomination',
      gravite: 'bloquant',
      cible: 'organisation',
      message: 'La dénomination de votre entreprise',
    });
  }

  if (
    vide(emetteur.registration_number) ||
    frenchRegistrationError(emetteur.registration_number, emetteur.country)
  ) {
    manques.push({
      code: 'emetteur.siret',
      gravite: 'bloquant',
      cible: 'organisation',
      message: 'Un SIREN de 9 chiffres ou SIRET de 14 chiffres pour votre entreprise française',
    });
  }

  if (
    vide(emetteur.address_line1) ||
    vide(emetteur.postal_code) ||
    vide(emetteur.city) ||
    vide(emetteur.country)
  ) {
    manques.push({
      code: 'emetteur.adresse',
      gravite: 'bloquant',
      cible: 'organisation',
      message: 'L’adresse complète de votre entreprise (voie, code postal, ville, pays)',
    });
  }

  /*
    LE RÉGIME DE TVA COMMANDE LA MENTION À PORTER, D'OÙ SON CARACTÈRE BLOQUANT.

    Sous la franchise en base, la facture DOIT porter « TVA non applicable,
    article 293 B du CGI » et ne peut facturer aucune TVA. Hors franchise, elle
    doit porter le numéro de TVA intracommunautaire. Ne pas savoir dans quel cas
    on est, c'est ne pas savoir quelle facture émettre.
  */
  if (emetteur.vat_regime === null || emetteur.vat_regime === undefined) {
    manques.push({
      code: 'emetteur.regime_tva',
      gravite: 'bloquant',
      cible: 'organisation',
      message: 'Votre régime de TVA (franchise en base, réel simplifié ou réel normal)',
    });
  } else if (emetteur.vat_regime !== 'franchise' && vide(emetteur.vat_number)) {
    manques.push({
      code: 'emetteur.tva_intracom',
      gravite: 'bloquant',
      cible: 'organisation',
      message: 'Votre numéro de TVA intracommunautaire',
    });
  }

  const vatError = frenchVatError(emetteur.vat_number, emetteur.country);
  if (vatError) {
    manques.push({
      code: 'emetteur.tva_format',
      gravite: 'bloquant',
      cible: 'organisation',
      message: `Le numéro de TVA de votre entreprise est invalide. ${vatError}`,
    });
  }

  // La nature juridique reste à confirmer dans les données de l’entreprise.
  if (vide(emetteur.legal_form)) {
    manques.push({
      code: 'emetteur.forme_juridique',
      gravite: 'bloquant',
      cible: 'organisation',
      message: 'Votre forme juridique (SARL, SAS, EI…)',
    });
  }

  if (
    /^(SASU?|SARL|EURL|SA|SNC|SCA|SCS|SCI)$/i.test(emetteur.legal_form?.trim() ?? '') &&
    emetteur.share_capital_cents == null
  ) {
    manques.push({
      code: 'emetteur.capital',
      gravite: 'bloquant',
      cible: 'organisation',
      message: 'Le capital social de votre société',
    });
  }

  if (vide(emetteur.iban)) {
    manques.push({
      code: 'emetteur.iban',
      gravite: 'avertissement',
      cible: 'organisation',
      message: 'Votre IBAN — sans lui, un client qui paie par virement doit vous le demander',
    });
  }

  return manques;
}

// -----------------------------------------------------------------------------
// Le destinataire
// -----------------------------------------------------------------------------

export function validerDestinataire(destinataire: DestinataireAValider): Manque[] {
  const manques: Manque[] = [];

  if (vide(destinataire.name)) {
    manques.push({
      code: 'client.nom',
      gravite: 'bloquant',
      cible: 'client',
      message: 'Le nom du client',
    });
  }

  /*
    LE TYPE DE CLIENT COMMANDE TOUT LE RESTE.

    Un particulier n'a pas de SIRET, et le lui réclamer serait absurde ; une
    entreprise doit en avoir un ; un organisme public relève d'un circuit
    distinct. Tant qu'on ne sait pas, on ne peut pas valider — d'où le caractère
    bloquant, et d'où le fait que la colonne soit nullable en base plutôt que
    remplie d'un `'company'` supposé.
  */
  if (destinataire.customer_type === null || destinataire.customer_type === undefined) {
    manques.push({
      code: 'client.type',
      gravite: 'bloquant',
      cible: 'client',
      message: 'Le type de client (entreprise, particulier ou organisme public)',
    });
    return manques;
  }

  const estProfessionnel =
    destinataire.customer_type === 'company' || destinataire.customer_type === 'public_body';

  if (estProfessionnel && vide(destinataire.registration_number)) {
    manques.push({
      code: 'client.siret',
      gravite: 'bloquant',
      cible: 'client',
      message: 'Le SIRET ou l’identifiant national du client professionnel',
    });
  }

  if (estProfessionnel) {
    const registrationError = frenchRegistrationError(
      destinataire.registration_number,
      destinataire.country,
    );
    const vatError = frenchVatError(destinataire.vat_number, destinataire.country);
    if (registrationError)
      manques.push({
        code: 'client.siret_format',
        gravite: 'bloquant',
        cible: 'client',
        message: `L’identifiant du client est invalide. ${registrationError}`,
      });
    if (vatError)
      manques.push({
        code: 'client.tva_format',
        gravite: 'bloquant',
        cible: 'client',
        message: `Le numéro de TVA du client est invalide. ${vatError}`,
      });
  }

  // L'adresse du destinataire est une mention obligatoire, quel que soit son
  // type — un particulier a une adresse.
  if (
    vide(destinataire.address_line1) ||
    vide(destinataire.postal_code) ||
    vide(destinataire.city) ||
    vide(destinataire.country)
  ) {
    manques.push({
      code: 'client.adresse',
      gravite: 'bloquant',
      cible: 'client',
      message: 'L’adresse complète du client (voie, code postal, ville, pays)',
    });
  }

  if (estProfessionnel && vide(destinataire.vat_number)) {
    manques.push({
      code: 'client.tva_intracom',
      gravite: 'avertissement',
      cible: 'client',
      message: 'Le numéro de TVA du client, s’il en possède un et si l’opération le nécessite',
    });
  }

  return manques;
}

// -----------------------------------------------------------------------------
// Le document
// -----------------------------------------------------------------------------

export function validerFacture(facture: FactureAValider, emetteur: EmetteurAValider): Manque[] {
  const manques: Manque[] = [];

  if (facture.items.length === 0) {
    manques.push({
      code: 'facture.lignes',
      gravite: 'bloquant',
      cible: 'facture',
      message: 'Au moins une ligne de prestation',
    });
  }

  if (
    vide(facture.due_date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(facture.due_date ?? '') ||
    !Number.isFinite(Date.parse(facture.due_date ?? ''))
  ) {
    manques.push({
      code: 'facture.echeance',
      gravite: 'bloquant',
      cible: 'facture',
      message: 'Une date d’échéance de règlement valide',
    });
  }

  if (
    facture.items.some(
      (ligne) =>
        vide(ligne.description) ||
        !Number.isFinite(ligne.quantity) ||
        ligne.quantity <= 0 ||
        !Number.isSafeInteger(ligne.unit_price_cents) ||
        ligne.unit_price_cents < 0 ||
        !Number.isFinite(ligne.vat_rate) ||
        ligne.vat_rate < 0 ||
        ligne.vat_rate > 100 ||
        (ligne.unit !== undefined && vide(ligne.unit)),
    )
  ) {
    manques.push({
      code: 'facture.lignes_invalides',
      gravite: 'bloquant',
      cible: 'facture',
      message:
        'Des prestations complètes : description, unité, quantité positive, prix et taux de TVA valides',
    });
  }

  if (vide(facture.payment_terms)) {
    manques.push({
      code: 'facture.conditions_reglement',
      gravite: 'bloquant',
      cible: 'facture',
      message: 'Les conditions de règlement, pénalités de retard comprises (mention obligatoire)',
    });
  }

  /*
    LA RÈGLE LA PLUS UTILE DE CE FICHIER POUR UN ARTISAN.

    Sous la franchise en base — le cas de la plupart des micro-entrepreneurs —
    facturer de la TVA est une faute : elle serait due au Trésor alors qu'elle
    n'aurait jamais dû être collectée, et la facture est à refaire. Le taux par
    défaut de l'application étant 20 %, l'erreur est à un clic.

    On la bloque donc AVANT l'émission, moment où elle se corrige encore d'un
    geste.
  */
  if (emetteur.vat_regime === 'franchise') {
    const lignesAvecTva = facture.items.filter((ligne) => ligne.vat_rate > 0);
    if (lignesAvecTva.length > 0) {
      manques.push({
        code: 'facture.tva_sous_franchise',
        gravite: 'bloquant',
        cible: 'facture',
        message:
          `${lignesAvecTva.length} ligne(s) portent de la TVA alors que vous êtes en franchise ` +
          'en base : le taux doit être à 0 % et la facture porter « TVA non applicable, ' +
          'art. 293 B du CGI »',
      });
    }
  }

  const total = facture.items.reduce(
    (somme, ligne) => somme + Math.round(ligne.quantity * ligne.unit_price_cents),
    0,
  );

  if (facture.items.length > 0 && total === 0) {
    manques.push({
      code: 'facture.montant_nul',
      gravite: 'avertissement',
      cible: 'facture',
      message: 'Le montant total est nul — vérifiez les quantités et les prix unitaires',
    });
  }

  return manques;
}

// -----------------------------------------------------------------------------
// Le verdict d'émission
// -----------------------------------------------------------------------------

export interface Verdict {
  manques: Manque[];
  bloquants: Manque[];
  avertissements: Manque[];
  /** L'émission est-elle possible ? */
  emissionPossible: boolean;
}

/**
 * Tout ce qui empêche ou gêne l'émission d'une facture.
 *
 * L'ordre est celui de la correction : l'entreprise d'abord — un manque s'y
 * corrige une fois pour toutes — puis le client, puis le document lui-même.
 */
export function validerEmission(
  facture: FactureAValider,
  destinataire: DestinataireAValider,
  emetteur: EmetteurAValider,
): Verdict {
  const manques = [
    ...validerEmetteur(emetteur),
    ...validerDestinataire(destinataire),
    ...validerFacture(facture, emetteur),
  ];

  const bloquants = manques.filter((m) => m.gravite === 'bloquant');

  return {
    manques,
    bloquants,
    avertissements: manques.filter((m) => m.gravite === 'avertissement'),
    emissionPossible: bloquants.length === 0,
  };
}

// -----------------------------------------------------------------------------
// La préparation de l'entreprise
// -----------------------------------------------------------------------------

export interface EtapePreparation {
  code: string;
  libelle: string;
  fait: boolean;
  /** Ce que l'étape apporte, dit sans jargon. */
  pourquoi: string;
}

/**
 * L'état de préparation de l'entreprise à la facturation électronique.
 *
 * Distinct de `validerEmetteur` : celui-ci répond « puis-je émettre cette
 * facture », celui-là « où en suis-je ». Les deux lisent les mêmes données mais
 * ne servent pas au même moment, et les confondre donnerait soit une check-list
 * qui parle de la facture en cours, soit un blocage d'émission qui réclame le
 * raccordement à une plateforme dont on n'a pas encore besoin.
 */
export function preparationEmetteur(emetteur: EmetteurAValider): EtapePreparation[] {
  return [
    {
      code: 'denomination',
      libelle: 'Dénomination et raison sociale',
      fait: !vide(emetteur.name) || !vide(emetteur.legal_name),
      pourquoi: 'Apparaît en tête de chaque facture.',
    },
    {
      code: 'siret',
      libelle: 'SIRET',
      fait:
        !vide(emetteur.registration_number) &&
        !frenchRegistrationError(emetteur.registration_number, emetteur.country),
      pourquoi: 'Identifie votre entreprise auprès de l’administration et de vos clients.',
    },
    {
      code: 'adresse',
      libelle: 'Adresse complète',
      fait:
        !vide(emetteur.address_line1) &&
        !vide(emetteur.postal_code) &&
        !vide(emetteur.city) &&
        !vide(emetteur.country),
      pourquoi: 'Mention obligatoire sur toute facture.',
    },
    {
      code: 'regime_tva',
      libelle: 'Régime de TVA',
      fait: emetteur.vat_regime !== null && emetteur.vat_regime !== undefined,
      pourquoi: 'Détermine si vous facturez de la TVA, et quelle mention porter.',
    },
    {
      code: 'tva_intracom',
      libelle: 'Numéro de TVA intracommunautaire',
      // Sous franchise en base, le numéro peut ne pas s’appliquer : l’étape est satisfaite parce
      // qu'elle ne s'applique pas, et non parce qu'on l'ignore.
      fait:
        (emetteur.vat_regime === 'franchise' || !vide(emetteur.vat_number)) &&
        !frenchVatError(emetteur.vat_number, emetteur.country),
      pourquoi: 'Obligatoire dès lors que vous facturez de la TVA.',
    },
    {
      code: 'forme_juridique',
      libelle: 'Forme juridique',
      fait: !vide(emetteur.legal_form),
      pourquoi: 'Précise la forme de la société ou la qualité d’entrepreneur individuel.',
    },
    {
      code: 'iban',
      libelle: 'Coordonnées bancaires',
      fait: !vide(emetteur.iban),
      pourquoi: 'Évite à vos clients de vous les réclamer pour payer.',
    },
  ];
}
