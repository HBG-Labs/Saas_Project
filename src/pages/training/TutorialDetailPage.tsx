import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Lightbulb,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { getTrainingCourse } from '@/features/training';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

const PROGRESS_KEY = 'rezo360:tutorial-progress:v1';

type StoredProgress = Record<string, string[]>;

function readProgress(slug: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}') as StoredProgress;
    return Array.isArray(parsed[slug]) ? parsed[slug] : [];
  } catch {
    return [];
  }
}

function saveProgress(slug: string, chapterIds: string[]) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}') as StoredProgress;
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...parsed, [slug]: chapterIds }));
  } catch {
    // La formation reste utilisable si le stockage du navigateur est indisponible.
  }
}

export default function TutorialDetailPage() {
  const { tutorialSlug } = useParams<{ tutorialSlug: string }>();
  const course = getTrainingCourse(tutorialSlug);
  const [completed, setCompleted] = useState<string[]>(() =>
    tutorialSlug ? readProgress(tutorialSlug) : [],
  );

  useDocumentTitle(course ? course.shortTitle : 'Cours introuvable');

  const validCompleted = useMemo(
    () => completed.filter((id) => course?.chapters.some((chapter) => chapter.id === id)),
    [completed, course],
  );

  useEffect(() => {
    if (course) saveProgress(course.slug, validCompleted);
  }, [course, validCompleted]);

  if (!course) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <PageHeader
          title="Cours introuvable"
          description="Ce parcours n’existe pas ou a été déplacé."
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.tutorials}>Voir tous les cours</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const Icon = course.icon;
  const completedCount = validCompleted.length;
  const percent = Math.round((completedCount / course.chapters.length) * 100);
  const nextChapter = course.chapters.find((chapter) => !validCompleted.includes(chapter.id));

  const toggleChapter = (chapterId: string) => {
    setCompleted((current) =>
      current.includes(chapterId)
        ? current.filter((id) => id !== chapterId)
        : [...current, chapterId],
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-14">
      <Link
        to={ROUTES.tutorials}
        className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Tous les tutoriels
      </Link>

      <section className="border-primary/20 bg-primary-subtle relative overflow-hidden rounded-3xl border p-6 sm:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-2xl">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <Badge variant="primary">{course.theme}</Badge>
              <Badge variant="neutral">{course.level}</Badge>
            </div>
            <PageHeader
              className="mb-0 sm:mb-0"
              title={course.title}
              description={course.description}
            />
            <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-4" aria-hidden="true" />
                {course.duration}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" aria-hidden="true" />
                {course.audience}
              </span>
            </div>
          </div>

          <div className="border-border bg-surface/90 w-full rounded-2xl border p-4 lg:max-w-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground font-semibold">Votre progression</span>
              <span className="text-primary font-bold tabular-nums">{percent} %</span>
            </div>
            <div
              className="bg-surface-sunken mt-3 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Progression dans le cours"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="bg-success h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-muted-foreground text-2xs mt-2">
              {completedCount} chapitre{completedCount > 1 ? 's' : ''} sur {course.chapters.length}
            </p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-border bg-surface rounded-2xl border p-4 lg:sticky lg:top-20">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-foreground text-sm font-bold">Plan du cours</h2>
            {completedCount > 0 ? (
              <button
                type="button"
                onClick={() => setCompleted([])}
                className="text-muted-foreground hover:text-foreground text-2xs inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md px-1 font-semibold"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Recommencer
              </button>
            ) : null}
          </div>
          <ol className="space-y-1.5">
            {course.chapters.map((chapter, index) => {
              const done = validCompleted.includes(chapter.id);
              return (
                <li key={chapter.id}>
                  <a
                    href={`#${chapter.id}`}
                    className="hover:bg-surface-hover focus-visible:ring-ring flex min-h-10 items-center gap-2 rounded-xl px-2 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        'text-2xs flex size-6 shrink-0 items-center justify-center rounded-full border font-bold',
                        done
                          ? 'border-success bg-success text-white'
                          : 'border-border bg-surface-sunken text-muted-foreground',
                      )}
                    >
                      {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        'line-clamp-2',
                        done ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {chapter.title.replace(/^\d+\.\s*/, '')}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
          {nextChapter ? (
            <Button asChild className="mt-4 w-full">
              <a href={`#${nextChapter.id}`}>
                Continuer
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : (
            <div className="border-success-border bg-success-subtle text-success mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              Cours terminé
            </div>
          )}
        </aside>

        <section aria-label="Contenu du cours" className="space-y-4">
          {course.chapters.map((chapter, index) => {
            const done = validCompleted.includes(chapter.id);
            return (
              <Card
                key={chapter.id}
                id={chapter.id}
                className={cn('scroll-mt-20 overflow-hidden', done && 'border-success-border')}
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold',
                        done ? 'bg-success text-white' : 'bg-primary-subtle text-primary',
                      )}
                    >
                      {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-foreground text-base font-bold sm:text-lg">
                          {chapter.title}
                        </h2>
                        <span className="text-muted-foreground text-2xs inline-flex items-center gap-1 font-medium">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                          {chapter.duration}
                        </span>
                      </div>
                      <p className="text-primary mt-1 text-xs font-semibold">
                        Objectif : {chapter.objective}
                      </p>
                    </div>
                  </div>

                  <ol className="mt-5 space-y-3">
                    {chapter.steps.map((step, stepIndex) => (
                      <li key={step} className="flex gap-3 text-sm leading-relaxed">
                        <span className="border-border bg-surface-sunken text-muted-foreground text-2xs mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-bold">
                          {stepIndex + 1}
                        </span>
                        <span className="text-foreground/90">{step}</span>
                      </li>
                    ))}
                  </ol>

                  {chapter.tip ? (
                    <div className="border-info-border bg-info-subtle mt-5 flex gap-3 rounded-xl border p-3.5">
                      <Lightbulb className="text-info mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <p className="text-foreground text-xs leading-relaxed">
                        <strong>Conseil :</strong> {chapter.tip}
                      </p>
                    </div>
                  ) : null}

                  {chapter.warning ? (
                    <div className="border-warning-border bg-warning-subtle mt-5 flex gap-3 rounded-xl border p-3.5">
                      <AlertTriangle
                        className="text-warning mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <p className="text-foreground text-xs leading-relaxed">
                        <strong>À vérifier :</strong> {chapter.warning}
                      </p>
                    </div>
                  ) : null}

                  <div className="border-border mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => toggleChapter(chapter.id)}
                      className={cn(
                        'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors',
                        done
                          ? 'border-success-border bg-success-subtle text-success'
                          : 'border-border bg-surface hover:bg-surface-hover text-foreground',
                      )}
                      aria-pressed={done}
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      {done ? 'Chapitre terminé' : 'Marquer comme terminé'}
                    </button>

                    {chapter.action ? (
                      <Button asChild variant="outline">
                        <Link to={chapter.action.to}>
                          {chapter.action.label}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </div>
  );
}
