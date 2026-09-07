import type { DocumentFolder } from '@/types/domain';

/**
 * L'arborescence des dossiers, calculée à partir de la liste plate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EST PUR
 *
 * La base renvoie une liste plate — c'est la bonne forme pour un transfert, et
 * la seule qu'un index sache servir. La forme d'arbre, elle, n'intéresse que
 * l'affichage : la calculer ici plutôt que dans un composant la rend testable
 * sans DOM, et évite qu'elle soit recalculée dans trois écrans à la fois.
 *
 * Aucune de ces fonctions n'est une protection. Les invariants — pas de cycle,
 * pas de parent d'une autre organisation, profondeur bornée — sont tenus par
 * `app.guard_document_folder()`. Ce qui suit sert à ne PAS PROPOSER ce que le
 * serveur refuserait ; si le serveur refuse quand même, il a raison.
 *
 * Les parcours sont malgré tout bornés. Non par méfiance envers le trigger,
 * mais parce qu'une liste tronquée — une page de dossiers dont les parents sont
 * hors lot — produit les mêmes symptômes qu'un cycle : une boucle infinie dans
 * le navigateur de l'utilisateur, écran figé, sans message.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Garde-fou de parcours. La base en autorise 10 ; on se laisse de la marge. */
const PROFONDEUR_MAX = 32;

export interface NoeudDossier {
  dossier: DocumentFolder;
  enfants: NoeudDossier[];
  /** 0 pour un dossier de premier niveau. */
  profondeur: number;
}

function parId(dossiers: readonly DocumentFolder[]): Map<string, DocumentFolder> {
  return new Map(dossiers.map((d) => [d.id, d]));
}

/** Les dossiers directement contenus dans `parentId`, triés par nom. */
export function enfantsDe(
  dossiers: readonly DocumentFolder[],
  parentId: string | null,
): DocumentFolder[] {
  return dossiers
    .filter((d) => (d.parent_folder_id ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

/**
 * L'arbre complet, racines en tête.
 *
 * Un dossier dont le parent est absent de la liste est traité comme une racine
 * plutôt qu'ignoré : le faire disparaître le rendrait inatteignable, alors que
 * le montrer au premier niveau reste vrai — il existe, et l'utilisateur peut
 * agir dessus.
 */
export function construireArbre(dossiers: readonly DocumentFolder[]): NoeudDossier[] {
  const connus = parId(dossiers);

  const racines = dossiers.filter((d) => {
    const parent = d.parent_folder_id;
    return parent === null || !connus.has(parent);
  });

  const trier = (liste: DocumentFolder[]) =>
    [...liste].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

  const visites = new Set<string>();

  function noeud(dossier: DocumentFolder, profondeur: number): NoeudDossier {
    visites.add(dossier.id);

    const enfants =
      profondeur >= PROFONDEUR_MAX
        ? []
        : trier(dossiers.filter((d) => d.parent_folder_id === dossier.id && !visites.has(d.id))).map(
            (enfant) => noeud(enfant, profondeur + 1),
          );

    return { dossier, enfants, profondeur };
  }

  return trier(racines).map((racine) => noeud(racine, 0));
}

/**
 * Le chemin de la racine jusqu'à `dossierId`, celui-ci compris.
 *
 * C'est le fil d'Ariane. Renvoie un tableau vide pour la racine (`null`) ou
 * pour un identifiant inconnu — l'écran affiche alors « Bibliothèque » seule,
 * ce qui est la vérité : on ne sait pas où l'on est, donc on est en haut.
 */
export function cheminDe(
  dossiers: readonly DocumentFolder[],
  dossierId: string | null,
): DocumentFolder[] {
  if (dossierId === null) return [];

  const connus = parId(dossiers);
  const chemin: DocumentFolder[] = [];
  const vus = new Set<string>();

  let courant = connus.get(dossierId);
  while (courant !== undefined && !vus.has(courant.id) && chemin.length < PROFONDEUR_MAX) {
    vus.add(courant.id);
    chemin.unshift(courant);
    courant = courant.parent_folder_id === null ? undefined : connus.get(courant.parent_folder_id);
  }

  return chemin;
}

/** Les identifiants de tous les descendants de `dossierId`, lui exclu. */
export function descendantsDe(
  dossiers: readonly DocumentFolder[],
  dossierId: string,
): Set<string> {
  const trouves = new Set<string>();
  let frontiere = [dossierId];
  let profondeur = 0;

  while (frontiere.length > 0 && profondeur < PROFONDEUR_MAX) {
    const suivante: string[] = [];
    for (const dossier of dossiers) {
      const parent = dossier.parent_folder_id;
      if (parent !== null && frontiere.includes(parent) && !trouves.has(dossier.id)) {
        trouves.add(dossier.id);
        suivante.push(dossier.id);
      }
    }
    frontiere = suivante;
    profondeur += 1;
  }

  return trouves;
}

export interface OptionDossier {
  id: string | null;
  /** « Clients / Orange / Plans » — le chemin complet, pas le seul nom. */
  chemin: string;
  profondeur: number;
}

/**
 * Les destinations proposables pour un déplacement, chemin complet en libellé.
 *
 * `aDeplacer` retire de la liste le dossier lui-même ET ses descendants : les
 * y déplacer créerait un cycle, que le serveur refuse. Proposer une action
 * vouée à l'échec est une faute d'interface, pas une sécurité en moins.
 *
 * Deux dossiers « Plans » dans deux branches différentes portent le même nom :
 * afficher le chemin est ce qui les distingue.
 */
export function destinationsPossibles(
  dossiers: readonly DocumentFolder[],
  aDeplacer?: string,
): OptionDossier[] {
  const exclus = aDeplacer === undefined ? new Set<string>() : descendantsDe(dossiers, aDeplacer);
  if (aDeplacer !== undefined) exclus.add(aDeplacer);

  const options: OptionDossier[] = [{ id: null, chemin: 'Bibliothèque', profondeur: 0 }];

  function parcourir(noeuds: NoeudDossier[], prefixe: string) {
    for (const noeud of noeuds) {
      if (exclus.has(noeud.dossier.id)) continue;
      const chemin = prefixe === '' ? noeud.dossier.name : `${prefixe} / ${noeud.dossier.name}`;
      options.push({ id: noeud.dossier.id, chemin, profondeur: noeud.profondeur + 1 });
      parcourir(noeud.enfants, chemin);
    }
  }

  parcourir(construireArbre(dossiers), '');
  return options;
}

/** Nom affichable d'un dossier, ou « Bibliothèque » pour la racine. */
export function nomDeDossier(
  dossiers: readonly DocumentFolder[],
  dossierId: string | null,
): string {
  if (dossierId === null) return 'Bibliothèque';
  return dossiers.find((d) => d.id === dossierId)?.name ?? 'Dossier introuvable';
}
