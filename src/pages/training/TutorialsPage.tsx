import { ArrowRight, BookOpenCheck, Clock3, GraduationCap, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { TRAINING_COURSES, TRAINING_THEMES, type TrainingTheme } from '@/features/training';
import { useDocumentTitle } from '@/lib/use-document-title';

const LEARNING_PATH = [
  {
    number: '01',
    title: 'Configurez',
    description: 'Préparez votre entreprise, votre équipe et vos premiers clients.',
  },
  {
    number: '02',
    title: 'Passez à l’action',
    description: 'Planifiez les missions et accompagnez le travail sur le terrain.',
  },
  {
    number: '03',
    title: 'Pilotez',
    description: 'Suivez les documents, la facturation et le matériel au même endroit.',
  },
];

export default function TutorialsPage() {
  useDocumentTitle('Tutoriels & Formation');
  const [theme, setTheme] = useState<TrainingTheme | 'Tous'>('Tous');
  const courses =
    theme === 'Tous'
      ? TRAINING_COURSES
      : TRAINING_COURSES.filter((course) => course.theme === theme);
  const featured = TRAINING_COURSES.find((course) => course.slug === 'facturation-electronique');
  const chapterCount = TRAINING_COURSES.reduce(
    (total, course) => total + course.chapters.length,
    0,
  );

  return (
    <div className="workspace-training space-y-6">
      <PageHeader
        title="Tutoriels & Formation"
        description="Des cours courts et concrets pour prendre REZO360 en main, à votre rythme."
        actions={
          <Button asChild>
            <Link to={ROUTES.tutorial('bien-demarrer')}>
              <PlayCircle aria-hidden /> Commencer le parcours
            </Link>
          </Button>
        }
        className="sm:flex-col xl:flex-row"
      />
      {featured ? (
        <section
          className="border-border bg-surface grid overflow-hidden rounded-xl border md:grid-cols-[minmax(0,1fr)_240px]"
          aria-label="Parcours du moment"
        >
          <div className="space-y-3 p-5 sm:p-6">
            <span className="text-info flex items-center gap-2 text-xs font-bold">
              <GraduationCap className="size-4" aria-hidden /> Parcours du moment
            </span>
            <h2 className="text-foreground text-xl font-bold">{featured.title}</h2>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              {featured.summary}
            </p>
            <Button asChild variant="secondary">
              <Link to={ROUTES.tutorial(featured.slug)}>
                Facturation électronique <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <img
            src={featured.image}
            alt={featured.imageAlt}
            className="h-40 w-full object-cover md:h-full"
            fetchPriority="high"
          />
        </section>
      ) : null}
      <section aria-labelledby="parcours-title" className="border-border border-b pb-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="parcours-title" className="text-base font-bold">
            De la configuration au pilotage
          </h2>
          <span className="text-muted-foreground text-xs">
            {TRAINING_COURSES.length} cours · {chapterCount} chapitres guidés
          </span>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {LEARNING_PATH.map((step) => (
            <li key={step.number} className="flex gap-3">
              <span className="bg-info-subtle text-info flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {step.number}
              </span>
              <div>
                <h3 className="text-sm font-bold">{step.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="cours-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cours-title" className="text-lg font-bold">
            Choisissez votre prochain cours
          </h2>
          <span className="text-muted-foreground text-sm" aria-live="polite">
            {courses.length} parcours affiché{courses.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les cours par thème">
          {TRAINING_THEMES.map((item) => (
            <Button
              key={item}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={theme === item}
              onClick={() => setTheme(item)}
              className={
                theme === item ? 'bg-nav-selected text-nav-foreground' : 'text-muted-foreground'
              }
            >
              {item}
            </Button>
          ))}
        </div>
        <div className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
          {courses.map((course) => (
            <article
              key={course.slug}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
            >
              <img
                src={course.image}
                alt={course.imageAlt}
                loading="lazy"
                decoding="async"
                className="h-40 w-full shrink-0 rounded-lg object-cover sm:h-28 sm:w-36"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="info">{course.theme}</Badge>
                  {course.featured ? <Badge variant="warning">Recommandé</Badge> : null}
                </div>
                <h3 className="text-base font-bold">{course.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {course.summary}
                </p>
                <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5" aria-hidden />
                    {course.duration}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookOpenCheck className="size-3.5" aria-hidden />
                    {course.chapters.length} chapitres
                  </span>
                  <span>{course.level}</span>
                </div>
              </div>
              <Button asChild variant="secondary" className="shrink-0 self-start sm:self-center">
                <Link
                  to={ROUTES.tutorial(course.slug)}
                  aria-label={'Ouvrir le cours : ' + course.title}
                >
                  Ouvrir le cours <ArrowRight aria-hidden />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
