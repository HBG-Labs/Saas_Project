import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';

import { env } from '@/config/env';

/**
 * Pont entre la session REZO360 et l'identité OneSignal, côté app Capacitor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INERTE PAR DÉFAUT
 *
 * Deux conditions doivent être réunies pour que quoi que ce soit se produise :
 * tourner dans l'app native (`Capacitor.isNativePlatform()`) ET avoir
 * `VITE_ONESIGNAL_APP_ID` configuré. Un navigateur classique, un poste de
 * développement ou une prévisualisation n'enregistrent donc jamais d'appareil.
 *
 * POURQUOI CHAQUE UTILISATEUR, PAS SEULEMENT L'ADMINISTRATEUR
 *
 * `notify-admin-signup-worker` ne cible aujourd'hui qu'un seul identifiant
 * externe (`ONESIGNAL_ADMIN_EXTERNAL_ID`, côté secrets Supabase). Appeler
 * `login()` pour tout le monde ici ne coûte rien et évite de réécrire ce
 * fichier le jour où une deuxième personne doit recevoir des alertes.
 *
 * LE TAP SUR LA NOTIFICATION
 *
 * `window.location.assign` plutôt qu'une navigation React Router : ce module
 * n'a pas accès au routeur (il s'initialise en dehors de l'arbre React, avant
 * qu'un utilisateur soit forcément connecté), et un tap peut survenir alors
 * que l'application n'est même pas chargée (démarrage à froid depuis la
 * notification). Le coût est un rechargement complet plutôt qu'une transition
 * fluide — acceptable pour un événement qui survient quelques fois par jour.
 * ─────────────────────────────────────────────────────────────────────────────
 */

let initialized = false;

function ensureInitialized(): boolean {
  if (initialized) return true;
  if (!Capacitor.isNativePlatform()) return false;
  if (!env.VITE_ONESIGNAL_APP_ID) return false;

  try {
    OneSignal.initialize(env.VITE_ONESIGNAL_APP_ID);
    OneSignal.Notifications.addEventListener('click', (event) => {
      const data = event.notification.additionalData as Record<string, unknown> | undefined;
      const deepLink = typeof data?.deepLink === 'string' ? data.deepLink : '/dashboard';
      window.location.assign(deepLink);
    });
    initialized = true;
  } catch (error) {
    // Ne doit JAMAIS empêcher la connexion : une notification manquée est
    // sans commune mesure avec un écran d'authentification cassé.
    console.error('OneSignal : initialisation impossible', error);
  }

  return initialized;
}

/**
 * À appeler à chaque changement de session authentifiée (voir `AuthProvider`).
 *
 * `userId` non nul : associe l'appareil à cette identité et demande la
 * permission de notifier si elle n'a pas déjà été tranchée. `null` :
 * dissocie l'appareil (déconnexion) — sans quoi il resterait rattaché au
 * compte précédent sur un appareil partagé.
 */
export function syncPushIdentity(userId: string | null): void {
  if (!ensureInitialized()) return;

  try {
    if (userId) {
      OneSignal.login(userId);
      void OneSignal.Notifications.requestPermission(false);
    } else {
      OneSignal.logout();
    }
  } catch (error) {
    console.error('OneSignal : synchronisation de l’identité impossible', error);
  }
}
