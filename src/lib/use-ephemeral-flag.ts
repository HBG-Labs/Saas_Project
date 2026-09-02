import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Un indicateur qui se rabaisse tout seul, et qui n'écrit pas dans le vide.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'IL REMPLACE
 *
 * Vingt-sept endroits répétaient les mêmes trois lignes :
 *
 *     const [copied, setCopied] = useState(false);
 *     setCopied(true);
 *     setTimeout(() => setCopied(false), 2000);
 *
 * Deux seulement appelaient `clearTimeout`. Les vingt-cinq autres laissaient
 * un minuteur courir après le démontage : copier une référence puis fermer la
 * modale dans les deux secondes déclenchait une mise à jour d'état sur un
 * composant qui n'existait plus. Sans conséquence visible, mais c'est
 * exactement le genre de fuite qu'on ne voit jamais et qui s'accumule.
 *
 * Ici le minuteur est annulé au démontage ET à chaque nouveau déclenchement :
 * presser deux fois de suite ne laisse pas le premier minuteur éteindre
 * l'indicateur pendant que le second court encore.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @param duree Durée d'affichage en millisecondes. 2 s pour une confirmation
 *              de copie, davantage pour un message qu'il faut avoir le temps
 *              de lire.
 */
export function useEphemeralFlag(duree = 2000): [boolean, () => void, () => void] {
  const [actif, setActif] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annuler = () => {
    if (minuteur.current !== null) {
      clearTimeout(minuteur.current);
      minuteur.current = null;
    }
  };

  const declencher = useCallback(() => {
    annuler();
    setActif(true);
    minuteur.current = setTimeout(() => {
      setActif(false);
      minuteur.current = null;
    }, duree);
  }, [duree]);

  /*
    Rabaisser l'indicateur tout de suite, sans attendre l'échéance.

    Utile quand une nouvelle tentative commence : laisser « Enregistré » à
    l'écran pendant qu'un second envoi est en cours ferait croire au résultat
    du précédent.
  */
  const reinitialiser = useCallback(() => {
    annuler();
    setActif(false);
  }, []);

  useEffect(() => annuler, []);

  return [actif, declencher, reinitialiser];
}

/**
 * Même chose, mais l'indicateur porte une valeur au lieu d'un booléen.
 *
 * Pour « quel champ vient d'être copié » ou « quel message afficher un
 * instant » : la valeur revient à `null` d'elle-même, et le minuteur est
 * annulé au démontage comme au déclenchement suivant.
 */
export function useEphemeralValue<T>(
  duree = 2000,
): [T | null, (valeur: T) => void, () => void] {
  const [valeur, setValeur] = useState<T | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annuler = () => {
    if (minuteur.current !== null) {
      clearTimeout(minuteur.current);
      minuteur.current = null;
    }
  };

  const afficher = useCallback(
    (v: T) => {
      annuler();
      setValeur(v);
      minuteur.current = setTimeout(() => {
        setValeur(null);
        minuteur.current = null;
      }, duree);
    },
    [duree],
  );

  const effacer = useCallback(() => {
    annuler();
    setValeur(null);
  }, []);

  useEffect(() => annuler, []);

  return [valeur, afficher, effacer];
}
