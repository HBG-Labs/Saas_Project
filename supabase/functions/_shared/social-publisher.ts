import {
  INSTAGRAM_GRAPH_API_VERSION,
  INSTAGRAM_GRAPH_BASE_URL,
} from '../../../src/features/social/instagram-platform.ts';

export type SocialPublishFailureKind = 'temporary' | 'permanent' | 'ambiguous_timeout';

export interface ClaimedSocialPost {
  postId: string;
  organizationId: string;
  weekId: string | null;
  accountId: string | null;
  scheduledAt: string;
  attemptId: string;
  attempts: number;
  publishMode: 'dry_run' | 'live';
  approvedSnapshot: Record<string, unknown>;
}

export type InstagramPublishResult =
  | {
      status: 'success';
      mediaId: string;
      permalink?: string | null;
      metadata?: Record<string, unknown>;
    }
  | {
      status: 'failure';
      kind: SocialPublishFailureKind;
      code: string;
      message: string;
    };

export interface InstagramPublisher {
  id: string;
  mode: 'dry_run' | 'live';
  publish(post: ClaimedSocialPost): Promise<InstagramPublishResult>;
}

export interface MetaInstagramCredential {
  providerAccountId: string;
  accessToken: string;
  expiresAt: string;
  grantedPermissions: string[];
}

export interface MetaInstagramPublisherStore {
  loadCredential(post: ClaimedSocialPost): Promise<MetaInstagramCredential | null>;
  createSignedAssetUrl(storagePath: string, expiresInSeconds: number): Promise<string>;
  markContainer(input: {
    postId: string;
    attemptId: string;
    containerId: string;
    status: string;
    nowIso: string;
  }): Promise<void>;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];
}

export class MockInstagramPublisher implements InstagramPublisher {
  readonly id = 'mock';
  readonly mode = 'dry_run' as const;

  publish(post: ClaimedSocialPost): Promise<InstagramPublishResult> {
    const asset = objectValue(post.approvedSnapshot.asset);
    if (typeof asset.storage_path !== 'string' || asset.storage_path.trim() === '') {
      return Promise.resolve({
        status: 'failure',
        kind: 'permanent',
        code: 'asset_missing',
        message: 'Asset final absent du snapshot approuve.',
      });
    }

    return Promise.resolve({
      status: 'success',
      mediaId: `dry_run:${post.attemptId}`,
    });
  }
}

export class MetaInstagramPublisher implements InstagramPublisher {
  readonly id = 'meta';
  readonly mode = 'live' as const;

  constructor(
    private readonly options: {
      store: MetaInstagramPublisherStore;
      fetcher?: typeof fetch;
      now?: () => Date;
      signedUrlTtlSeconds?: number;
      pollAttempts?: number;
      pollDelayMs?: number;
      requestTimeoutMs?: number;
      publishTimeoutMs?: number;
    },
  ) {}

  async publish(post: ClaimedSocialPost): Promise<InstagramPublishResult> {
    try {
      return await this.publishLive(post);
    } catch (error) {
      return instagramPublishError(error);
    }
  }

  private async publishLive(post: ClaimedSocialPost): Promise<InstagramPublishResult> {
    if (post.publishMode !== 'live') {
      return {
        status: 'failure',
        kind: 'permanent',
        code: 'not_live_post',
        message: 'La publication n’est pas programmee en mode live.',
      };
    }
    if (!post.accountId) {
      return {
        status: 'failure',
        kind: 'permanent',
        code: 'instagram_account_missing',
        message: 'Aucun compte Instagram n’est associe a cette publication.',
      };
    }

    const credential = await this.options.store.loadCredential(post);
    if (!credential) {
      return {
        status: 'failure',
        kind: 'permanent',
        code: 'instagram_credential_missing',
        message: 'Le compte Instagram doit etre reconnecte avant publication.',
      };
    }
    if (
      Date.parse(credential.expiresAt) <=
      (this.options.now?.() ?? new Date()).getTime() + 5 * 60_000
    ) {
      return {
        status: 'failure',
        kind: 'permanent',
        code: 'instagram_token_expired',
        message: 'Le jeton Instagram est expire ou trop proche de l’expiration.',
      };
    }
    if (!credential.grantedPermissions.includes('instagram_business_content_publish')) {
      return {
        status: 'failure',
        kind: 'permanent',
        code: 'instagram_permission_missing',
        message: 'La permission Meta instagram_business_content_publish est manquante.',
      };
    }

    const asset = objectValue(post.approvedSnapshot.asset);
    const storagePath = stringValue(asset.storage_path);
    if (!storagePath) {
      return {
        status: 'failure',
        kind: 'permanent',
        code: 'asset_missing',
        message: 'Asset final absent du snapshot approuve.',
      };
    }
    const mimeType = stringValue(asset.mime_type);
    if (mimeType && !['image/jpeg', 'image/png'].includes(mimeType)) {
      return {
        status: 'failure',
        kind: 'permanent',
        code: 'asset_mime_not_supported',
        message: 'Le format image final n’est pas supporte pour la publication Instagram live.',
      };
    }
    if (Number(asset.width) !== 1080 || Number(asset.height) !== 1350) {
      return {
        status: 'failure',
        kind: 'permanent',
        code: 'asset_dimensions_invalid',
        message: 'L’asset final doit etre en 1080x1350 avant publication Instagram.',
      };
    }

    const signedUrl = await this.options.store.createSignedAssetUrl(
      storagePath,
      boundedInteger(this.options.signedUrlTtlSeconds, 3600, 900, 86_400),
    );
    const caption = buildCaption(post.approvedSnapshot);
    const container = await this.createContainer({
      igUserId: credential.providerAccountId,
      accessToken: credential.accessToken,
      imageUrl: signedUrl,
      caption,
      altText: buildAltText(post.approvedSnapshot),
    });
    await this.options.store.markContainer({
      postId: post.postId,
      attemptId: post.attemptId,
      containerId: container.id,
      status: 'CREATED',
      nowIso: (this.options.now?.() ?? new Date()).toISOString(),
    });

    const status = await this.waitForContainer(container.id, credential.accessToken, post);
    if (status !== 'FINISHED') {
      return {
        status: 'failure',
        kind: status === 'ERROR' ? 'permanent' : 'temporary',
        code: status === 'ERROR' ? 'instagram_container_error' : 'instagram_container_not_ready',
        message:
          status === 'ERROR'
            ? 'Meta a refuse le container Instagram.'
            : 'Le container Instagram n’est pas encore pret.',
      };
    }

    const published = await this.publishContainer({
      igUserId: credential.providerAccountId,
      accessToken: credential.accessToken,
      containerId: container.id,
    });
    return {
      status: 'success',
      mediaId: published.id,
      metadata: {
        instagram_container_id: container.id,
        instagram_container_status: status,
        graph_api_version: INSTAGRAM_GRAPH_API_VERSION,
      },
    };
  }

  private async createContainer(input: {
    igUserId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
    altText: string;
  }): Promise<{ id: string }> {
    const payload = await this.graphPost(
      `/${input.igUserId}/media`,
      {
        image_url: input.imageUrl,
        caption: input.caption,
        alt_text: input.altText,
      },
      input.accessToken,
      'temporary',
    );
    const id = stringValue(payload.id);
    if (!id)
      throw new MetaPublisherError(
        'Meta n’a pas retourne de container Instagram.',
        'permanent',
        'container_missing',
      );
    return { id };
  }

  private async waitForContainer(
    containerId: string,
    accessToken: string,
    post: ClaimedSocialPost,
  ): Promise<string> {
    const attempts = boundedInteger(this.options.pollAttempts, 6, 1, 20);
    const pollDelayMs = boundedInteger(this.options.pollDelayMs, 1500, 0, 10_000);
    let lastStatus = 'UNKNOWN';
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const payload = await this.graphGet(
        `/${containerId}`,
        { fields: 'status_code' },
        accessToken,
        'temporary',
      );
      lastStatus = stringValue(payload.status_code) ?? 'UNKNOWN';
      await this.options.store.markContainer({
        postId: post.postId,
        attemptId: post.attemptId,
        containerId,
        status: lastStatus,
        nowIso: (this.options.now?.() ?? new Date()).toISOString(),
      });
      if (lastStatus === 'FINISHED' || lastStatus === 'ERROR') return lastStatus;
      if (attempt + 1 < attempts && pollDelayMs > 0) await delay(pollDelayMs);
    }
    return lastStatus;
  }

  private async publishContainer(input: {
    igUserId: string;
    accessToken: string;
    containerId: string;
  }): Promise<{ id: string }> {
    const payload = await this.graphPost(
      `/${input.igUserId}/media_publish`,
      { creation_id: input.containerId },
      input.accessToken,
      'ambiguous_timeout',
      this.options.publishTimeoutMs,
    );
    const id = stringValue(payload.id);
    if (!id)
      throw new MetaPublisherError(
        'Meta n’a pas retourne d’identifiant media.',
        'ambiguous_timeout',
        'media_id_missing',
      );
    return { id };
  }

  private async graphPost(
    path: string,
    params: Record<string, string>,
    accessToken: string,
    timeoutKind: SocialPublishFailureKind,
    timeoutMs?: number,
  ): Promise<Record<string, unknown>> {
    const body = new URLSearchParams({ ...params, access_token: accessToken });
    const response = await fetchWithTimeout(
      new URL(`/${INSTAGRAM_GRAPH_API_VERSION}${path}`, INSTAGRAM_GRAPH_BASE_URL).toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
      this.options.fetcher ?? fetch,
      timeoutMs ?? this.options.requestTimeoutMs ?? 15_000,
      timeoutKind,
    );
    return parseMetaResponse(response);
  }

  private async graphGet(
    path: string,
    params: Record<string, string>,
    accessToken: string,
    timeoutKind: SocialPublishFailureKind,
  ): Promise<Record<string, unknown>> {
    const url = new URL(`/${INSTAGRAM_GRAPH_API_VERSION}${path}`, INSTAGRAM_GRAPH_BASE_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set('access_token', accessToken);
    return parseMetaResponse(
      await fetchWithTimeout(
        url.toString(),
        {},
        this.options.fetcher ?? fetch,
        this.options.requestTimeoutMs ?? 15_000,
        timeoutKind,
      ),
    );
  }
}

class MetaPublisherError extends Error {
  constructor(
    message: string,
    readonly kind: SocialPublishFailureKind,
    readonly code: string,
  ) {
    super(message);
    this.name = 'MetaPublisherError';
  }
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHashtag(value: string) {
  const cleaned = value.trim().replace(/^#+/, '');
  return cleaned ? `#${cleaned}` : '';
}

function buildCaption(snapshot: Record<string, unknown>): string {
  const caption = stringValue(snapshot.caption) ?? '';
  const cta = stringValue(snapshot.cta);
  const hashtags = stringArray(snapshot.hashtags).map(normalizeHashtag).filter(Boolean);
  const parts = [caption];
  if (cta && !caption.toLocaleLowerCase('fr-FR').includes(cta.toLocaleLowerCase('fr-FR'))) {
    parts.push(cta);
  }
  if (hashtags.length > 0) parts.push(hashtags.slice(0, 10).join(' '));
  return parts.filter(Boolean).join('\n\n').slice(0, 2200);
}

function buildAltText(snapshot: Record<string, unknown>): string {
  return (
    stringValue(snapshot.visual_text) ??
    stringValue(snapshot.hook) ??
    'Visuel publicitaire REZO360 pour entreprises de terrain'
  ).slice(0, 1000);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch,
  timeoutMs: number,
  timeoutKind: SocialPublishFailureKind,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new MetaPublisherError('Timeout Meta Instagram.', timeoutKind, 'meta_timeout');
    }
    throw new MetaPublisherError('Meta Instagram est indisponible.', 'temporary', 'network_error');
  } finally {
    clearTimeout(timeout);
  }
}

function metaMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 500);
    }
  }
  return fallback;
}

async function parseMetaResponse(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Le statut HTTP suffit pour classifier une erreur Meta non JSON.
  }
  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : null;
    const code =
      error && typeof error === 'object'
        ? (stringValue((error as { code?: unknown; type?: unknown }).code) ??
          stringValue((error as { code?: unknown; type?: unknown }).type))
        : null;
    const kind: SocialPublishFailureKind =
      response.status === 429 || response.status >= 500 ? 'temporary' : 'permanent';
    throw new MetaPublisherError(
      metaMessage(payload, `Meta a refuse la publication Instagram (${response.status}).`),
      kind,
      code ?? `meta_${response.status}`,
    );
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new MetaPublisherError(
      'Meta a retourne une reponse Instagram invalide.',
      'temporary',
      'invalid_response',
    );
  }
  return payload as Record<string, unknown>;
}

export function instagramPublishError(error: unknown): InstagramPublishResult {
  if (error instanceof MetaPublisherError) {
    return { status: 'failure', kind: error.kind, code: error.code, message: error.message };
  }
  return {
    status: 'failure',
    kind: 'temporary',
    code: 'publisher_exception',
    message: 'La publication Instagram est momentanement indisponible.',
  };
}
