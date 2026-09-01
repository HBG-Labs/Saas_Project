import { describe, expect, it } from 'vitest';

import { isIndustryCode } from '@/config/industries';
import { FEATURES, type FeatureKey } from '@/features/billing';
import {
  ACCOUNT_NAV,
  APP_NAV,
  MOBILE_NAV_CANDIDATES,
  MOBILE_NAV_SIZE,
  ORGANIZATION_NAV,
  SIDEBAR_GROUPS,
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
  ...MOBILE_NAV_CANDIDATES,
  ...SIDEBAR_GROUPS.flatMap((group) => group.items),
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

  it("n'exige que des métiers existants", () => {
    // Même piège que ci-dessus, et plus discret encore : un métier mal
    // orthographié ne correspondrait à aucune organisation, et l'entrée
    // disparaîtrait pour la totalité des utilisateurs sans jamais lever
    // d'erreur. On ne s'en apercevrait qu'en cherchant un écran qu'on croit
    // avoir livré.
    for (const item of ALL_NAV) {
      if (item.industry === undefined) continue;

      const codes = Array.isArray(item.industry) ? item.industry : [item.industry];

      for (const code of codes) {
        expect(
          isIndustryCode(code),
          `« ${item.label} » exige le métier inconnu « ${code} »`,
        ).toBe(true);
      }
    }
  });

  it('ne déclare pas deux entrées vers la même destination', () => {
    const appTargets = APP_NAV.map((item) => item.to);
    expect(new Set(appTargets).size).toBe(appTargets.length);
  });

  it('garde des cibles tactiles conformes sur le plus étroit des téléphones', () => {
    // L'ancienne version plafonnait la barre à quatre entrées « au-delà, les
    // cibles passent sous les 44 px de WCAG 2.5.5 ». La règle porte sur une
    // surface de 44x44 px, or c'est la LARGEUR que le nombre d'entrées divise,
    // pas la hauteur — fixée par `min-h-touch`. Le vrai garde-fou est donc
    // celui-ci, et il autorise cinq destinations : 5 x 44 = 220 px, largement
    // sous les 320 px de l'écran le plus étroit que le produit vise.
    const ECRAN_LE_PLUS_ETROIT = 320;
    const CIBLE_MINIMALE = 44;

    expect(MOBILE_NAV_SIZE * CIBLE_MINIMALE).toBeLessThanOrEqual(ECRAN_LE_PLUS_ETROIT);
  });

  it('propose plus de candidats que de places, pour combler les entrées filtrées', () => {
    // Une entrée peut disparaître selon l'abonnement ou les permissions. Sans
    // remplaçante, la barre se vide — c'est exactement le défaut corrigé ici.
    expect(MOBILE_NAV_CANDIDATES.length).toBeGreaterThan(MOBILE_NAV_SIZE);
  });
});

describe('sections de la barre latérale', () => {
  const groupedItems = SIDEBAR_GROUPS.flatMap((group) => group.items);

  it('ne range jamais la même destination dans deux sections', () => {
    // Une entrée présente deux fois obligerait à choisir entre deux chemins
    // pour un même écran — et l'indicateur d'onglet actif s'allumerait aux
    // deux endroits à la fois.
    const targets = groupedItems.map((item) => item.to);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('donne un identifiant distinct à chaque section', () => {
    const ids = SIDEBAR_GROUPS.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('expose chaque entrée d’organisation dans exactement une section', () => {
    // `ORGANIZATION_NAV` est dérivée des sections. Si la dérivation venait à
    // être remplacée par une liste saisie à la main, une entrée pourrait
    // exister dans l'une sans exister dans l'autre : visible au menu mais
    // absente des contrôles de validité ci-dessus, ou l'inverse.
    const grouped = new Set(groupedItems.map((item) => item.to));

    for (const item of ORGANIZATION_NAV) {
      expect(grouped, `« ${item.label} » n’appartient à aucune section`).toContain(item.to);
    }
  });

  it('ne donne à aucune section le nom d’une de ses entrées', () => {
    // Le défaut corrigé ici : la section « Entreprise » contenait une entrée
    // « Entreprise ». Rien ne permettait de deviner que la seconde menait à la
    // fiche de la société, et non à l'ensemble de la section.
    for (const group of SIDEBAR_GROUPS) {
      const labels = group.items.map((item) => item.label);

      expect(
        labels,
        `la section « ${group.label} » contient une entrée du même nom`,
      ).not.toContain(group.label);
    }
  });
});
