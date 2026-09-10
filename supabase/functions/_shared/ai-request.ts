export const AI_QUERY_MAX_LENGTH = 2_000;
export const AI_REQUEST_MAX_BYTES = 32_768;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ValidAiRequest {
  organizationId: string;
  query: string;
  conversationId?: string;
}

export type AiRequestValidation =
  { ok: true; value: ValidAiRequest } | { ok: false; message: string };

/** Validation runtime : les interfaces TypeScript n'existent plus sur le réseau. */
export function validateAiRequest(value: unknown): AiRequestValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'Corps de requête invalide.' };
  }

  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(['organizationId', 'query', 'conversationId']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return { ok: false, message: 'Le corps contient des champs non autorisés.' };
  }

  if (typeof body.organizationId !== 'string' || !UUID_PATTERN.test(body.organizationId)) {
    return { ok: false, message: 'Identifiant d’organisation invalide.' };
  }
  if (typeof body.query !== 'string' || body.query.trim().length === 0) {
    return { ok: false, message: 'La question est requise.' };
  }

  const query = body.query.trim();
  if (query.length > AI_QUERY_MAX_LENGTH) {
    return {
      ok: false,
      message: `La question ne peut pas dépasser ${AI_QUERY_MAX_LENGTH} caractères.`,
    };
  }

  if (
    body.conversationId !== undefined &&
    (typeof body.conversationId !== 'string' || !UUID_PATTERN.test(body.conversationId))
  ) {
    return { ok: false, message: 'Identifiant de conversation invalide.' };
  }

  return {
    ok: true,
    value: {
      organizationId: body.organizationId,
      query,
      ...(typeof body.conversationId === 'string' ? { conversationId: body.conversationId } : {}),
    },
  };
}
