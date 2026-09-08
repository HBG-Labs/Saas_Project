import { describe, expect, it } from 'vitest';

import { isIndustryCode } from '@/config/industries';
import { FEATURES, type FeatureKey } from '@/features/billing';
import {
  ACCOUNT_NAV,
  APP_NAV,
  LIBRARY_NAV,
  MOBILE_NAV_CANDIDATES,
  MOBILE_NAV_SIZE,
  ORGANIZATION_NAV,
  SIDEBAR_GROUPS,
  type NavItem,
} from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { TECHNICIAN_SIDEBAR_GROUPS } from '@/config/technician-navigation';

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './rbac';

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

  it('mène à la bibliothèque depuis les DEUX barres latérales', () => {
    /*
      LE DÉFAUT QUE CE TEST INTERDIT

      `AppLayout` sert `TECHNICIAN_SIDEBAR_GROUPS` aux techniciens et
      `SIDEBAR_GROUPS` à tous les autres. La bibliothèque était déclarée dans
      « Stock », absent de la première : un technicien portait bien
      `document.view`, la RLS l'aurait laissé lire, et l'écran restait
      inatteignable faute du moindre lien.

      Aucun typage ne relie une permission accordée à un chemin d'accès, et
      aucun test ne couvrait la seconde barre. La régression était donc muette :
      la permission existait, la page existait, personne ne s'en servait.
    */
    const destinations = (groupes: readonly { items: readonly NavItem[] }[]) =>
      new Set(groupes.flatMap((groupe) => groupe.items).map((item) => item.to));

    expect(destinations(SIDEBAR_GROUPS)).toContain(ROUTES.documents);
    expect(destinations(TECHNICIAN_SIDEBAR_GROUPS)).toContain(ROUTES.documents);
  });

  it('réserve la bibliothèque à sa permission, sans jamais regarder le rôle', () => {
    // Un technicien y accède parce qu'il porte `document.view`, pas parce que
    // son rôle a été nommé quelque part. C'est ce que garantit la déclaration :
    // une permission et une formule, rien d'autre.
    const bibliotheque = LIBRARY_NAV[0];

    expect(bibliotheque?.permission).toBe(PERMISSIONS.documentView);
    expect(bibliotheque?.feature).toBe(FEATURES.documents);
    expect(ROLE_PERMISSIONS.technician).toContain(PERMISSIONS.documentView);
  });

  it('ne propose qu’une seule section d’outils, dans les deux barres', () => {
    /*
      La barre en portait deux : « Boîte à outils » et « Outils Métiers ».
      Aucun doublon technique — les destinations diffèrent — mais deux
      en-têtes commençant par le même mot, donc un choix à deviner puis à
      retenir avant chaque recherche d'outil.

      Ce test échoue si un second volet « outils » réapparaît d'un côté ou de
      l'autre : c'est le genre de scission qui revient sans qu'on y pense, en
      ajoutant une famille d'outils.
    */
    const sectionsOutils = (groupes: readonly { label: string }[]) =>
      groupes.filter((groupe) => groupe.label.toLowerCase().includes('outil'));

    expect(sectionsOutils(SIDEBAR_GROUPS)).toHaveLength(1);
    expect(sectionsOutils(TECHNICIAN_SIDEBAR_GROUPS)).toHaveLength(1);
  });

  it('garde les outils métiers accessibles depuis la section fusionnée', () => {
    // La fusion ne doit pas faire disparaître de destination : c'est le risque
    // d'un regroupement fait à la main.
    const destinations = new Set(
      SIDEBAR_GROUPS.flatMap((groupe) => groupe.items).map((item) => item.to),
    );

    expect(destinations).toContain(ROUTES.metiers);
    expect(destinations).toContain(ROUTES.tools);
    expect(destinations).toContain(`${ROUTES.metiers}/fibre-optique`);
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
