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
  | { status: 'success'; mediaId: string }
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

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

  publish(): Promise<InstagramPublishResult> {
    return Promise.resolve({
      status: 'failure',
      kind: 'permanent',
      code: 'meta_publisher_disabled_phase_f',
      message: 'MetaInstagramPublisher est volontairement inactif en Phase F.',
    });
  }
}
