import { describe, expect, it } from 'vitest';

import {
  extractDeletedValuesAcross,
  extractInsertTuplesAcross,
  MIGRATION_FILES,
  stripCast,
} from '@/test/sql-fixtures';
import type { OrgRole } from '@/types/database';

import {
  canReviewReport,
  ORG_ROLES,
  PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  roleHasAnyPermission,
  roleHasPermission,
  type Permission,
} from './rbac';

describe('matrice RBAC', () => {
  it('couvre les six rôles', () => {
    expect(ORG_ROLES).toHaveLength(6);
    for (const role of ORG_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("n'attribue aucune permission en double", () => {
    for (const role of ORG_ROLES) {
      const permissions = ROLE_PERMISSIONS[role];
      expect(new Set(permissions).size, `doublon pour « ${role} »`).toBe(permissions.length);
    }
  });

  it('respecte le format <ressource>.<action>', () => {
    for (const role of ORG_ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(permission).toMatch(/^[a-z_]+\.[a-z_]+$/);
      }
    }
  });
});

describe('moindre privilège', () => {
  it('réserve la suppression de l’organisation et la facturation au propriétaire', () => {
    for (const role of ORG_ROLES) {
      const expected = role === 'owner';
      expect(roleHasPermission(role, PERMISSIONS.organizationDelete)).toBe(expected);
      expect(roleHasPermission(role, PERMISSIONS.billingManage)).toBe(expected);
    }
  });

  it("n'autorise aucun technicien à contrôler une intervention", () => {
    // Exigence §12 : le technicien exécute, il ne valide pas.
    expect(roleHasPermission('technician', PERMISSIONS.interventionReview)).toBe(false);
    expect(roleHasPermission('technician', PERMISSIONS.missionViewAll)).toBe(false);
    expect(roleHasPermission('technician', PERMISSIONS.interventionViewAll)).toBe(false);
  });

  it("n'autorise aucun technicien à modifier l'organisation ni les rôles", () => {
    expect(roleHasPermission('technician', PERMISSIONS.organizationUpdate)).toBe(false);
    expect(roleHasPermission('technician', PERMISSIONS.memberUpdateRole)).toBe(false);
    expect(roleHasPermission('technician', PERMISSIONS.memberInvite)).toBe(false);
  });

  it("limite l'employé à la consultation, hors demande de congé", () => {
    // `leave.request` est la SEULE écriture ouverte à l'employé, et elle ne
    // porte que sur lui-même : le trigger `enforce_leave_decision` refuse une
    // demande déposée au nom d'un tiers sans `leave.approve`. Poser un congé
    // n'est pas un acte de gestion, c'est un droit du salarié.
    expect(ROLE_PERMISSIONS.employee).toEqual([
      'organization.view',
      'member.view',
      'leave.request',
    ]);
  });

  it("n'accorde plus aucun droit de suivi de position", () => {
    // Le suivi GPS continu est abandonné : le produit ne localise plus ses
    // salariés. Ce test échouera si une permission `location.*` réapparaît —
    // c'est-à-dire si quelqu'un rebranche le suivi sans que la décision ait été
    // reprise. Une capacité retirée doit rester retirée, faute de quoi elle
    // revient par un correctif de trois lignes.
    const all: string[] = Object.values(PERMISSIONS);
    expect(all.filter((permission) => permission.startsWith('location.'))).toEqual([]);
  });

  it("n'accorde pas au chef d'équipe le droit de valider un congé", () => {
    // Il constate les absences pour organiser ses semaines ; les accorder est
    // une décision d'employeur.
    expect(roleHasPermission('team_leader', PERMISSIONS.leaveView)).toBe(true);
    expect(roleHasPermission('team_leader', PERMISSIONS.leaveApprove)).toBe(false);
  });

  it("ne donne pas la vue globale des missions au chef d'équipe", () => {
    // Il voit les missions de SES équipes — décidé par appartenance dans la
    // policy, pas par une permission générale.
    expect(roleHasPermission('team_leader', PERMISSIONS.missionViewAll)).toBe(false);
    expect(roleHasPermission('team_leader', PERMISSIONS.interventionReview)).toBe(true);
  });

  it('interdit au manager de toucher aux rôles et à la facturation', () => {
    expect(roleHasPermission('manager', PERMISSIONS.memberUpdateRole)).toBe(false);
    expect(roleHasPermission('manager', PERMISSIONS.billingView)).toBe(false);
    expect(roleHasPermission('manager', PERMISSIONS.organizationUpdate)).toBe(false);
  });

  it('donne au propriétaire au moins tout ce que possède un administrateur', () => {
    for (const permission of ROLE_PERMISSIONS.admin) {
      expect(ROLE_PERMISSIONS.owner).toContain(permission);
    }
  });

  it('refuse toute permission à un rôle nul', () => {
    expect(roleHasPermission(null, PERMISSIONS.organizationView)).toBe(false);
    expect(roleHasAnyPermission(null, [PERMISSIONS.missionCreate])).toBe(false);
  });
});

describe('canReviewReport — séparation des pouvoirs', () => {
  it('autorise un manager à contrôler le compte rendu d’un tiers', () => {
    expect(
      canReviewReport({
        role: 'manager',
        reviewerUserId: 'user-manager',
        technicianUserId: 'user-technicien',
      }),
    ).toBe(true);
  });

  it('refuse à quiconque de contrôler son propre compte rendu', () => {
    // Le cas réel : un chef d'équipe descendu sur le terrain. Il A la
    // permission de contrôler — c'est l'identité qui doit le bloquer.
    expect(
      canReviewReport({
        role: 'team_leader',
        reviewerUserId: 'user-chef',
        technicianUserId: 'user-chef',
      }),
    ).toBe(false);
  });

  it('refuse un technicien même sur le compte rendu d’un autre', () => {
    expect(
      canReviewReport({
        role: 'technician',
        reviewerUserId: 'user-a',
        technicianUserId: 'user-b',
      }),
    ).toBe(false);
  });

  it('refuse quand une identité est inconnue', () => {
    expect(
      canReviewReport({ role: 'owner', reviewerUserId: null, technicianUserId: 'user-b' }),
    ).toBe(false);
  });
});

describe('synchronisation avec le seed SQL', () => {
  // Les permissions « customer.* » sont arrivées après coup, dans leur propre
  // migration. Ne lire que le seed d'origine ferait conclure à une divergence du
  // miroir alors que c'est la vision du SQL qui serait incomplète.
  const tuples = extractInsertTuplesAcross(
    [
      MIGRATION_FILES.rbac,
      MIGRATION_FILES.rbacCustomers,
      MIGRATION_FILES.equipment,
      MIGRATION_FILES.quotes,
      MIGRATION_FILES.planning,
      MIGRATION_FILES.locations,
      MIGRATION_FILES.retireTracking,
    ],
    'role_permissions',
  );

  // Une permission peut être RETIRÉE : le suivi GPS abandonné emporte
  // `location.view_all`. Cumuler les seuls `insert` décrirait un état que la
  // base n'a plus.
  const revoked = extractDeletedValuesAcross(
    [MIGRATION_FILES.retireTracking],
    'role_permissions',
    'permission',
  );

  const seeded = new Map<OrgRole, Set<string>>();
  for (const tuple of tuples) {
    const role = stripCast(tuple[0] ?? '') as OrgRole;
    const permission = stripCast(tuple[1] ?? '');
    if (revoked.has(permission)) continue;
    if (!seeded.has(role)) seeded.set(role, new Set());
    seeded.get(role)?.add(permission);
  }

  it('extrait une matrice non vide', () => {
    expect(tuples.length).toBeGreaterThan(50);
    expect(seeded.size).toBe(6);
  });

  it('déclare exactement les mêmes permissions que le miroir TypeScript', () => {
    for (const role of ORG_ROLES) {
      const fromSql = [...(seeded.get(role) ?? [])].sort();
      const fromTs = [...ROLE_PERMISSIONS[role]].sort();

      expect(fromTs, `divergence pour le rôle « ${role} »`).toEqual(fromSql);
    }
  });

  it("n'introduit aucun rôle absent du miroir", () => {
    for (const role of seeded.keys()) {
      expect(ORG_ROLES).toContain(role);
    }
  });

  it('utilise exclusivement des permissions déclarées dans PERMISSIONS', () => {
    const known = new Set<string>(Object.values(PERMISSIONS) as Permission[]);

    for (const [role, permissions] of seeded) {
      for (const permission of permissions) {
        expect(known, `« ${permission} » (rôle ${role}) absent de PERMISSIONS`).toContain(
          permission,
        );
      }
    }
  });
});
