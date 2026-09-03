import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NavGroup } from '@/config/navigation';

import { useVisibleNavGroups, useVisibleNavItems } from './useVisibleNavItems';

/**
 * Ce que le menu montre, et ce qu'il cache.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA DISTINCTION QUE CES TESTS PROTÈGENT
 *
 * Il existe deux raisons de ne pas pouvoir ouvrir une section, et elles
 * n'appellent pas le même traitement :
 *
 *   • la FORMULE ne l'inclut pas — il y a quelque chose à faire, donc on
 *     l'affiche, cadenassée ;
 *   • le RÔLE ou le MÉTIER ne la concernent pas — il n'y a rien à faire, donc
 *     on la retire.
 *
 * Les fondre en un seul filtre est exactement ce qui se produisait avant, et
 * c'est une régression silencieuse : le menu redevient muet sur tout ce qui
 * s'achète, sans qu'aucun test n'échoue.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const formule = vi.hoisted(() => ({ ouvertes: new Set<string>() }));
const droits = vi.hoisted(() => ({ accordees: new Set<string>() }));
const metier = vi.hoisted(() => ({ code: 'general' }));

vi.mock('@/features/billing', () => ({
  useOrganizationEntitlements: () => ({
    has: (feature: string) => formule.ouvertes.has(feature),
    isLoading: false,
  }),
}));

vi.mock('@/features/industries', () => ({
  useCurrentIndustry: () => ({
    code: metier.code,
    vocabulary: { worker: 'Technicien', job: 'Mission', visit: 'Intervention' },
    overrides: {},
    label: 'Général',
    isResolved: true,
  }),
}));

vi.mock('./useCurrentOrganization', () => ({
  useCurrentOrganization: () => ({ organization: { id: 'org-1' } }),
}));

vi.mock('./usePermission', () => ({
  usePermission: () => ({ can: (permission: string) => droits.accordees.has(permission) }),
}));

const SECTIONS: readonly NavGroup[] = [
  {
    id: 'terrain',
    label: 'Terrain',
    items: [
      { to: '/missions', label: 'Missions', icon: 'clipboard', feature: 'missions' },
      { to: '/devis', label: 'Devis', icon: 'calculator', feature: 'quotes' },
      { to: '/notes', label: 'Bloc-notes', icon: 'file-text' },
    ],
  },
  {
    id: 'pilotage',
    label: 'Pilotage',
    items: [
      { to: '/journal', label: 'Journal', icon: 'scroll', permission: 'audit.view' },
    ],
  },
];

beforeEach(() => {
  formule.ouvertes = new Set(['missions']);
  droits.accordees = new Set(['audit.view']);
  metier.code = 'general';
});

describe('useVisibleNavGroups', () => {
  it('garde les destinations hors formule, en les marquant verrouillées', () => {
    const { result } = renderHook(() => useVisibleNavGroups(SECTIONS));

    const terrain = result.current.find((g) => g.id === 'terrain');
    const devis = terrain?.items.find((item) => item.to === '/devis');

    expect(devis, '« Devis » ne doit pas disparaître du menu').toBeDefined();
    expect(devis?.locked).toBe(true);
  });

  it('laisse ouvertes les destinations incluses dans la formule', () => {
    const { result } = renderHook(() => useVisibleNavGroups(SECTIONS));
    const terrain = result.current.find((g) => g.id === 'terrain');

    expect(terrain?.items.find((item) => item.to === '/missions')?.locked).toBe(false);
  });

  it("n'attribue jamais de cadenas à une entrée sans exigence de formule", () => {
    const { result } = renderHook(() => useVisibleNavGroups(SECTIONS));
    const terrain = result.current.find((g) => g.id === 'terrain');

    expect(terrain?.items.find((item) => item.to === '/notes')?.locked).toBe(false);
  });

  it('RETIRE, sans cadenas, ce que le rôle ne permet pas', () => {
    // Un cadenas serait ici un contresens : aucune formule ne donnera le
    // journal d'audit à qui n'a pas la permission de le lire.
    droits.accordees = new Set();

    const { result } = renderHook(() => useVisibleNavGroups(SECTIONS));

    expect(result.current.find((g) => g.id === 'pilotage')).toBeUndefined();
  });

  it('RETIRE ce qui ne concerne pas le métier de l’organisation', () => {
    metier.code = 'general';

    const sectionsMetier: readonly NavGroup[] = [
      {
        id: 'specifique',
        label: 'Spécifique',
        items: [{ to: '/fibre', label: 'Fibre', icon: 'cable', industry: 'fibre_optique' }],
      },
    ];

    const { result } = renderHook(() => useVisibleNavGroups(sectionsMetier));

    expect(result.current).toHaveLength(0);
  });

  it('relègue les entrées cadenassées en fin de volet, sans changer leur ordre entre elles', () => {
    // Déclarées Missions, Devis, Bloc-notes ; seul « Devis » est verrouillé
    // (formule sans `quotes`). Il doit se retrouver dernier, et l'ordre des
    // deux autres — accessibles — rester celui de `navigation.ts`.
    const { result } = renderHook(() => useVisibleNavGroups(SECTIONS));
    const terrain = result.current.find((g) => g.id === 'terrain');

    expect(terrain?.items.map((item) => item.to)).toEqual(['/missions', '/notes', '/devis']);
  });

  it('affiche une section entièrement verrouillée plutôt que de la masquer', () => {
    // C'est le cas d'une organisation Gratuite devant « Stock » ou « Achats ».
    // Masquer la section entière reviendrait à masquer ce qu'on vend.
    formule.ouvertes = new Set();

    const toutFerme: readonly NavGroup[] = [
      {
        id: 'stock',
        label: 'Stock',
        items: [{ to: '/stock', label: 'Articles', icon: 'package', feature: 'equipment' }],
      },
    ];

    const { result } = renderHook(() => useVisibleNavGroups(toutFerme));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.items.every((item) => item.locked)).toBe(true);
  });
});

describe('useVisibleNavItems', () => {
  it('continue d’EXCLURE les destinations hors formule', () => {
    // La barre basse mobile n'a que cinq places, et chacune doit mener quelque
    // part : y afficher un cadenas coûterait une destination utile.
    const { result } = renderHook(() => useVisibleNavItems(SECTIONS[0]!.items));

    expect(result.current.map((item) => item.to)).toEqual(['/missions', '/notes']);
  });
});
