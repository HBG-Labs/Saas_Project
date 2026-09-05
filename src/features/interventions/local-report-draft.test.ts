import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearLocalReportDraft,
  readLocalReportDraft,
  writeLocalReportDraft,
} from './local-report-draft';

describe('local report draft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('restaure le brouillon du même utilisateur basé sur la même version serveur', () => {
    writeLocalReportDraft('user-1', {
      reportId: 'report-1',
      baseUpdatedAt: '2026-09-05T10:00:00Z',
      workDescription: 'Remplacement du disjoncteur',
      observations: 'Essai concluant',
    });

    expect(
      readLocalReportDraft('user-1', 'report-1', '2026-09-05T10:00:00Z'),
    ).toMatchObject({
      workDescription: 'Remplacement du disjoncteur',
      observations: 'Essai concluant',
    });
    expect(readLocalReportDraft('user-2', 'report-1', '2026-09-05T10:00:00Z')).toBeNull();
  });

  it('écarte un brouillon fondé sur une version serveur dépassée', () => {
    writeLocalReportDraft('user-1', {
      reportId: 'report-1',
      baseUpdatedAt: '2026-09-05T10:00:00Z',
      workDescription: 'Ancienne saisie',
      observations: '',
    });

    expect(readLocalReportDraft('user-1', 'report-1', '2026-09-05T11:00:00Z')).toBeNull();
  });

  it('supprime le brouillon après un enregistrement serveur réussi', () => {
    writeLocalReportDraft('user-1', {
      reportId: 'report-1',
      baseUpdatedAt: '2026-09-05T10:00:00Z',
      workDescription: 'Saisie locale',
      observations: '',
    });
    clearLocalReportDraft('user-1', 'report-1');

    expect(readLocalReportDraft('user-1', 'report-1', '2026-09-05T10:00:00Z')).toBeNull();
  });
});
