import { describe, expect, it } from 'vitest';

import { FEATURES, type FeatureKey } from '@/features/billing';
import {
  ACCOUNT_NAV,
  APP_NAV,
  MOBILE_NAV,
  ORGANIZATION_NAV,
  type NavItem,
} from '@/config/navigation';

import { PERMISSIONS, type Permission } from './rbac';

/**
 * `NavItem.permission` et `NavItem.feature` sont typés `string` : `config/` est
 * la couche la plus basse et ne doit dépendre d'aucune feature, elle ne peut
 * donc pas référencer `Permission` ni `FeatureKey`.
 *
 * Le prix de ce découplage est qu'une faute de frappe — `'mission.view-all'`
 * pour `'mission.view_all'` — compilerait sans rien signaler. `useVisibleNavItems`
 * comparerait alors une permission inexistante, la trouverait absente de tous les
 * rôles, et l'entrée disparaîtrait du menu POUR TOUT LE MONDE, propriétaire
 * compris. Aucune erreur, aucune trace : juste une section devenue introuvable.
 *
 * Ces tests rétablissent la garantie que le typage ne peut pas offrir ici.
 */

const ALL_NAV: readonly NavItem[] = [
  ...APP_NAV,
  ...ORGANIZATION_NAV,
  ...ACCOUNT_NAV,
  ...MOBILE_NAV,
];

describe('configuration de navigation', () => {
  const knownPermissions = new Set<string>(Object.values(PERMISSIONS) as Permission[]);
  const knownFeatures = new Set<string>(Object.values(FEATURES) as FeatureKey[]);

  it("n'exige que des permissions existantes", () => {
    for (const item of ALL_NAV) {
      if (item.permission === undefined) continue;

      expect(
        knownPermissions,
        `« ${item.label} » exige la permission inconnue « ${item.permission} »`,
      ).toContain(item.permission);
    }
  });

  it("n'exige que des fonctionnalités existantes", () => {
    for (const item of ALL_NAV) {
      if (item.feature === undefined) continue;

      expect(
        knownFeatures,
        `« ${item.label} » exige la fonctionnalité inconnue « ${item.feature} »`,
      ).toContain(item.feature);
    }
  });

  it('ne déclare pas deux entrées vers la même destination', () => {
    const appTargets = APP_NAV.map((item) => item.to);
    expect(new Set(appTargets).size).toBe(appTargets.length);
  });

  it('limite la navigation basse à quatre entrées', () => {
    // Au-delà, les cibles tactiles passent sous les 44 px recommandés par
    // WCAG 2.5.5 sur les téléphones étroits.
    expect(MOBILE_NAV.length).toBeLessThanOrEqual(4);
  });
});
