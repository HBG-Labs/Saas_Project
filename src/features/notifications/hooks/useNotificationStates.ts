import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { listNotificationStates, upsertNotificationStates } from '../api/notification-states.api';

/**
 * L'état lu / écarté des notifications, persisté par personne et par
 * organisation — et suivi d'un appareil à l'autre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI CHANGE, ET CE QUI NE CHANGE PAS
 *
 * Les notifications restent DÉRIVÉES : `useNotifications` les recalcule à
 * chaque rendu depuis l'état réel. Ce hook ne porte que ce qu'une personne en
 * a fait. Avant lui, cet état vivait dans `localStorage` : lu au bureau,
 * non lu sur le téléphone, et perdu au premier navigateur vidé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI LE STOCKAGE LOCAL RESTE
 *
 * Il devient un MIROIR, pour deux raisons :
 *
 * 1. Le repli. Si la base ne répond pas — ou si cette version du client
 *    tourne avant que la migration `notification_states` ait été appliquée —
 *    le comportement d'avant reprend, à l'identique. Le déploiement du front
 *    ne dépend donc pas de l'ordre d'application de la migration.
 *
 * 2. La reprise. Au premier chargement réussi, ce que le navigateur avait
 *    mémorisé et que la base ignore encore lui est envoyé. Personne ne
 *    retrouve « non lues » des notifications lues la veille.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const NOTIFICATION_STATES_QUERY_KEY = ['notification_states'] as const;

export interface NotificationStates {
  readIds: ReadonlySet<string>;
  dismissedIds: ReadonlySet<string>;
}

const VIDE: NotificationStates = { readIds: new Set(), dismissedIds: new Set() };

function cleLocale(genre: 'read' | 'dismissed', userId: string | null): string {
  const suffixe = userId ?? 'anonymous';
  return genre === 'read'
    ? `rezo360_read_notifications_${suffixe}`
    : `rezo360_dismissed_notifications_${suffixe}`;
}

function lireLocal(cle: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return new Set();
    const parse: unknown = JSON.parse(brut);
    return new Set(Array.isArray(parse) ? (parse as string[]) : []);
  } catch {
    return new Set();
  }
}

function ecrireLocal(cle: string, valeurs: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(cle, JSON.stringify(Array.from(valeurs)));
  } catch {
    // Stockage inaccessible
  }
}

function lireDrapeau(cle: string): boolean {
  try {
    return localStorage.getItem(cle) === '1';
  } catch {
    return false;
  }
}

function poserDrapeau(cle: string): void {
  try {
    localStorage.setItem(cle, '1');
  } catch {
    // Stockage inaccessible : la reprise se rejouera, ce qui reste sans danger
    // tant que l'application ne supprime jamais de ligne.
  }
}

function avec(ensemble: ReadonlySet<string>, ajouts: readonly string[]): Set<string> {
  const suivant = new Set(ensemble);
  for (const cle of ajouts) suivant.add(cle);
  return suivant;
}

export function useNotificationStates(userId: string | null, organizationId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => [...NOTIFICATION_STATES_QUERY_KEY, userId, organizationId] as const,
    [userId, organizationId],
  );
  /*
    Le miroir local est relu à chaque rendu — il n'est pas dans l'état React.
    Ce compteur force le rendu après une écriture, pour que le repli reflète
    aussitôt ce qu'on vient de marquer. Sans lui, sans organisation ou sans
    base, cliquer « lue » n'aurait d'effet qu'au rendu suivant, venu d'ailleurs.
  */
  const [, setVersionLocale] = useState(0);
  const cleLue = cleLocale('read', userId);
  const cleEcartee = cleLocale('dismissed', userId);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<NotificationStates> => {
      if (organizationId === null) return VIDE;
      const lignes = await listNotificationStates(organizationId);
      return {
        readIds: new Set(lignes.filter((l) => l.read_at !== null).map((l) => l.notification_key)),
        dismissedIds: new Set(
          lignes.filter((l) => l.dismissed_at !== null).map((l) => l.notification_key),
        ),
      };
    },
    enabled: userId !== null && organizationId !== null,
    staleTime: 60 * 1000,
    // Table absente, réseau coupé : on ne martèle pas, le repli local prend.
    retry: 1,
  });

  /*
    L'état effectif. Tant que la base n'a pas répondu — ou si elle a refusé —
    c'est le miroir local qui fait foi. Dès qu'elle a répondu, c'est elle.
  */
  const serveurDisponible = query.isSuccess;
  const etats: NotificationStates = serveurDisponible
    ? (query.data ?? VIDE)
    : { readIds: lireLocal(cleLue), dismissedIds: lireLocal(cleEcartee) };

  const mutation = useMutation({
    mutationFn: async (patch: {
      lues: readonly string[];
      ecartees: readonly string[];
      precedent: NotificationStates;
    }) => {
      if (userId === null || organizationId === null) return;
      const maintenant = new Date().toISOString();
      await upsertNotificationStates(userId, organizationId, [
        ...patch.lues.map((notification_key) => ({ notification_key, read_at: maintenant })),
        ...patch.ecartees.map((notification_key) => ({
          notification_key,
          dismissed_at: maintenant,
        })),
      ]);
    },
    onMutate: async () => {
      // Une relecture en vol écraserait l'état optimiste posé par `appliquer`.
      await queryClient.cancelQueries({ queryKey });
    },
    onError: (_erreur, patch) => {
      // Le miroir local a déjà reçu l'écriture (voir `appliquer`) : même si la
      // base refuse, l'état tient sur cet appareil, comme avant.
      queryClient.setQueryData(queryKey, patch.precedent);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const { mutate } = mutation;

  const appliquer = useCallback(
    (lues: readonly string[], ecartees: readonly string[]) => {
      // Le miroir d'abord — il est la source de vérité si la base est absente.
      if (lues.length > 0) ecrireLocal(cleLue, avec(lireLocal(cleLue), lues));
      if (ecartees.length > 0) ecrireLocal(cleEcartee, avec(lireLocal(cleEcartee), ecartees));
      setVersionLocale((v) => v + 1);

      if (userId === null || organizationId === null) return;

      /*
        Optimiste, et SYNCHRONE : la pastille disparaît au clic. `onMutate`
        aurait fait la même chose un tick plus tard — assez pour que l'œil
        voie l'ancien état, et pour qu'un test le constate.
      */
      const precedent = queryClient.getQueryData<NotificationStates>(queryKey) ?? VIDE;
      queryClient.setQueryData<NotificationStates>(queryKey, {
        readIds: avec(precedent.readIds, lues),
        dismissedIds: avec(precedent.dismissedIds, ecartees),
      });
      mutate({ lues, ecartees, precedent });
    },
    [cleLue, cleEcartee, userId, organizationId, queryClient, queryKey, mutate],
  );

  /*
    LA REPRISE, UNE FOIS PAR COMPTE ET PAR ORGANISATION — ET UNE FOIS POUR DE BON

    Au premier chargement réussi, ce que le navigateur savait et que la base
    ignore lui est envoyé. Effet légitime : c'est une synchronisation vers un
    système externe, déclenchée par l'arrivée d'une donnée.

    « Une fois » est mémorisé dans le navigateur, pas seulement dans ce rendu.
    Sinon chaque rechargement rejouerait la reprise, et un état retiré côté
    base reviendrait depuis le miroir — l'inverse de ce qu'on veut : après la
    reprise, c'est la base qui fait foi, le miroir ne remonte plus rien.

    La date posée est « maintenant » : celle de la lecture d'origine n'a jamais
    été mémorisée, et une date approximative vaut mieux qu'un état perdu.
  */
  const cleReprise = `rezo360_notifications_reprise_${userId ?? 'anonymous'}_${organizationId ?? ''}`;
  useEffect(() => {
    if (!serveurDisponible || userId === null || organizationId === null) return;
    if (lireDrapeau(cleReprise)) return;

    const distant = query.data ?? VIDE;
    const luesLocales = Array.from(lireLocal(cleLue)).filter((k) => !distant.readIds.has(k));
    const ecarteesLocales = Array.from(lireLocal(cleEcartee)).filter(
      (k) => !distant.dismissedIds.has(k),
    );

    // Posé AVANT l'envoi : si celui-ci échoue, on ne rejoue pas à l'infini —
    // le repli local couvre déjà ce cas, comme avant la migration.
    poserDrapeau(cleReprise);
    if (luesLocales.length === 0 && ecarteesLocales.length === 0) return;

    mutate({ lues: luesLocales, ecartees: ecarteesLocales, precedent: distant });
  }, [
    serveurDisponible,
    userId,
    organizationId,
    query.data,
    cleLue,
    cleEcartee,
    cleReprise,
    mutate,
  ]);

  return {
    readIds: etats.readIds,
    dismissedIds: etats.dismissedIds,
    /** `true` quand l'état vient de la base ; `false` tant que le miroir local fait foi. */
    synchronise: serveurDisponible,
    marquerLues: useCallback((cles: readonly string[]) => appliquer(cles, []), [appliquer]),
    ecarter: useCallback((cle: string) => appliquer([], [cle]), [appliquer]),
  };
}
