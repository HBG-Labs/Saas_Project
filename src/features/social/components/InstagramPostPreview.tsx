import { Camera } from 'lucide-react';

import { cn } from '@/lib/cn';

import {
  postAudience,
  postObjective,
  preferredSocialPostAsset,
  readSocialPostContent,
  type SocialPostWithAssets,
  type SocialWeek,
} from '../weekly-planning';

export function InstagramPostPreview({
  post,
  week,
  compact = false,
}: {
  post: SocialPostWithAssets;
  week?: SocialWeek;
  compact?: boolean;
}) {
  const content = readSocialPostContent(post.content);
  const asset = preferredSocialPostAsset(post);
  const hasAsset = asset !== null;

  return (
    <article
      aria-label="Aperçu Instagram"
      className={cn(
        'border-border bg-surface overflow-hidden rounded-lg border',
        compact ? 'max-w-sm' : 'max-w-md',
      )}
    >
      <header className="border-border flex items-center gap-2 border-b px-3 py-2">
        <div className="bg-foreground text-background text-3xs flex size-7 items-center justify-center rounded-full font-bold">
          R
        </div>
        <div className="min-w-0">
          <p className="text-foreground text-xs font-semibold">REZO360</p>
          <p className="text-muted-foreground text-3xs">
            {postAudience(post, week)} · {postObjective(post, week)}
          </p>
        </div>
      </header>

      <div
        className={cn(
          'bg-surface-sunken relative flex aspect-square items-center justify-center overflow-hidden',
          content.placeholder_variant === 'slot-2' && 'bg-surface',
          content.placeholder_variant === 'slot-4' && 'bg-surface-raised',
          content.placeholder_variant === 'slot-6' && 'bg-muted',
        )}
      >
        {asset?.signedUrl ? (
          <img
            src={asset.signedUrl}
            alt={asset.alt_text ?? post.visual_text ?? 'Visuel Social Studio'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <>
            <div className="bg-foreground absolute inset-x-0 top-0 h-1" aria-hidden="true" />
            <div className="max-w-[82%] space-y-3 text-center">
              <div className="text-muted-foreground border-border bg-surface/80 mx-auto flex size-10 items-center justify-center rounded-full border">
                <Camera className="size-5" aria-hidden="true" />
              </div>
              <p className="text-foreground text-xl leading-tight font-bold sm:text-2xl">
                {post.visual_text || 'Texte sur le visuel'}
              </p>
              <p className="text-muted-foreground text-xs">
                {hasAsset ? 'Asset privé sans URL de prévisualisation' : 'Placeholder image Phase C'}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 px-3 py-3">
        <div>
          <p className="text-muted-foreground text-3xs font-medium uppercase">
            Texte sur le visuel
          </p>
          <p className="text-foreground text-sm font-semibold">
            {post.visual_text || 'Aucun texte visuel'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-3xs font-medium uppercase">Légende Instagram</p>
          <p className="text-foreground text-sm whitespace-pre-line">
            {post.caption || 'La légende sera affichée ici.'}
          </p>
        </div>
        {post.cta ? <p className="text-primary text-sm font-semibold">{post.cta}</p> : null}
      </div>
    </article>
  );
}
