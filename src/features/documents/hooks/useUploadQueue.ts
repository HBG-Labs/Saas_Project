import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { qk } from '@/lib/query-keys';

import { uploadDocument } from '../api/documents.api';
import { verifierFichier } from '../constants';

export type EtatFichier = 'en_attente' | 'envoi' | 'reussi' | 'echec';

export interface FichierEnFile {
  /** Stable pour React : deux fichiers peuvent porter le même nom. */
  id: string;
  fichier: File;
  etat: EtatFichier;
  erreur?: string;
}

export interface DemarrageFile {
  organizationId: string;
  uploadedBy: string;
  folderId: string | null;
}

/**
 * Le dépôt de plusieurs fichiers, un par un mais pas à la queue leu leu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN ÉCHEC N'ARRÊTE PAS LES AUTRES
 *
 * C'est la règle qui commande tout le reste. Sur un chantier, on dépose vingt
 * photos et deux notices ; qu'un fichier soit refusé — trop lourd, format
 * inattendu, réseau coupé le temps d'un tunnel — ne doit pas condamner les
 * vingt et un autres, ni obliger à tout recommencer pour savoir lesquels sont
 * passés. Chaque envoi est donc isolé, et son échec ne remonte pas : il
 * s'inscrit sur sa ligne.
 *
 * CE QUI EST REFUSÉ L'EST AVANT LE RÉSEAU
 *
 * Format et taille sont vérifiés à l'ajout dans la file. Laisser partir un
 * fichier de 80 Mo pour le voir rejeté par le bucket ferait payer à
 * l'utilisateur une attente entière avant de lui apprendre ce qu'on savait
 * dès le premier octet. Ce contrôle ne protège rien — le bucket décide — il
 * évite une attente inutile.
 *
 * TROIS DE FRONT
 *
 * Séquentiel, vingt fichiers prennent une minute. Sans limite, vingt requêtes
 * simultanées saturent une connexion mobile et se gênent entre elles. Trois
 * est le compromis : assez pour couvrir la latence, assez peu pour que l'ordre
 * d'achèvement reste lisible.
 *
 * PAS DE POURCENTAGE PAR FICHIER
 *
 * `supabase-js` ne rapporte pas l'avancement d'un envoi. Afficher une barre qui
 * progresse toute seule serait une animation, pas une information. Ce qui est
 * montré est vrai : l'état de chaque fichier, et le nombre de fichiers traités.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useFileTeleversement() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<FichierEnFile[]>([]);
  const [enCours, setEnCours] = useState(false);
  const compteur = useRef(0);

  /*
    LA RÉFÉRENCE EST LA SOURCE DE VÉRITÉ, L'ÉTAT N'EST QUE L'AFFICHAGE.

    `demarrer` est appelée juste après `ajouter`, dans le même gestionnaire de
    clic. Lire la file depuis `file` y renverrait la valeur du rendu précédent —
    donc une file vide, et aucun envoi. Passer par un `setFile` dont l'argument
    servirait de lecture ne marche pas davantage : React n'exécute pas l'updater
    au moment de l'appel.

    La référence, elle, est à jour dès l'instruction suivante. `setFile` la suit
    pour déclencher le rendu.
  */
  const fileRef = useRef<FichierEnFile[]>([]);

  const appliquer = useCallback((calcul: (precedente: FichierEnFile[]) => FichierEnFile[]) => {
    fileRef.current = calcul(fileRef.current);
    setFile(fileRef.current);
  }, []);

  const ajouter = useCallback(
    (fichiers: readonly File[]) => {
      appliquer((precedente) => [
        ...precedente,
        ...fichiers.map((fichier) => {
          compteur.current += 1;
          const probleme = verifierFichier(fichier);
          return {
            id: `${Date.now()}-${compteur.current}`,
            fichier,
            etat: probleme === null ? ('en_attente' as const) : ('echec' as const),
            ...(probleme === null ? {} : { erreur: probleme.message }),
          };
        }),
      ]);
    },
    [appliquer],
  );

  const retirer = useCallback(
    (id: string) => {
      appliquer((precedente) => precedente.filter((entree) => entree.id !== id));
    },
    [appliquer],
  );

  const vider = useCallback(() => {
    appliquer(() => []);
    setEnCours(false);
  }, [appliquer]);

  const marquer = useCallback(
    (id: string, etat: EtatFichier, erreur?: string) => {
      appliquer((precedente) =>
        precedente.map((entree) =>
          entree.id === id
            ? { ...entree, etat, ...(erreur === undefined ? {} : { erreur }) }
            : entree,
        ),
      );
    },
    [appliquer],
  );

  const demarrer = useCallback(
    async (contexte: DemarrageFile): Promise<{ reussis: number; echoues: number }> => {
      const aTraiter = fileRef.current.filter((entree) => entree.etat === 'en_attente');
      if (aTraiter.length === 0) return { reussis: 0, echoues: 0 };

      setEnCours(true);
      let reussis = 0;
      let echoues = 0;

      const restants = [...aTraiter];

      async function travailleur() {
        for (;;) {
          const entree = restants.shift();
          if (entree === undefined) return;

          marquer(entree.id, 'envoi');
          try {
            await uploadDocument({
              organizationId: contexte.organizationId,
              file: entree.fichier,
              name: entree.fichier.name.replace(/\.[^.]+$/, ''),
              uploadedBy: contexte.uploadedBy,
              folderId: contexte.folderId,
            });
            marquer(entree.id, 'reussi');
            reussis += 1;
          } catch {
            // Le détail Supabase ne dit rien d'actionnable ; ce qui compte est
            // que CE fichier n'est pas passé, et que les suivants continuent.
            marquer(entree.id, 'echec', 'Ce fichier n’a pas pu être envoyé.');
            echoues += 1;
          }
        }
      }

      await Promise.all([travailleur(), travailleur(), travailleur()]);

      setEnCours(false);
      await queryClient.invalidateQueries({ queryKey: qk.documents.all });

      return { reussis, echoues };
    },
    [marquer, queryClient],
  );

  const enAttente = file.filter((entree) => entree.etat === 'en_attente').length;
  const traites = file.filter(
    (entree) => entree.etat === 'reussi' || entree.etat === 'echec',
  ).length;

  return { file, ajouter, retirer, vider, demarrer, enCours, enAttente, traites };
}
