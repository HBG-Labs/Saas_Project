import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  GraduationCap,
  PlayCircle,
  Route,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';
import { TRAINING_COURSES, TRAINING_THEMES, type TrainingTheme } from '@/features/training';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

const THEME_STYLES: Record<
  TrainingTheme,
  { gradient: string; accent: string; badge: string; number: string }
> = {
  Démarrage: {
    gradient: 'from-cyan-500 via-blue-600 to-blue-950',
    accent: 'bg-signal-cyan',
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    number: 'text-cyan-100/20',
  },
  Pilotage: {
    gradient: 'from-emerald-500 via-teal-600 to-cyan-950',
    accent: 'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    number: 'text-emerald-100/20',
  },
  Terrain: {
    gradient: 'from-orange-500 via-rose-500 to-violet-900',
    accent: 'bg-signal-orange',
    badge: 'bg-orange-50 text-orange-800 border-orange-200',
    number: 'text-orange-100/20',
  },
  Gestion: {
    gradient: 'from-violet-600 via-blue-700 to-[#0A1B43]',
    accent: 'bg-violet-400',
    badge: 'bg-violet-50 text-violet-800 border-violet-200',
    number: 'text-violet-100/20',
  },
};

const LEARNING_PATH = [
  {
    number: '01',
    title: 'Configurez',
    description: 'Préparez votre entreprise, votre équipe et vos premiers clients.',
    accent: 'bg-signal-cyan',
  },
  {
    number: '02',
    title: 'Passez à l’action',
    description: 'Planifiez les missions et accompagnez le travail sur le terrain.',
    accent: 'bg-signal-lime',
  },
  {
    number: '03',
    title: 'Pilotez',
    description: 'Suivez les documents, la facturation et le matériel au même endroit.',
    accent: 'bg-signal-orange',
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
    <div className="relative -mx-4 -mt-4 overflow-hidden pb-16 sm:-mx-6 lg:-mx-8">
      <section className="bg-brand-night relative isolate overflow-hidden px-4 py-12 text-white sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div
          className="absolute inset-0 -z-20 opacity-25"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
            maskImage: 'linear-gradient(to bottom, black, transparent 92%)',
          }}
        />
        <div
          className="bg-signal-cyan/20 absolute -top-28 right-[8%] -z-10 size-80 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div
          className="bg-primary/40 absolute -bottom-40 left-[18%] -z-10 size-96 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)]">
          <div>
            <div className="border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold tracking-wide uppercase">
              <GraduationCap className="size-4" aria-hidden="true" />
              Académie REZO360
            </div>
            <h1 className="max-w-3xl text-4xl leading-[1.03] font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Maîtrisez votre activité,
              <span className="text-signal-lime block">un geste après l’autre.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-blue-100/80 sm:text-lg">
              Des cours courts, concrets et guidés pour prendre REZO360 en main et rendre votre
              équipe autonome.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to={ROUTES.tutorial('bien-demarrer')}
                className="bg-signal-lime text-brand-night focus-visible:ring-signal-lime inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold shadow-lg shadow-black/20 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1B43] focus-visible:outline-none"
              >
                <PlayCircle className="size-5" aria-hidden="true" />
                Commencer le parcours
              </Link>
              {featured ? (
                <Link
                  to={ROUTES.tutorial(featured.slug)}
                  className="hover:border-signal-cyan/70 hover:bg-signal-cyan/10 focus-visible:ring-signal-cyan inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-bold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Facturation électronique
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/15 pt-6">
              <div>
                <strong className="block text-2xl font-extrabold text-white">
                  {TRAINING_COURSES.length}
                </strong>
                <span className="text-xs text-blue-100/65">cours pratiques</span>
              </div>
              <div>
                <strong className="block text-2xl font-extrabold text-white">{chapterCount}</strong>
                <span className="text-xs text-blue-100/65">chapitres guidés</span>
              </div>
              <div>
                <strong className="block text-2xl font-extrabold text-white">100 %</strong>
                <span className="text-xs text-blue-100/65">à votre rythme</span>
              </div>
            </div>
          </div>

          {featured ? (
            <Link
              to={ROUTES.tutorial(featured.slug)}
              className="group relative mx-auto block w-full max-w-md focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none lg:rotate-2 lg:transition-transform lg:hover:rotate-0"
            >
              <div className="bg-signal-orange absolute -top-3 -right-3 z-10 rounded-full px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-white uppercase shadow-lg">
                À la une
              </div>
              <div className="overflow-hidden rounded-[28px] border border-white/20 bg-white text-left shadow-2xl shadow-black/35">
                <div className="from-primary to-brand-night relative overflow-hidden bg-gradient-to-br via-blue-700 p-6 text-white">
                  <div className="bg-signal-cyan/20 absolute -right-10 -bottom-14 size-40 rounded-full blur-2xl" />
                  <div className="relative flex items-start justify-between gap-4">
                    <span className="bg-signal-lime text-brand-night flex size-12 items-center justify-center rounded-2xl shadow-lg">
                      <featured.icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold">
                      {featured.duration}
                    </span>
                  </div>
                  <p className="text-signal-cyan relative mt-7 text-xs font-extrabold tracking-widest uppercase">
                    Parcours essentiel
                  </p>
                  <h2 className="relative mt-2 text-2xl leading-tight font-extrabold text-white">
                    {featured.title}
                  </h2>
                </div>
                <div className="p-6">
                  <ol className="space-y-3">
                    {featured.chapters.slice(0, 4).map((chapter, index) => (
                      <li key={chapter.id} className="flex items-center gap-3 text-sm">
                        <span className="bg-primary-subtle text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold">
                          {index + 1}
                        </span>
                        <span className="text-foreground line-clamp-1 font-semibold">
                          {chapter.title.replace(/^\d+\.\s*/, '')}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="border-border text-primary mt-5 flex items-center justify-between border-t pt-4 text-sm font-extrabold">
                    Voir les {featured.chapters.length} étapes
                    <ArrowRight
                      className="size-5 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </Link>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 pt-12 sm:px-8 lg:px-12">
        <section aria-labelledby="parcours-title">
          <div className="mb-6 max-w-2xl">
            <p className="text-primary text-xs font-extrabold tracking-widest uppercase">
              Votre feuille de route
            </p>
            <h2
              id="parcours-title"
              className="text-foreground mt-2 text-2xl font-extrabold sm:text-3xl"
            >
              De la configuration au pilotage
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Suivez l’ordre conseillé ou choisissez directement le sujet qui vous intéresse.
            </p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {LEARNING_PATH.map((step) => (
              <li
                key={step.number}
                className="border-border bg-surface shadow-raised relative overflow-hidden rounded-2xl border p-5"
              >
                <span className={cn('absolute inset-x-0 top-0 h-1', step.accent)} />
                <div className="flex items-center justify-between">
                  <span className="text-primary font-mono text-xs font-bold">
                    ÉTAPE {step.number}
                  </span>
                  <span className={cn('size-2.5 rounded-full', step.accent)} />
                </div>
                <h3 className="text-foreground mt-5 text-lg font-extrabold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="cours-title">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-primary mb-2 flex items-center gap-2 text-xs font-extrabold tracking-widest uppercase">
                <Sparkles className="size-4" aria-hidden="true" />
                Bibliothèque
              </div>
              <h2 id="cours-title" className="text-foreground text-2xl font-extrabold sm:text-3xl">
                Choisissez votre prochain cours
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {courses.length} parcours affiché{courses.length > 1 ? 's' : ''}.
              </p>
            </div>
            <div
              className="border-border bg-surface shadow-raised flex flex-wrap gap-1 rounded-2xl border p-1.5"
              role="group"
              aria-label="Filtrer les cours par thème"
            >
              {TRAINING_THEMES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTheme(item)}
                  className={cn(
                    'min-h-9 cursor-pointer rounded-xl px-3 text-xs font-bold transition-all',
                    theme === item
                      ? 'bg-brand-night text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                  )}
                  aria-pressed={theme === item}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => {
              const Icon = course.icon;
              const style = THEME_STYLES[course.theme];
              const courseNumber =
                TRAINING_COURSES.findIndex((item) => item.slug === course.slug) + 1;

              return (
                <article
                  key={course.slug}
                  className="border-border bg-surface shadow-raised group flex min-h-[410px] flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    className={cn(
                      'relative min-h-36 overflow-hidden bg-gradient-to-br p-5 text-white',
                      style.gradient,
                    )}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,.26),transparent_30%)]" />
                    <span
                      className={cn(
                        'absolute -right-1 -bottom-8 font-mono text-8xl leading-none font-black',
                        style.number,
                      )}
                      aria-hidden="true"
                    >
                      {String(courseNumber).padStart(2, '0')}
                    </span>
                    <div className="relative flex items-start justify-between gap-3">
                      <span className="flex size-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-sm">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      {course.featured ? (
                        <span className="bg-signal-lime text-brand-night rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase">
                          Recommandé
                        </span>
                      ) : null}
                    </div>
                    <p className="relative mt-6 text-[11px] font-bold tracking-[0.18em] text-white/70 uppercase">
                      Formation {String(courseNumber).padStart(2, '0')}
                    </p>
                  </div>

                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div>
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase',
                          style.badge,
                        )}
                      >
                        {course.theme}
                      </span>
                      <h3 className="text-foreground mt-4 text-xl leading-tight font-extrabold">
                        {course.title}
                      </h3>
                      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                        {course.summary}
                      </p>
                    </div>

                    <div className="border-border text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-5 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="size-4" aria-hidden="true" />
                        {course.duration}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpenCheck className="size-4" aria-hidden="true" />
                        {course.chapters.length} chapitres
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Route className="size-4" aria-hidden="true" />
                        {course.level}
                      </span>
                    </div>

                    <Link
                      to={ROUTES.tutorial(course.slug)}
                      className="text-primary focus-visible:ring-ring mt-4 inline-flex min-h-11 items-center justify-between rounded-xl text-sm font-extrabold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Ouvrir le cours
                      <span className="bg-primary-subtle flex size-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-1">
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-brand-night relative overflow-hidden rounded-3xl px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="bg-signal-lime/15 absolute -top-20 -right-12 size-64 rounded-full blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-2xl gap-4">
              <span className="bg-signal-lime text-brand-night flex size-11 shrink-0 items-center justify-center rounded-2xl">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-white">Avancez à votre rythme</h2>
                <p className="mt-1 text-sm leading-relaxed text-blue-100/70">
                  Vos chapitres terminés sont mémorisés sur cet appareil. Revenez quand vous voulez
                  et reprenez exactement là où vous vous êtes arrêté.
                </p>
              </div>
            </div>
            <Link
              to={ROUTES.tutorial('bien-demarrer')}
              className="bg-signal-cyan text-brand-night inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold transition-colors hover:bg-white"
            >
              Démarrer maintenant
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
