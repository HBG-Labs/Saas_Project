import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Images,
  PauseCircle,
  Pencil,
  Plus,
} from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { isProduction } from '@/config/env';
import { cn } from '@/lib/cn';

import {
  SOCIAL_WEEK_DAYS,
  addDays,
  formatShortDate,
  formatTime,
  postAudience,
  postObjective,
  postPlannedFor,
  type SocialPostFormValues,
  type SocialPostSaveIntent,
  type SocialPostWithAssets,
} from '../weekly-planning';
import {
  useCreateDevelopmentSocialWeek,
  useGenerateSocialPostImages,
  useGenerateSocialStudioWeek,
  useSelectSocialPostAsset,
  useSocialStudioWeek,
  useUpdateSocialPost,
} from '../hooks/useSocialStudioWeek';

import { InstagramPostPreview } from './InstagramPostPreview';
import { SocialPostEditorModal } from './SocialPostEditorModal';

const STATUS_META: Record<
  SocialPostWithAssets['status'],
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  draft: { label: 'BROUILLON', variant: 'neutral' },
  ready: { label: 'READY', variant: 'success' },
  scheduled: { label: 'SCHEDULED', variant: 'info' },
  processing: { label: 'PROCESSING', variant: 'warning' },
  published: { label: 'PUBLISHED', variant: 'success' },
  failed: { label: 'FAILED', variant: 'error' },
  cancelled: { label: 'CANCELLED', variant: 'neutral' },
};

function weekRange(startsOn: string) {
  const end = addDays(startsOn, 6);
  return `${formatShortDate(startsOn)} - ${formatShortDate(end)}`;
}

function completionLabel(posts: SocialPostWithAssets[]) {
  const ready = posts.filter((post) => post.status === 'ready').length;
  const missing = 7 - ready;
  return missing === 0 ? '7/7 prêts' : `${ready}/7 prêts · ${missing} à compléter`;
}

function validationIssues(posts: SocialPostWithAssets[]) {
  const issues: string[] = [];
  if (posts.length !== 7) issues.push('La semaine doit contenir 7 publications.');
  if (posts.some((post) => post.status !== 'ready')) {
    issues.push('Chaque publication doit être READY.');
  }
  if (posts.some((post) => post.assets.length === 0)) {
    issues.push('Chaque publication devra avoir un asset image sélectionné.');
  }
  if (posts.some((post) => postPlannedFor(post) === null)) {
    issues.push('Chaque publication devra avoir une date et une heure valides.');
  }
  issues.push('La programmation réelle sera activée en Phase F.');
  return issues;
}

function WeekPostCard({
  post,
  startsOn,
  canEdit,
  isGeneratingImages,
  isSelectingAsset,
  onEdit,
  onGenerateImages,
  onSelectAsset,
}: {
  post: SocialPostWithAssets;
  startsOn: string;
  canEdit: boolean;
  isGeneratingImages: boolean;
  isSelectingAsset: boolean;
  onEdit: (post: SocialPostWithAssets) => void;
  onGenerateImages: (post: SocialPostWithAssets) => void;
  onSelectAsset: (post: SocialPostWithAssets, assetId: string) => void;
}) {
  const dayIndex = post.slot_index - 1;
  const dayDate = addDays(startsOn, dayIndex);
  const status = STATUS_META[post.status];
  const generatedAssets = post.assets.filter(
    (asset) => asset.kind === 'generated' || asset.kind === 'selected',
  );
  const hasGeneratedAssets = generatedAssets.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-foreground text-sm font-semibold">
              {SOCIAL_WEEK_DAYS[dayIndex]} {formatShortDate(dayDate)}
            </p>
            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatTime(postPlannedFor(post))}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <InstagramPostPreview post={post} compact />

        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground text-3xs font-medium uppercase">Hook</p>
            <h2 className="text-foreground text-base leading-snug font-semibold">
              {post.hook || 'Hook à compléter'}
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Objectif</dt>
              <dd className="text-foreground mt-0.5 font-medium">{postObjective(post)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Audience</dt>
              <dd className="text-foreground mt-0.5 font-medium">{postAudience(post)}</dd>
            </div>
          </dl>
        </div>

        {hasGeneratedAssets ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-3xs font-medium uppercase">Variantes image</p>
            <div className="grid grid-cols-3 gap-2">
              {generatedAssets.map((asset, index) => {
                const selected = asset.kind === 'selected' || (index === 0 && generatedAssets.every((item) => item.kind !== 'selected'));
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onSelectAsset(post, asset.id)}
                    disabled={!canEdit || isSelectingAsset}
                    aria-pressed={selected}
                    className={cn(
                      'border-border bg-surface hover:bg-surface-raised focus-visible:ring-ring overflow-hidden rounded-md border text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                      selected && 'border-primary ring-primary/20 ring-2',
                    )}
                  >
                    <span className="bg-surface-sunken block aspect-square">
                      {asset.signedUrl ? (
                        <img
                          src={asset.signedUrl}
                          alt={asset.alt_text ?? `Variante ${index + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </span>
                    <span className="text-muted-foreground block px-2 py-1 text-3xs">
                      Variante {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onEdit(post)}
            disabled={!canEdit}
            leadingIcon={<Pencil />}
          >
            Modifier
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onGenerateImages(post)}
            disabled={!canEdit || hasGeneratedAssets}
            isLoading={isGeneratingImages}
            loadingLabel="Génération"
            leadingIcon={<Images />}
          >
            {hasGeneratedAssets ? 'Visuels prêts' : 'Générer visuels'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SocialStudioWeekPlanner({
  organizationId,
  startsOn,
  canManage,
  canPublish,
}: {
  organizationId: string;
  startsOn: string;
  canManage: boolean;
  canPublish: boolean;
}) {
  const [selectedPost, setSelectedPost] = useState<SocialPostWithAssets | null>(null);
  const [imageGenerationPostId, setImageGenerationPostId] = useState<string | null>(null);
  const weekQuery = useSocialStudioWeek(organizationId, startsOn);
  const createMockWeek = useCreateDevelopmentSocialWeek(organizationId, startsOn);
  const generateWeek = useGenerateSocialStudioWeek(organizationId, startsOn);
  const generateImages = useGenerateSocialPostImages(organizationId, startsOn);
  const selectAsset = useSelectSocialPostAsset(organizationId, startsOn);
  const updatePost = useUpdateSocialPost(organizationId, startsOn);

  if (weekQuery.isPending) return <LoadingScreen label="Chargement de Social Studio…" />;

  if (weekQuery.isError) {
    return (
      <ErrorState
        title="La semaine Social Studio n’a pas pu être chargée"
        error={weekQuery.error}
        onRetry={() => void weekQuery.refetch()}
      />
    );
  }

  const week = weekQuery.data ?? null;
  const posts = week?.posts ?? [];
  const nextPost = posts
    .filter((post) => post.status === 'ready' || post.status === 'draft')
    .sort((a, b) => String(postPlannedFor(a)).localeCompare(String(postPlannedFor(b))))[0];
  const issues = validationIssues(posts);
  const canCreateMockWeek = canManage && !isProduction;
  const canGenerateWeek = canManage;

  const savePost = (
    post: SocialPostWithAssets,
    values: SocialPostFormValues,
    intent: SocialPostSaveIntent,
  ) => {
    updatePost.mutate(
      { post, values, intent },
      {
        onSuccess: () => setSelectedPost(null),
      },
    );
  };

  const generatePostImages = (post: SocialPostWithAssets) => {
    setImageGenerationPostId(post.id);
    generateImages.mutate(post.id, {
      onSettled: () => setImageGenerationPostId(null),
    });
  };

  const selectPostAsset = (post: SocialPostWithAssets, assetId: string) => {
    selectAsset.mutate({ postId: post.id, assetId });
  };

  return (
    <section className="space-y-6" aria-labelledby="social-week-title">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Semaine actuelle</p>
          <p className="text-foreground mt-1 text-lg font-semibold">{weekRange(startsOn)}</p>
        </div>
        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Publications</p>
          <p className="text-foreground mt-1 text-lg font-semibold">{posts.length}/7</p>
        </div>
        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Prochaine publication</p>
          <p className="text-foreground mt-1 text-lg font-semibold">
            {nextPost ? formatTime(postPlannedFor(nextPost)) : 'Aucune'}
          </p>
        </div>
      </div>

      {week === null ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune semaine Instagram préparée"
          description={
            'Social Studio AI prépare une stratégie d’exploration et 7 brouillons image. Les visuels restent des placeholders jusqu’à la phase image.'
          }
          action={
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <Button
                onClick={() => generateWeek.mutate()}
                isLoading={generateWeek.isPending}
                loadingLabel="Préparation de votre semaine"
                disabled={!canGenerateWeek}
                leadingIcon={<Plus />}
                className="w-full"
              >
                Préparer ma semaine
              </Button>

              {generateWeek.isPending ? (
                <div className="border-border bg-surface rounded-lg border px-3 py-2 text-left text-xs">
                  <p className="text-foreground font-medium">Préparation de votre semaine…</p>
                  <p className="text-muted-foreground mt-1">
                    Analyse des angles · Création des 7 contenus · Finalisation
                  </p>
                </div>
              ) : null}

              {generateWeek.error ? (
                <p role="alert" className="text-error text-sm">
                  {generateWeek.error instanceof Error
                    ? generateWeek.error.message
                    : 'Social Studio AI n’a pas pu préparer la semaine.'}
                </p>
              ) : null}

              {canCreateMockWeek ? (
                <Button
                  variant="outline"
                  onClick={() => createMockWeek.mutate()}
                  isLoading={createMockWeek.isPending}
                  loadingLabel="Création des brouillons de test"
                  className="w-full"
                >
                  Créer des brouillons de test
                </Button>
              ) : null}
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="social-week-title" className="text-foreground text-xl font-bold">
                Ma semaine Instagram
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {completionLabel(posts)} · {posts.length} publications image
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                disabled
                leadingIcon={<PauseCircle />}
                className="w-full sm:w-auto"
              >
                Suspendre les publications
              </Button>
              <Button
                disabled
                leadingIcon={<CheckCircle2 />}
                className="w-full sm:w-auto"
                aria-describedby="weekly-validation-reasons"
              >
                Valider et programmer la semaine
              </Button>
            </div>
          </div>

          <div
            id="weekly-validation-reasons"
            className={cn(
              'rounded-lg border p-4 text-sm',
              issues.length === 1 && canPublish
                ? 'border-success/30 bg-success/5 text-success'
                : 'border-warning/30 bg-warning/5 text-warning',
            )}
          >
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Validation hebdomadaire non active en Phase C.</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                  {!canPublish ? <li>Votre rôle ne permet pas la publication.</li> : null}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <WeekPostCard
                key={post.id}
                post={post}
                startsOn={week.week.starts_on}
                canEdit={canManage}
                isGeneratingImages={generateImages.isPending && imageGenerationPostId === post.id}
                isSelectingAsset={selectAsset.isPending}
                onEdit={setSelectedPost}
                onGenerateImages={generatePostImages}
                onSelectAsset={selectPostAsset}
              />
            ))}
          </div>

          {generateImages.error ? (
            <p role="alert" className="text-error text-sm">
              {generateImages.error instanceof Error
                ? generateImages.error.message
                : 'Le moteur visuel Social Studio n’a pas pu générer les visuels.'}
            </p>
          ) : null}

          {selectAsset.error ? (
            <p role="alert" className="text-error text-sm">
              {selectAsset.error instanceof Error
                ? selectAsset.error.message
                : 'La variante image n’a pas pu être sélectionnée.'}
            </p>
          ) : null}

          {updatePost.error ? (
            <p role="alert" className="text-error text-sm">
              {updatePost.error instanceof Error
                ? updatePost.error.message
                : 'La publication n’a pas pu être enregistrée.'}
            </p>
          ) : null}

          <SocialPostEditorModal
            post={selectedPost}
            week={week.week}
            canEditSchedule={canPublish}
            isSaving={updatePost.isPending}
            onClose={() => setSelectedPost(null)}
            onSave={savePost}
          />
        </>
      )}
    </section>
  );
}
