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
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { getTrainingCourse } from '@/features/training';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useTrainingProgress } from '@/features/training/hooks/useTrainingProgress';

export default function TutorialDetailPage() {
  const { tutorialSlug } = useParams<{ tutorialSlug: string }>();
  const course = getTrainingCourse(tutorialSlug);
  const {
    completed,
    definir: definirProgression,
    surLeServeur,
    enEchec,
  } = useTrainingProgress(tutorialSlug);

  useDocumentTitle(course ? course.shortTitle : 'Cours introuvable');

  const validCompleted = useMemo(
    () => completed.filter((id) => course?.chapters.some((chapter) => chapter.id === id)),
    [completed, course],
  );

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

  const completedCount = validCompleted.length;
  const percent = Math.round((completedCount / course.chapters.length) * 100);
  const nextChapter = course.chapters.find((chapter) => !validCompleted.includes(chapter.id));

  const toggleChapter = (chapterId: string) => {
    definirProgression(
      validCompleted.includes(chapterId)
        ? validCompleted.filter((id) => id !== chapterId)
        : [...validCompleted, chapterId],
    );
  };

  return (
    <div className="workspace-training space-y-6">
      <Button asChild variant="ghost">
        <Link to={ROUTES.tutorials}>
          <ArrowLeft aria-hidden /> Retour à l’académie
        </Link>
      </Button>
      <PageHeader title={course.title} description={course.description} />
      <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="text-info font-bold">{course.theme}</span>
        <span>{course.level}</span>
        <span className="flex items-center gap-2">
          <Clock3 className="size-4" aria-hidden />
          {course.duration}
        </span>
        <span className="flex items-center gap-2">
          <UserRound className="size-4" aria-hidden />
          {course.audience}
        </span>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="border-border bg-surface overflow-hidden rounded-xl border lg:sticky lg:top-20">
          <img
            src={course.image}
            alt={course.imageAlt}
            className="h-40 w-full object-cover"
            fetchPriority="high"
          />
          <div className="space-y-4 p-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold">Votre progression</h2>
                <p className="text-muted-foreground text-xs">
                  {completedCount} sur {course.chapters.length} chapitres
                </p>
              </div>
              <strong className="text-info text-2xl font-bold tabular-nums">{percent}%</strong>
            </div>
            <div
              className="bg-surface-sunken h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Progression dans le cours"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="bg-info h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: String(percent) + '%' }}
              />
            </div>
            {nextChapter ? (
              <Button asChild className="w-full">
                <a href={'#' + nextChapter.id}>
                  {completedCount === 0 ? 'Commencer le cours' : 'Continuer le cours'}
                  <ArrowRight aria-hidden />
                </a>
              </Button>
            ) : (
              <p className="text-success flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="size-4" aria-hidden /> Parcours terminé
              </p>
            )}
          </div>
          <nav aria-label="Plan du cours" className="border-border border-t p-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <h2 className="text-xs font-bold">Sommaire</h2>
              {completedCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => definirProgression([])}
                >
                  <RotateCcw aria-hidden /> Refaire
                </Button>
              ) : null}
            </div>
            <ol className="space-y-1">
              {course.chapters.map((chapter, index) => {
                const done = validCompleted.includes(chapter.id);
                return (
                  <li key={chapter.id}>
                    <a
                      href={'#' + chapter.id}
                      className="hover:bg-surface-hover focus-visible:ring-ring flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          done
                            ? 'bg-success-subtle text-success'
                            : 'bg-surface-sunken text-muted-foreground',
                        )}
                      >
                        {done ? <Check className="size-4" aria-hidden /> : index + 1}
                      </span>
                      <span>{chapter.title.replace(/^\d+\.\s*/, '')}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>
        <section aria-label="Contenu du cours" className="min-w-0 space-y-5">
          {course.chapters.map((chapter, index) => {
            const done = validCompleted.includes(chapter.id);
            return (
              <article
                key={chapter.id}
                id={chapter.id}
                className={cn(
                  'border-border bg-surface scroll-mt-20 rounded-xl border p-4 sm:p-6',
                  done && 'border-success-border',
                )}
              >
                <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold">Chapitre {index + 1}</span>
                  <span>{chapter.duration}</span>
                </div>
                <h2 className="mt-2 text-xl font-bold">{chapter.title.replace(/^\d+\.\s*/, '')}</h2>
                <p className="text-info bg-info-subtle mt-4 rounded-lg px-4 py-3 text-sm leading-relaxed">
                  <strong>Votre objectif : </strong>
                  {chapter.objective}
                </p>
                <ol className="mt-6 space-y-4">
                  {chapter.steps.map((step, stepIndex) => (
                    <li key={step} className="flex gap-3">
                      <span className="border-border text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                        {stepIndex + 1}
                      </span>
                      <p className="pt-0.5 text-sm leading-relaxed sm:text-base">{step}</p>
                    </li>
                  ))}
                </ol>
                {chapter.tip || chapter.warning ? (
                  <div className="mt-5 space-y-3">
                    {chapter.tip ? (
                      <div className="border-info-border bg-info-subtle flex gap-3 rounded-lg border p-4">
                        <Lightbulb className="text-info mt-0.5 size-5 shrink-0" aria-hidden />
                        <div>
                          <h3 className="text-info text-sm font-bold">Conseil pratique</h3>
                          <p className="mt-1 text-sm leading-relaxed">{chapter.tip}</p>
                        </div>
                      </div>
                    ) : null}
                    {chapter.warning ? (
                      <div className="border-warning-border bg-warning-subtle flex gap-3 rounded-lg border p-4">
                        <AlertTriangle
                          className="text-warning mt-0.5 size-5 shrink-0"
                          aria-hidden
                        />
                        <div>
                          <h3 className="text-warning text-sm font-bold">Point de vigilance</h3>
                          <p className="mt-1 text-sm leading-relaxed">{chapter.warning}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="border-border mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:justify-between">
                  <Button
                    type="button"
                    variant={done ? 'secondary' : 'outline'}
                    aria-pressed={done}
                    onClick={() => toggleChapter(chapter.id)}
                  >
                    <CheckCircle2 aria-hidden />
                    {done ? 'Chapitre terminé' : 'Marquer comme terminé'}
                  </Button>
                  {chapter.action ? (
                    <Button asChild variant="secondary">
                      <Link to={chapter.action.to}>
                        {chapter.action.label}
                        <ExternalLink aria-hidden />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
          <section className="border-border border-t pt-5">
            <h2 className="text-lg font-bold">
              {percent === 100 ? 'Bravo, le cours est terminé !' : 'Vous avancez à votre rythme.'}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {surLeServeur
                ? percent === 100
                  ? 'Votre progression est enregistrée sur votre compte. Vous pouvez revoir une étape à tout moment.'
                  : 'Cochez chaque chapitre après l’avoir appliqué. Votre progression suit votre compte, d’un appareil à l’autre.'
                : 'Cochez chaque chapitre après l’avoir appliqué. Votre progression est conservée sur cet appareil seulement — connectez-vous pour la retrouver partout.'}
            </p>
            {enEchec ? (
              <p role="alert" className="text-error mt-2 text-sm">
                Votre dernière coche n’a pas pu être enregistrée. Vérifiez votre connexion : elle ne
                survivra pas au rechargement.
              </p>
            ) : null}
            <Button asChild variant="secondary" className="mt-4">
              <Link to={ROUTES.tutorials}>
                Explorer les autres cours <ArrowRight aria-hidden />
              </Link>
            </Button>
          </section>
        </section>
      </div>
    </div>
  );
}
