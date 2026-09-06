import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Lightbulb,
  PlayCircle,
  RotateCcw,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { TrainingDoodle } from '@/components/training/TrainingDoodle';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { getTrainingCourse } from '@/features/training';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

const PROGRESS_KEY = 'rezo360:tutorial-progress:v1';

const COURSE_ACCENT = {
  bar: 'bg-primary',
  soft: 'bg-blue-50',
  text: 'text-primary',
};

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
  const accent = COURSE_ACCENT;
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
    <div className="relative -mx-4 -mt-4 overflow-hidden pb-16 sm:-mx-6 lg:-mx-8">
      <section className="bg-brand-night relative isolate overflow-hidden px-4 pt-7 pb-12 text-white sm:px-8 sm:pt-9 sm:pb-16 lg:px-12">
        <div
          className="absolute inset-0 -z-20 opacity-20"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }}
        />

        <div className="mx-auto max-w-6xl">
          <Link
            to={ROUTES.tutorials}
            className="focus-visible:ring-primary mb-8 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-bold text-blue-100/75 transition-colors hover:text-white focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour à l’académie
          </Link>

          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.78fr)]">
            <TrainingDoodle
              variant="practice"
              className="absolute -top-8 right-[calc(44%+2.5rem)] z-10 hidden h-24 w-44 -rotate-6 text-blue-200 opacity-90 xl:block"
            />
            <div className="max-w-3xl">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="bg-signal-lime text-brand-night flex size-12 items-center justify-center rounded-2xl shadow-lg shadow-black/20">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
                  {course.theme}
                </span>
                <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold text-blue-100/75">
                  {course.level}
                </span>
              </div>
              <p className="text-xs font-extrabold tracking-[0.2em] text-blue-200 uppercase">
                Cours guidé REZO360
              </p>
              <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-5xl">
                {course.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-blue-100/75">
                {course.description}
              </p>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-blue-100/75">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="size-4 text-blue-200" aria-hidden="true" />
                  {course.duration}
                </span>
                <span className="inline-flex items-center gap-2">
                  <UserRound className="size-4 text-blue-200" aria-hidden="true" />
                  {course.audience}
                </span>
                <span className="inline-flex items-center gap-2">
                  <PlayCircle className="size-4 text-blue-200" aria-hidden="true" />
                  {course.chapters.length} chapitres
                </span>
              </div>
            </div>

            <div className="relative min-h-[430px] overflow-hidden rounded-[30px] border border-white/20 bg-slate-800 shadow-2xl shadow-black/30">
              <img
                src={course.image}
                alt={course.imageAlt}
                className="absolute inset-0 h-full w-full object-cover"
                fetchPriority="high"
              />
              <div className="bg-brand-night/15 absolute inset-0" aria-hidden="true" />
              <span className="absolute top-5 right-5 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-slate-900 shadow-lg">
                {course.duration}
              </span>

              <div className="absolute right-5 bottom-5 left-5 rounded-2xl bg-white p-5 text-slate-950 shadow-xl">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold tracking-widest text-slate-500 uppercase">
                      Votre progression
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {completedCount} chapitre{completedCount > 1 ? 's' : ''} sur{' '}
                      {course.chapters.length}
                    </p>
                  </div>
                  <strong className="text-primary text-3xl font-extrabold tabular-nums">
                    {percent}%
                  </strong>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-label="Progression dans le cours"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <div
                    className="bg-signal-lime h-full rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {nextChapter ? (
                  <a
                    href={`#${nextChapter.id}`}
                    className="bg-brand-night mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white transition-colors hover:bg-blue-900"
                  >
                    {completedCount === 0 ? 'Commencer le cours' : 'Continuer le cours'}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                ) : (
                  <div className="bg-success-subtle text-success mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-extrabold">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Parcours terminé
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl items-start gap-7 px-4 pt-10 sm:px-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-12">
        <aside className="bg-brand-night overflow-hidden rounded-3xl text-white shadow-xl lg:sticky lg:top-20">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold tracking-widest text-blue-200 uppercase">
                  Sommaire
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-white">Plan du cours</h2>
              </div>
              {completedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setCompleted([])}
                  className="focus-visible:ring-primary inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold text-blue-100/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:outline-none"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Refaire
                </button>
              ) : null}
            </div>
          </div>

          <ol className="p-3">
            {course.chapters.map((chapter, index) => {
              const done = validCompleted.includes(chapter.id);
              return (
                <li key={chapter.id}>
                  <a
                    href={`#${chapter.id}`}
                    className="focus-visible:ring-primary group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-xl border text-xs font-extrabold transition-colors',
                        done
                          ? 'text-signal-lime border-lime-300/30 bg-lime-300/15'
                          : 'border-white/15 bg-white/5 text-blue-100/60 group-hover:text-white',
                      )}
                    >
                      {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        'line-clamp-2 text-xs font-semibold',
                        done ? 'text-blue-100/55' : 'text-white',
                      )}
                    >
                      {chapter.title.replace(/^\d+\.\s*/, '')}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-white/10 p-5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
              <span className="text-blue-100/60">Progression</span>
              <span className="text-signal-lime tabular-nums">{percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="bg-signal-lime h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </aside>

        <section aria-label="Contenu du cours" className="relative space-y-6">
          <TrainingDoodle
            variant="route"
            className="top-0 right-0 hidden h-20 w-48 rotate-2 text-orange-500 opacity-55 xl:block"
          />
          <div className="relative z-10 mb-2">
            <p className="text-primary flex items-center gap-2 text-xs font-extrabold tracking-widest uppercase">
              <Sparkles className="size-4" aria-hidden="true" />
              Votre parcours
            </p>
            <h2 className="text-foreground mt-2 text-2xl font-extrabold sm:text-3xl">
              Suivez chaque étape
            </h2>
          </div>

          {course.chapters.map((chapter, index) => {
            const done = validCompleted.includes(chapter.id);
            return (
              <article
                key={chapter.id}
                id={chapter.id}
                className={cn(
                  'border-border bg-surface shadow-raised relative scroll-mt-20 overflow-hidden rounded-3xl border transition-colors',
                  done && 'border-success-border',
                )}
              >
                <span
                  className={cn(
                    'absolute inset-y-0 left-0 w-1.5',
                    done ? 'bg-success' : accent.bar,
                  )}
                  aria-hidden="true"
                />

                <div className="p-6 pl-7 sm:p-8 sm:pl-9">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <span
                      className={cn(
                        'flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold shadow-sm',
                        done ? 'bg-success text-white' : cn(accent.soft, accent.text),
                      )}
                    >
                      {done ? (
                        <Check className="size-5" aria-hidden="true" />
                      ) : (
                        String(index + 1).padStart(2, '0')
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-muted-foreground text-[10px] font-extrabold tracking-[0.18em] uppercase">
                          Chapitre {String(index + 1).padStart(2, '0')}
                        </p>
                        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-semibold">
                          <Clock3 className="size-4" aria-hidden="true" />
                          {chapter.duration}
                        </span>
                      </div>
                      <h2 className="text-foreground mt-2 text-xl leading-tight font-extrabold sm:text-2xl">
                        {chapter.title.replace(/^\d+\.\s*/, '')}
                      </h2>
                      <div className={cn('mt-4 rounded-2xl px-4 py-3', accent.soft)}>
                        <p className={cn('text-sm leading-relaxed font-semibold', accent.text)}>
                          <span className="font-extrabold">Votre objectif :</span>{' '}
                          {chapter.objective}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ol className="mt-7 space-y-0 sm:ml-4">
                    {chapter.steps.map((step, stepIndex) => (
                      <li
                        key={step}
                        className="relative grid grid-cols-[34px_minmax(0,1fr)] gap-4 pb-5 last:pb-0"
                      >
                        {stepIndex < chapter.steps.length - 1 ? (
                          <span
                            className="bg-border absolute top-8 bottom-0 left-[16px] w-px"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="border-border bg-surface-sunken text-foreground relative z-10 flex size-[34px] items-center justify-center rounded-full border text-xs font-extrabold">
                          {stepIndex + 1}
                        </span>
                        <p className="text-foreground/90 pt-1.5 text-sm leading-relaxed sm:text-base">
                          {step}
                        </p>
                      </li>
                    ))}
                  </ol>

                  {chapter.tip || chapter.warning ? (
                    <div className="mt-7 grid gap-3 xl:grid-cols-2">
                      {chapter.tip ? (
                        <div className="border-info-border bg-info-subtle flex gap-3 rounded-2xl border p-4">
                          <span className="bg-info text-info-foreground flex size-8 shrink-0 items-center justify-center rounded-xl">
                            <Lightbulb className="size-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-info text-xs font-extrabold tracking-wide uppercase">
                              Conseil pratique
                            </p>
                            <p className="text-foreground mt-1 text-sm leading-relaxed">
                              {chapter.tip}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {chapter.warning ? (
                        <div className="border-warning-border bg-warning-subtle flex gap-3 rounded-2xl border p-4">
                          <span className="bg-warning text-warning-foreground flex size-8 shrink-0 items-center justify-center rounded-xl">
                            <AlertTriangle className="size-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-warning text-xs font-extrabold tracking-wide uppercase">
                              Point de vigilance
                            </p>
                            <p className="text-foreground mt-1 text-sm leading-relaxed">
                              {chapter.warning}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="border-border mt-7 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => toggleChapter(chapter.id)}
                      className={cn(
                        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-extrabold transition-all',
                        done
                          ? 'border-success-border bg-success-subtle text-success'
                          : 'border-border bg-surface hover:border-primary/40 hover:bg-primary-subtle text-foreground',
                      )}
                      aria-pressed={done}
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      {done ? 'Chapitre terminé' : 'Marquer comme terminé'}
                    </button>

                    {chapter.action ? (
                      <Button asChild variant="outline" className="min-h-11 rounded-xl">
                        <Link to={chapter.action.to}>
                          {chapter.action.label}
                          <ExternalLink className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}

          <div className="bg-brand-night relative overflow-hidden rounded-3xl p-7 text-white shadow-xl sm:p-9">
            <span className="bg-primary absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
            <TrainingDoodle
              variant="checklist"
              className="right-32 -bottom-7 hidden h-28 w-48 rotate-6 text-cyan-300 opacity-40 xl:block"
            />
            <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold tracking-widest text-blue-200 uppercase">
                  Fin du parcours
                </p>
                <h2 className="mt-2 text-2xl font-extrabold text-white">
                  {percent === 100
                    ? 'Bravo, le cours est terminé !'
                    : 'Vous avancez à votre rythme.'}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100/70">
                  {percent === 100
                    ? 'Votre progression est enregistrée. Vous pouvez revoir une étape à tout moment.'
                    : 'Cochez chaque chapitre après l’avoir appliqué. Votre progression est enregistrée automatiquement.'}
                </p>
              </div>
              <Link
                to={ROUTES.tutorials}
                className="bg-signal-lime text-brand-night inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold transition-colors hover:bg-white"
              >
                Explorer les autres cours
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
