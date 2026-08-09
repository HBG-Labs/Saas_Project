import { describe, expect, it } from 'vitest';

import {
  extractInsertTuples,
  MIGRATION_FILES,
  readMigration,
  stripCast,
} from '@/test/sql-fixtures';
import type { MissionStatus } from '@/types/database';

import {
  getAvailableTransitions,
  getPermittedTransitions,
  isTransitionAllowed,
  MISSION_STATUS_LABELS,
  MISSION_TRANSITIONS,
  TERMINAL_STATUSES,
} from './workflow';

describe('machine à états des missions', () => {
  it('couvre les neuf statuts du cahier des charges', () => {
    const statuses: MissionStatus[] = [
      'draft',
      'assigned',
      'accepted',
      'in_progress',
      'completed',
      'submitted',
      'approved',
      'rejected',
      'cancelled',
    ];

    for (const status of statuses) {
      expect(MISSION_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('ne déclare aucune transition en double', () => {
    const keys = MISSION_TRANSITIONS.map((rule) => `${rule.from}->${rule.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('laisse les états terminaux sans sortie', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(getAvailableTransitions(status)).toHaveLength(0);
    }
  });

  it('permet le parcours nominal du §18 de bout en bout', () => {
    const path: MissionStatus[] = [
      'draft',
      'assigned',
      'accepted',
      'in_progress',
      'completed',
      'submitted',
      'approved',
    ];

    for (let i = 0; i < path.length - 1; i += 1) {
      expect(
        isTransitionAllowed(path[i]!, path[i + 1]!),
        `${path[i]} → ${path[i + 1]} devrait être autorisée`,
      ).toBe(true);
    }
  });

  it('interdit les raccourcis qui contourneraient le contrôle', () => {
    // Le cas qui compte : passer directement de « en cours » à « validée »
    // sauterait le compte rendu ET sa validation par un responsable.
    expect(isTransitionAllowed('in_progress', 'approved')).toBe(false);
    expect(isTransitionAllowed('draft', 'in_progress')).toBe(false);
    expect(isTransitionAllowed('completed', 'approved')).toBe(false);
    expect(isTransitionAllowed('assigned', 'completed')).toBe(false);
  });

  it('permet la reprise après refus', () => {
    // Sans cette boucle, un refus serait un cul-de-sac et imposerait de
    // recréer la mission, perdant tout l'historique.
    expect(isTransitionAllowed('rejected', 'in_progress')).toBe(true);
  });

  it('réserve la validation et le refus à la permission de contrôle', () => {
    for (const target of ['approved', 'rejected'] as const) {
      const rule = MISSION_TRANSITIONS.find((r) => r.from === 'submitted' && r.to === target);
      expect(rule?.requiredPermission).toBe('intervention.review');
      expect(rule?.assigneeOnly).toBe(false);
    }
  });

  it("réserve l'acceptation, le démarrage et la soumission à l'intervenant affecté", () => {
    for (const [from, to] of [
      ['assigned', 'accepted'],
      ['accepted', 'in_progress'],
      ['in_progress', 'completed'],
      ['completed', 'submitted'],
    ] as const) {
      const rule = MISSION_TRANSITIONS.find((r) => r.from === from && r.to === to);
      expect(rule?.assigneeOnly, `${from} → ${to}`).toBe(true);
      expect(rule?.requiredPermission).toBeNull();
    }
  });
});

describe('getPermittedTransitions', () => {
  it('laisse le technicien affecté accepter sa mission', () => {
    const transitions = getPermittedTransitions({
      from: 'assigned',
      role: 'technician',
      isAssignee: true,
    });

    expect(transitions.map((rule) => rule.to)).toEqual(['accepted']);
  });

  it("n'offre rien à un technicien non affecté", () => {
    const transitions = getPermittedTransitions({
      from: 'assigned',
      role: 'technician',
      isAssignee: false,
    });

    expect(transitions).toHaveLength(0);
  });

  it('interdit au technicien de valider un compte rendu soumis', () => {
    const transitions = getPermittedTransitions({
      from: 'submitted',
      role: 'technician',
      isAssignee: true,
    });

    expect(transitions).toHaveLength(0);
  });

  it('permet au manager de valider ou refuser', () => {
    const transitions = getPermittedTransitions({
      from: 'submitted',
      role: 'manager',
      isAssignee: false,
    });

    expect(transitions.map((rule) => rule.to).sort()).toEqual(['approved', 'rejected']);
  });

  it("permet au manager d'affecter une mission en brouillon", () => {
    const transitions = getPermittedTransitions({
      from: 'draft',
      role: 'manager',
      isAssignee: false,
    });

    expect(transitions.map((rule) => rule.to).sort()).toEqual(['assigned', 'cancelled']);
  });
});

describe('synchronisation avec le seed SQL', () => {
  const sql = readMigration(MIGRATION_FILES.missions);
  const tuples = extractInsertTuples(sql, 'mission_status_transitions');

  const seeded = tuples.map((tuple) => ({
    from: stripCast(tuple[0] ?? ''),
    to: stripCast(tuple[1] ?? ''),
    requiredPermission: stripCast(tuple[2] ?? '') === 'null' ? null : stripCast(tuple[2] ?? ''),
    assigneeOnly: stripCast(tuple[3] ?? '') === 'true',
  }));

  it('extrait toutes les règles du seed', () => {
    expect(seeded.length).toBe(MISSION_TRANSITIONS.length);
  });

  it('déclare exactement les mêmes règles que le miroir TypeScript', () => {
    for (const rule of MISSION_TRANSITIONS) {
      const row = seeded.find(
        (candidate) => candidate.from === rule.from && candidate.to === rule.to,
      );

      expect(row, `transition ${rule.from} → ${rule.to} absente du seed SQL`).toBeDefined();
      expect(row?.requiredPermission).toBe(rule.requiredPermission);
      expect(row?.assigneeOnly).toBe(rule.assigneeOnly);
    }
  });

  it("n'introduit aucune règle absente du miroir", () => {
    for (const row of seeded) {
      expect(
        isTransitionAllowed(row.from as MissionStatus, row.to as MissionStatus),
        `le SQL déclare ${row.from} → ${row.to}, absente de MISSION_TRANSITIONS`,
      ).toBe(true);
    }
  });
});
