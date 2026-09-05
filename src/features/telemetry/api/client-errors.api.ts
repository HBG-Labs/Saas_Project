import { supabase } from '@/services/supabase';

export type ClientErrorKind = 'react' | 'window' | 'promise';

export interface ClientErrorDetails {
  kind: ClientErrorKind;
  componentStack?: string | null;
}

const REPORT_WINDOW_MS = 10_000;
const recentReports = new Map<string, number>();
let currentOrganizationId: string | null = null;

function truncate(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

/** Écarte les informations qui ne doivent jamais finir dans un journal. */
export function redactClientErrorText(value: string): string {
  return value
    .replace(/bearer\s+[a-z0-9._~-]+/gi, 'Bearer [masqué]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[jeton masqué]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email masqué]')
    .replace(/([?&](?:token|code|key|secret|password)=)[^&#\s]+/gi, '$1[masqué]');
}

export function normalizeClientError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof reason === 'string') return new Error(reason);

  try {
    return new Error(JSON.stringify(reason));
  } catch {
    return new Error('Erreur non sérialisable');
  }
}

export function setClientErrorOrganization(organizationId: string | null): void {
  currentOrganizationId = organizationId;
}

function currentRoute(): string {
  if (typeof window === 'undefined') return '/';
  return truncate(`${window.location.pathname}${window.location.hash}`, 500);
}

function eventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Envoie une erreur technique sans jamais propager l'échec du journal lui-même.
 * La déduplication évite qu'une même panne soit remontée par React puis par le
 * gestionnaire global du navigateur.
 */
export async function captureClientError(
  reason: unknown,
  details: ClientErrorDetails,
): Promise<void> {
  if (!import.meta.env.PROD) return;

  const error = normalizeClientError(reason);
  const route = currentRoute();
  const message = truncate(redactClientErrorText(error.message || 'Erreur inconnue'), 1000);
  const signature = `${details.kind}|${error.name}|${message}|${route}`;
  const now = Date.now();
  const previous = recentReports.get(signature) ?? 0;

  if (now - previous < REPORT_WINDOW_MS) return;
  recentReports.set(signature, now);

  try {
    await supabase.from('client_error_events').insert({
      organization_id: currentOrganizationId,
      event_id: eventId(),
      error_kind: details.kind,
      error_name: truncate(error.name || 'Error', 120),
      message,
      stack: error.stack ? truncate(redactClientErrorText(error.stack), 6000) : null,
      component_stack: details.componentStack
        ? truncate(redactClientErrorText(details.componentStack), 6000)
        : null,
      route,
      app_version: truncate(import.meta.env.VITE_APP_VERSION || 'unknown', 120),
    });
  } catch {
    // Une panne de télémétrie ne doit jamais créer une seconde panne visible.
  }
}
