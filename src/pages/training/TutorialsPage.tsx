import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Route,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { TRAINING_COURSES, TRAINING_THEMES, type TrainingTheme } from '@/features/training';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function TutorialsPage() {
  useDocumentTitle('Tutoriels & Formation');
  const [theme, setTheme] = useState<TrainingTheme | 'Tous'>('Tous');
  const courses =
    theme === 'Tous'
      ? TRAINING_COURSES
      : TRAINING_COURSES.filter((course) => course.theme === theme);
  const featured = TRAINING_COURSES.find((course) => course.slug === 'facturation-electronique');

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-14">
      <section className="border-primary/20 bg-primary-subtle relative overflow-hidden rounded-3xl border p-6 sm:p-10">
        <div className="bg-primary/10 absolute -top-20 -right-20 size-64 rounded-full blur-3xl" />
        <div className="relative max-w-3xl">
          <Badge variant="primary" className="mb-4">
            <GraduationCap aria-hidden="true" />
            Centre de formation REZO360
          </Badge>
          <PageHeader
            className="mb-0 sm:mb-0"
            title="Apprenez à utiliser REZO360, étape par étape"
            description="Des parcours courts et concrets pour configurer votre espace, organiser le travail de l’équipe et maîtriser les documents commerciaux."
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to={ROUTES.tutorial('bien-demarrer')}>
                Commencer le parcours conseillé
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            {featured ? (
              <Button asChild variant="outline" size="lg">
                <Link to={ROUTES.tutorial(featured.slug)}>Voir la facturation électronique</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="parcours-title" className="space-y-4">
        <div>
          <h2 id="parcours-title" className="text-foreground text-lg font-bold sm:text-xl">
            Un parcours simple en trois temps
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Suivez l’ordre conseillé ou ouvrez directement le thème dont vous avez besoin.
          </p>
        </div>
        <ol className="grid gap-3 md:grid-cols-3">
          {[
            ['1', 'Configurer', 'Entreprise, équipe, clients et droits d’accès.'],
            ['2', 'Travailler', 'Missions, planning, terrain et comptes rendus.'],
            ['3', 'Gérer', 'Devis, factures, stock et échanges électroniques.'],
          ].map(([number, title, description]) => (
            <li key={number} className="border-border bg-surface flex gap-3 rounded-2xl border p-4">
              <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {number}
              </span>
              <div>
                <h3 className="text-foreground text-sm font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cours-title" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="cours-title" className="text-foreground text-lg font-bold sm:text-xl">
              Tous les cours
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {TRAINING_COURSES.length} parcours accessibles à votre rythme.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrer les cours par thème"
          >
            {TRAINING_THEMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTheme(item)}
                className={cn(
                  'min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold transition-colors',
                  theme === item
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
                aria-pressed={theme === item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const Icon = course.icon;
            return (
              <Card
                key={course.slug}
                className="hover:border-primary/40 hover:shadow-raised group flex h-full flex-col transition-all"
              >
                <CardContent className="flex h-full flex-col p-5 sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="bg-primary-subtle text-primary flex size-11 items-center justify-center rounded-2xl">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {course.featured ? <Badge variant="success">Recommandé</Badge> : null}
                      <Badge variant="neutral">{course.theme}</Badge>
                    </div>
                  </div>

                  <h3 className="text-foreground text-base font-bold">{course.title}</h3>
                  <p className="text-muted-foreground mt-2 flex-1 text-xs leading-relaxed">
                    {course.summary}
                  </p>

                  <div className="text-muted-foreground border-border text-2xs mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {course.duration}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpenCheck className="size-3.5" aria-hidden="true" />
                      {course.chapters.length} chapitres
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Route className="size-3.5" aria-hidden="true" />
                      {course.level}
                    </span>
                  </div>

                  <Link
                    to={ROUTES.tutorial(course.slug)}
                    className="text-primary focus-visible:ring-ring mt-4 inline-flex min-h-10 items-center justify-between rounded-lg text-xs font-bold focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Ouvrir le cours
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-success-border bg-success-subtle flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-3">
          <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-foreground text-sm font-bold">Vous pouvez reprendre plus tard</h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Les chapitres cochés sont mémorisés sur cet appareil. Aucun résultat ni donnée métier
              n’est modifié par les cours.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
