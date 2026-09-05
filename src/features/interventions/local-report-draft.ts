const REPORT_DRAFT_PREFIX = 'rezo360:report-draft:v1';
const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface LocalReportDraft {
  version: 1;
  reportId: string;
  baseUpdatedAt: string;
  workDescription: string;
  observations: string;
  savedAt: string;
}

function storageKey(userId: string, reportId: string): string {
  return `${REPORT_DRAFT_PREFIX}:${userId}:${reportId}`;
}

function removeStoredDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Un stockage indisponible ne doit jamais interrompre l'interface.
  }
}

function isLocalReportDraft(value: unknown): value is LocalReportDraft {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate['version'] === 1 &&
    typeof candidate['reportId'] === 'string' &&
    typeof candidate['baseUpdatedAt'] === 'string' &&
    typeof candidate['workDescription'] === 'string' &&
    typeof candidate['observations'] === 'string' &&
    typeof candidate['savedAt'] === 'string'
  );
}

/**
 * Relit uniquement le brouillon du compte connecté et l'écarte s'il est
 * ancien ou basé sur une version serveur qui a depuis changé.
 */
export function readLocalReportDraft(
  userId: string | null | undefined,
  reportId: string,
  serverUpdatedAt: string,
): LocalReportDraft | null {
  if (!userId || typeof window === 'undefined') return null;

  const key = storageKey(userId, reportId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const savedAtMs = isLocalReportDraft(parsed) ? Date.parse(parsed.savedAt) : Number.NaN;
    const expired =
      !isLocalReportDraft(parsed) ||
      parsed.reportId !== reportId ||
      parsed.baseUpdatedAt !== serverUpdatedAt ||
      !Number.isFinite(savedAtMs) ||
      Date.now() - savedAtMs > MAX_DRAFT_AGE_MS;

    if (expired) {
      removeStoredDraft(key);
      return null;
    }
    return parsed;
  } catch {
    removeStoredDraft(key);
    return null;
  }
}

export function writeLocalReportDraft(
  userId: string | null | undefined,
  draft: Omit<LocalReportDraft, 'version' | 'savedAt'>,
): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      storageKey(userId, draft.reportId),
      JSON.stringify({ ...draft, version: 1, savedAt: new Date().toISOString() }),
    );
  } catch {
    // Un stockage désactivé ou plein ne doit jamais interrompre la saisie.
  }
}

export function clearLocalReportDraft(
  userId: string | null | undefined,
  reportId: string,
): void {
  if (!userId || typeof window === 'undefined') return;
  removeStoredDraft(storageKey(userId, reportId));
}
