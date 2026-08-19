import { beforeEach, describe, expect, it } from 'vitest';

import { migrateStorageKeys } from './migrate-storage-keys';

/**
 * La reprise après changement de marque.
 *
 * Ce qui se joue ici est une perte silencieuse : sans reprise, l'utilisateur
 * retrouve des réglages par défaut sans qu'aucun message ne l'explique, et le
 * module Véhicules — stocké NULLE PART ailleurs que dans le navigateur —
 * disparaît. Un défaut qu'on attribue au navigateur plutôt qu'au déploiement.
 */
describe('migrateStorageKeys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('recopie les préférences sous leur nouveau nom, et retire les anciennes', () => {
    localStorage.setItem('nexoratech-theme', 'dark');
    localStorage.setItem('nexoratech-accent-color', '#ff0000');
    localStorage.setItem('nexoratech_current_organization', 'org-42');

    migrateStorageKeys();

    expect(localStorage.getItem('rezo360-theme')).toBe('dark');
    expect(localStorage.getItem('rezo360-accent-color')).toBe('#ff0000');
    expect(localStorage.getItem('rezo360_current_organization')).toBe('org-42');
    // L'ancienne clé disparaît : la laisser ferait diverger les deux au premier
    // changement de réglage.
    expect(localStorage.getItem('nexoratech-theme')).toBeNull();
  });

  it('reprend les clés à identifiant variable, une par organisation', () => {
    // Le cas qui coûte le plus cher : ces données n'existent qu'ici.
    localStorage.setItem('nexoratech_fleet_vehicles_org-a', '[{"id":"v1"}]');
    localStorage.setItem('nexoratech_fleet_vehicles_org-b', '[{"id":"v2"}]');

    migrateStorageKeys();

    expect(localStorage.getItem('rezo360_fleet_vehicles_org-a')).toBe('[{"id":"v1"}]');
    expect(localStorage.getItem('rezo360_fleet_vehicles_org-b')).toBe('[{"id":"v2"}]');
    expect(localStorage.getItem('nexoratech_fleet_vehicles_org-a')).toBeNull();
  });

  it('n’écrase jamais une valeur déjà posée sous le nouveau nom', () => {
    // Elle est forcément plus récente que celle d'avant le renommage.
    localStorage.setItem('nexoratech-theme', 'dark');
    localStorage.setItem('rezo360-theme', 'light');

    migrateStorageKeys();

    expect(localStorage.getItem('rezo360-theme')).toBe('light');
    expect(localStorage.getItem('nexoratech-theme')).toBeNull();
  });

  it('ne repasse pas une seconde fois', () => {
    localStorage.setItem('nexoratech-theme', 'dark');
    migrateStorageKeys();

    // L'utilisateur change d'avis APRÈS la reprise, puis rouvre l'application.
    localStorage.setItem('rezo360-theme', 'light');
    localStorage.setItem('nexoratech-theme', 'dark');
    migrateStorageKeys();

    // Sans le drapeau, la vieille valeur pourrait revenir hanter le réglage.
    expect(localStorage.getItem('rezo360-theme')).toBe('light');
  });

  it('laisse intactes les données héritées que la purge doit encore trouver', () => {
    // `purge-demo-storage.ts` cherche ces clés sous leur ANCIEN nom, parce que
    // c'est sous ce nom qu'elles dorment. Un balayage par préfixe les aurait
    // emportées, et le ménage se serait annoncé fait sans rien retirer.
    localStorage.setItem('nexoratech_local_missions', '[]');
    localStorage.setItem('nexoratech_demo_teams', '[]');

    migrateStorageKeys();

    expect(localStorage.getItem('nexoratech_local_missions')).toBe('[]');
    expect(localStorage.getItem('nexoratech_demo_teams')).toBe('[]');
    expect(localStorage.getItem('rezo360_local_missions')).toBeNull();
  });

  it('ne fait rien, et surtout ne lève pas, sur un stockage vierge', () => {
    expect(() => {
      migrateStorageKeys();
    }).not.toThrow();
  });
});
