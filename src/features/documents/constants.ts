/**
 * Règles de la bibliothèque, côté navigateur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER NE PROTÈGE RIEN
 *
 * Il existe pour l'expérience : refuser tout de suite un fichier voué à être
 * rejeté, afficher la taille maximale, choisir une icône. Rien de plus.
 *
 * L'autorité est ailleurs, et elle seule compte :
 *
 *   `storage.buckets.allowed_mime_types` et `file_size_limit` — le serveur
 *   refuse le dépôt, quoi que le client prétende ;
 *   les policies Storage — l'organisation est vérifiée sur le premier segment
 *   du chemin ;
 *   la RLS de `organization_documents` — permission et formule.
 *
 * Ces valeurs DOIVENT donc rester alignées sur la migration
 * `..._organization_documents.sql`. Les désaligner ne crée pas de faille : cela
 * produit une erreur incompréhensible côté utilisateur, ce qui est déjà assez
 * fâcheux.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Miroir de `file_size_limit` du bucket. */
export const TAILLE_MAX_OCTETS = 26_214_400;

export const TAILLE_MAX_LISIBLE = '25 Mo';

/** Miroir exact de `allowed_mime_types`. */
export const TYPES_AUTORISES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
] as const;

export type TypeAutorise = (typeof TYPES_AUTORISES)[number];

/** Pour l'attribut `accept` du sélecteur de fichier, extensions comprises. */
export const ACCEPT_FICHIER = [
  ...TYPES_AUTORISES,
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
].join(',');

/**
 * Familles de documents, pour les filtres et le choix d'icône.
 *
 * Le type MIME fait foi, jamais l'extension : celle-ci se renomme librement, et
 * s'y fier reviendrait à laisser l'utilisateur décider de la nature du fichier.
 */
export type FamilleDocument = 'pdf' | 'image' | 'document' | 'tableur' | 'autre';

const FAMILLES: Record<string, FamilleDocument> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
  'application/vnd.ms-excel': 'tableur',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'tableur',
  'text/csv': 'tableur',
};

export function familleDeDocument(mimeType: string | null | undefined): FamilleDocument {
  if (!mimeType) return 'autre';
  return FAMILLES[mimeType] ?? 'autre';
}

/** Seules ces familles se prévisualisent sans dépendance supplémentaire. */
export function estPrevisualisable(mimeType: string | null | undefined): boolean {
  const famille = familleDeDocument(mimeType);
  return famille === 'pdf' || famille === 'image';
}

export const FILTRES_FAMILLE = [
  { valeur: 'tous', label: 'Tous' },
  { valeur: 'pdf', label: 'PDF' },
  { valeur: 'image', label: 'Images' },
  { valeur: 'document', label: 'Documents' },
  { valeur: 'tableur', label: 'Tableurs' },
] as const;

export type FiltreFamille = (typeof FILTRES_FAMILLE)[number]['valeur'];

/** Nombre de documents par page. La bibliothèque doit tenir à plusieurs milliers. */
export const DOCUMENTS_PAR_PAGE = 24;

export function formaterTaille(octets: number | null | undefined): string {
  if (octets === null || octets === undefined) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export interface RefusFichier {
  raison: 'type' | 'taille';
  message: string;
}

/**
 * Vérifie ce qui peut l'être avant de solliciter le réseau.
 *
 * Un fichier accepté ici peut encore être refusé par le serveur — c'est normal,
 * et c'est le serveur qui a raison.
 */
export function verifierFichier(fichier: File): RefusFichier | null {
  if (!(TYPES_AUTORISES as readonly string[]).includes(fichier.type)) {
    return {
      raison: 'type',
      message: `Ce format n’est pas accepté. Formats autorisés : PDF, images, documents Word, tableurs Excel, CSV et texte.`,
    };
  }
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return {
      raison: 'taille',
      message: `Ce fichier dépasse ${TAILLE_MAX_LISIBLE}. Réduisez-le ou déposez-le en plusieurs parties.`,
    };
  }
  return null;
}
