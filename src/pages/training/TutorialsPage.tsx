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

import { TrainingDoodle } from '@/components/training/TrainingDoodle';
import { ROUTES } from '@/config/routes';
import { TRAINING_COURSES, TRAINING_THEMES, type TrainingTheme } from '@/features/training';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

const THEME_STYLES: Record<TrainingTheme, { badge: string; marker: string; icon: string }> = {
  Démarrage: {
    badge: 'bg-blue-50 text-primary border-blue-200',
    marker: 'bg-primary',
    icon: 'bg-brand-night text-white',
  },
  Pilotage: {
    badge: 'bg-blue-50 text-primary border-blue-200',
    marker: 'bg-primary',
    icon: 'bg-brand-night text-white',
  },
  Terrain: {
    badge: 'bg-blue-50 text-primary border-blue-200',
    marker: 'bg-primary',
    icon: 'bg-brand-night text-white',
  },
  Gestion: {
    badge: 'bg-blue-50 text-primary border-blue-200',
    marker: 'bg-primary',
    icon: 'bg-brand-night text-white',
  },
};

const LEARNING_PATH = [
  {
    number: '01',
    title: 'Configurez',
    description: 'Préparez votre entreprise, votre équipe et vos premiers clients.',
    accent: 'bg-primary',
  },
  {
    number: '02',
    title: 'Passez à l’action',
    description: 'Planifiez les missions et accompagnez le travail sur le terrain.',
    accent: 'bg-primary',
  },
  {
    number: '03',
    title: 'Pilotez',
    description: 'Suivez les documents, la facturation et le matériel au même endroit.',
    accent: 'bg-primary',
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
      {/*
        En clair, le héros est blanc. En sombre, il devient marine — le même
        `bg-brand-night` que le héros d'un cours (`TutorialDetailPage`), pour
        que l'académie et ses cours ne se contredisent pas d'un écran à l'autre.
      */}
      <section className="text-brand-night dark:bg-brand-night relative isolate overflow-hidden border-y border-slate-200 bg-white px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20 dark:border-white/10 dark:text-white">
        {/*
          Deux trames plutôt qu'une seule dont on inverserait la couleur : la
          teinte vit dans un `style` inline, hors de portée des variantes
          Tailwind. Des lignes sombres sur fond marine seraient invisibles.
        */}
        <div
          className="absolute inset-0 -z-10 opacity-45 dark:hidden"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,35,75,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(15,35,75,.055) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }}
        />
        <div
          className="absolute inset-0 -z-10 hidden opacity-20 dark:block"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }}
        />

        <div className="relative mx-auto grid max-w-[1480px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.95fr)]">
          <TrainingDoodle
            variant="practice"
            className="text-primary/55 absolute -top-10 right-[calc(49%+3rem)] z-10 hidden h-24 w-44 -rotate-6 xl:block"
          />
          <div>
            <div className="border-primary/15 text-primary mb-6 inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-2 text-xs font-bold tracking-wide uppercase shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-white">
              <GraduationCap className="size-4" aria-hidden="true" />
              Académie REZO360
            </div>
            <h1 className="text-brand-night max-w-3xl text-4xl leading-[1.03] font-extrabold tracking-tight sm:text-5xl lg:text-6xl dark:text-white">
              Maîtrisez votre activité,
              <span className="text-primary block">un geste après l’autre.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-blue-100/80">
              Des cours courts, concrets et guidés pour prendre REZO360 en main et rendre votre
              équipe autonome.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/*
                En sombre, `--primary` s'éclaircit : du texte blanc dessus
                tomberait sous le seuil WCAG. `--primary-foreground` est le
                jeton prévu pour ce qui se pose SUR le primaire — il vaut
                marine en sombre. Le survol suit le même raisonnement.
              */}
              <Link
                to={ROUTES.tutorial('bien-demarrer')}
                className="bg-primary focus-visible:ring-primary dark:hover:bg-[var(--primary-hover)] inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-white shadow-lg shadow-blue-950/15 transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-[var(--primary-foreground)]"
              >
                <PlayCircle className="size-5" aria-hidden="true" />
                Commencer le parcours
              </Link>
              {featured ? (
                <Link
                  to={ROUTES.tutorial(featured.slug)}
                  className="text-brand-night hover:border-primary/40 hover:text-primary focus-visible:ring-primary dark:hover:text-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none dark:border-white/25 dark:bg-white/5 dark:text-white"
                >
                  Facturation électronique
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-4 border-t border-slate-300 pt-6 dark:border-white/15">
              <div>
                <strong className="text-brand-night block text-2xl font-extrabold dark:text-white">
                  {TRAINING_COURSES.length}
                </strong>
                <span className="text-xs text-slate-500 dark:text-blue-100/70">cours pratiques</span>
              </div>
              <div>
                <strong className="text-brand-night block text-2xl font-extrabold dark:text-white">
                  {chapterCount}
                </strong>
                <span className="text-xs text-slate-500 dark:text-blue-100/70">
                  chapitres guidés
                </span>
              </div>
              <div>
                <strong className="text-brand-night block text-2xl font-extrabold dark:text-white">
                  100 %
                </strong>
                <span className="text-xs text-slate-500 dark:text-blue-100/70">à votre rythme</span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div
              className="border-signal-cyan absolute -top-4 -right-4 h-28 w-28 rounded-tr-[36px] border-t-2 border-r-2"
              aria-hidden="true"
            />
            {/*
              L'ombre est CLAIRE en mode jour — une ombre grise sur fond blanc
              se lit comme un relief. Posée telle quelle sur le marine, elle
              devient un halo blanc autour du bloc : l'inverse d'une ombre. En
              sombre, elle passe donc au noir.
            */}
            <div className="relative min-h-[440px] overflow-hidden rounded-[34px] bg-slate-800 shadow-xl shadow-slate-300/60 sm:min-h-[480px] dark:shadow-black/50">
              <img
                src="/images/training/electronic-invoicing-hero-v2.png"
                alt="Dirigeante antillaise et responsable administratif validant une facture électronique"
                className="absolute inset-0 h-full w-full object-cover object-center"
                fetchPriority="high"
              />
              <div className="bg-brand-night/20 absolute inset-0" aria-hidden="true" />
              <div className="absolute top-5 left-5 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-extrabold tracking-wide text-slate-900 uppercase shadow-lg">
                <span className="bg-signal-lime size-2 rounded-full" />
                Facturation électronique en situation réelle
              </div>

              {featured ? (
                <Link
                  to={ROUTES.tutorial(featured.slug)}
                  className="group absolute right-5 bottom-5 left-5 rounded-2xl border border-white/80 bg-white p-4 text-left text-slate-950 shadow-xl transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="bg-signal-lime text-brand-night flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <featured.icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-primary text-[10px] font-extrabold tracking-widest uppercase">
                          Parcours du moment
                        </p>
                        <span className="text-muted-foreground shrink-0 text-xs font-bold">
                          {featured.duration}
                        </span>
                      </div>
                      <h2 className="mt-1 text-base leading-tight font-extrabold sm:text-lg">
                        {featured.title}
                      </h2>
                    </div>
                    <ArrowRight
                      className="text-primary mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              ) : null}
            </div>
            <div
              className="bg-signal-orange absolute -bottom-3 -left-3 size-16 rounded-bl-[26px]"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 pt-12 sm:px-8 lg:px-12">
        <section aria-labelledby="parcours-title" className="relative">
          <TrainingDoodle
            variant="route"
            className="top-0 right-0 hidden h-24 w-52 rotate-2 text-orange-500 opacity-65 xl:block"
          />
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

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => {
              const Icon = course.icon;
              const style = THEME_STYLES[course.theme];
              const courseNumber =
                TRAINING_COURSES.findIndex((item) => item.slug === course.slug) + 1;
              const isWide = course.featured && theme === 'Tous';

              return (
                <article
                  key={course.slug}
                  className={cn(
                    'border-border bg-surface shadow-raised group relative flex min-h-[460px] flex-col overflow-hidden rounded-[28px] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
                    isWide &&
                      'xl:col-span-2 xl:grid xl:min-h-[430px] xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,.92fr)]',
                  )}
                >
                  <div
                    className={cn(
                      'relative h-52 overflow-hidden bg-slate-800',
                      isWide && 'xl:h-full',
                    )}
                  >
                    <img
                      src={course.image}
                      alt={course.imageAlt}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="bg-brand-night/15 absolute inset-0" aria-hidden="true" />
                    <span
                      className={cn(
                        'absolute inset-x-0 bottom-0 h-1.5',
                        style.marker,
                        isWide && 'xl:inset-y-0 xl:right-0 xl:left-auto xl:h-auto xl:w-1.5',
                      )}
                    />
                    <div className="absolute top-4 right-4 left-4 flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          'flex size-11 items-center justify-center rounded-2xl border border-white/60 shadow-lg',
                          style.icon,
                        )}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      {course.featured ? (
                        <span className="bg-signal-lime text-brand-night rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase shadow-md">
                          Recommandé
                        </span>
                      ) : null}
                    </div>
                    <p className="bg-brand-night absolute bottom-4 left-4 rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold tracking-[0.16em] text-white uppercase shadow-lg">
                      Formation {String(courseNumber).padStart(2, '0')}
                    </p>
                  </div>

                  <div className={cn('flex flex-1 flex-col p-6', isWide && 'xl:p-8')}>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase',
                            style.badge,
                          )}
                        >
                          {course.theme}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-400">
                          {String(courseNumber).padStart(2, '0')} /{' '}
                          {String(TRAINING_COURSES.length).padStart(2, '0')}
                        </span>
                      </div>
                      <h3
                        className={cn(
                          'text-foreground mt-4 text-xl leading-tight font-extrabold',
                          isWide && 'xl:text-3xl',
                        )}
                      >
                        {course.title}
                      </h3>
                      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                        {course.summary}
                      </p>
                    </div>

                    <div className="text-muted-foreground mt-auto flex flex-wrap gap-2 pt-6 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2.5">
                        <Clock3 className="text-primary size-4 shrink-0" aria-hidden="true" />
                        {course.duration}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2.5">
                        <BookOpenCheck
                          className="text-primary size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {course.chapters.length} chapitres
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-2.5">
                        <Route className="text-primary size-4 shrink-0" aria-hidden="true" />
                        {course.level}
                      </span>
                    </div>

                    <Link
                      to={ROUTES.tutorial(course.slug)}
                      className="bg-brand-night hover:bg-primary focus-visible:ring-ring mt-5 inline-flex min-h-12 items-center justify-between rounded-xl px-4 text-sm font-extrabold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Ouvrir le cours
                      <span className="flex size-8 items-center justify-center rounded-full bg-white/10 transition-transform group-hover:translate-x-1">
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
          <span className="bg-signal-lime absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
          <TrainingDoodle
            variant="checklist"
            className="right-36 -bottom-7 hidden h-28 w-48 rotate-6 text-cyan-300 opacity-40 xl:block"
          />
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
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
              className="bg-primary focus-visible:ring-primary focus-visible:ring-offset-brand-night inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white shadow-lg shadow-black/15 transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
