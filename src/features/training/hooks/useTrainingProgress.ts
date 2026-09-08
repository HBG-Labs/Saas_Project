import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth';
import { qk } from '@/lib/query-keys';

import {
  enregistrerProgression,
  listerProgression,
  type ProgressionCours,
} from '../api/progress.api';

/** Ancien emplacement, conservé pour les visiteurs et pour la reprise. */
const CLE_LOCALE = 'rezo360:tutorial-progress:v1';

type StockageLocal = Record<string, string[]>;

function lireStockageLocal(): StockageLocal {
  if (typeof window === 'undefined') return {};
  try {
    const brut = JSON.parse(window.localStorage.getItem(CLE_LOCALE) ?? '{}') as StockageLocal;
    return typeof brut === 'object' && brut !== null ? brut : {};
  } catch {
    return {};
  }
}

function ecrireStockageLocal(slug: string, chapitres: string[]) {
  try {
    const tout = lireStockageLocal();
    window.localStorage.setItem(CLE_LOCALE, JSON.stringify({ ...tout, [slug]: chapitres }));
  } catch {
    // La formation reste utilisable si le stockage du navigateur est indisponible.
  }
}

/**
 * La progression d'un parcours, cotée serveur dès qu'on est connecté.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX CHEMINS, PARCE QUE LES COURS SONT PUBLICS
 *
 * `/tutoriels` s'ouvre sans compte : un prospect peut suivre un parcours avant
 * même de s'inscrire. Il n'a pas d'identité, donc pas de ligne en base — sa
 * progression reste dans le navigateur, comme avant.
 *
 * Dès qu'une personne est connectée, la base fait autorité : elle retrouve sa
 * progression sur le poste du dépôt comme sur son téléphone.
 *
 * LA REPRISE N'A LIEU QU'UNE FOIS, ET N'ÉCRASE RIEN
 *
 * À la première ouverture connectée, ce qui traîne dans `localStorage` est
 * remonté — mais uniquement pour les parcours que la base ne connaît pas
 * encore. Sans cette précaution, une progression faite sur un autre appareil
 * serait remplacée par le souvenir, souvent plus ancien, de celui-ci.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useTrainingProgress(courseSlug: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const connecte = user !== null && user !== undefined;

  const requete = useQuery({
    queryKey: qk.training.progress(user?.id ?? 'anonyme'),
    queryFn: listerProgression,
    enabled: connecte,
  });

  const enregistrement = useMutation({
    mutationFn: (entree: { slug: string; chapitres: string[] }) =>
      enregistrerProgression(entree.slug, entree.chapitres),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.training.all }),
  });

  // Visiteur non connecté : le navigateur reste la seule mémoire.
  const [localCompleted, setLocalCompleted] = useState<string[]>(() =>
    courseSlug ? (lireStockageLocal()[courseSlug] ?? []) : [],
  );

  const reprisEffectue = useRef(false);
  const declencherEnregistrement = enregistrement.mutate;

  useEffect(() => {
    if (!connecte || !requete.isSuccess || reprisEffectue.current) return;
    reprisEffectue.current = true;

    const dejaEnBase = new Set((requete.data ?? []).map((p: ProgressionCours) => p.courseSlug));
    for (const [slug, chapitres] of Object.entries(lireStockageLocal())) {
      if (!dejaEnBase.has(slug) && chapitres.length > 0) {
        declencherEnregistrement({ slug, chapitres });
      }
    }
  }, [connecte, requete.isSuccess, requete.data, declencherEnregistrement]);

  const depuisLaBase =
    (requete.data ?? []).find((p) => p.courseSlug === courseSlug)?.chapitresTermines ?? [];

  const completed = connecte ? depuisLaBase : localCompleted;

  const definir = useCallback(
    (chapitres: string[]) => {
      if (courseSlug === undefined) return;

      if (!connecte) {
        setLocalCompleted(chapitres);
        ecrireStockageLocal(courseSlug, chapitres);
        return;
      }

      // Le cache est mis à jour AVANT la réponse du serveur : cocher un
      // chapitre doit se voir immédiatement, pas au bout d'un aller-retour.
      queryClient.setQueryData(
        qk.training.progress(user?.id ?? 'anonyme'),
        (precedent: ProgressionCours[] | undefined) => {
          const liste = precedent ?? [];
          const existe = liste.some((p) => p.courseSlug === courseSlug);
          return existe
            ? liste.map((p) =>
                p.courseSlug === courseSlug ? { ...p, chapitresTermines: chapitres } : p,
              )
            : [...liste, { courseSlug, chapitresTermines: chapitres }];
        },
      );

      declencherEnregistrement({ slug: courseSlug, chapitres });
    },
    [connecte, courseSlug, declencherEnregistrement, queryClient, user?.id],
  );

  return {
    completed,
    definir,
    /** Vrai tant que la progression du serveur n'est pas connue. */
    chargement: connecte && requete.isPending,
    /** L'enregistrement a échoué : la case cochée ne survivra pas au rechargement. */
    enEchec: enregistrement.isError,
    /** La progression est-elle conservée au-delà de ce navigateur ? */
    surLeServeur: connecte,
  };
}
