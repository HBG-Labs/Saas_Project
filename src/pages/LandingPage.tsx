import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  MapPinned,
  PackageSearch,
  PenTool,
  Radio,
  Smartphone,
  UsersRound,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Faq } from '@/components/marketing/Faq';
import { Pricing } from '@/components/marketing/Pricing';
import { ScrollRevealSection } from '@/components/marketing/ScrollRevealSection';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

const REASSURANCES = [
  '14 jours d’essai sur les formules payantes',
  'Aucun débit aujourd’hui',
  'Sans engagement',
  'Application web installable',
] as const;

const TOOL_GROUPS = [
  { name: 'Instruments terrain', detail: 'Lampe, loupe, niveau, boussole, chrono', icon: Wrench },
  { name: 'Calculateurs', detail: 'Dimensionnements et calculs techniques', icon: Gauge },
  { name: 'Conversions', detail: 'Unités et valeurs utiles sur site', icon: Radio },
  { name: 'Notes & mémos', detail: 'Relevés et informations de terrain', icon: PenTool },
] as const;

const COCKPIT_POINTS = [
  { label: 'Priorités du jour', icon: CalendarDays },
  { label: 'Coordination des équipes', icon: UsersRound },
  { label: 'Suivi des missions', icon: MapPinned },
  { label: 'Continuité bureau-terrain', icon: Smartphone },
] as const;

const FINAL_POINTS = [
  { label: 'Missions suivies', icon: ClipboardCheck },
  { label: 'Rapports contrôlés', icon: FileCheck2 },
  { label: 'Matériel relié', icon: PackageSearch },
] as const;

function ChapterLabel({ number, children }: { number: string; children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="font-mono text-sm font-bold tracking-[0.18em] text-primary">{number}</span>
      <span className="h-px w-10 bg-primary" aria-hidden="true" />
      <span className="text-sm font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {children}
      </span>
    </div>
  );
}

function ProductCapture({
  src,
  alt,
  className = '',
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-overlay ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className="block h-auto w-full"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      <figcaption className="sr-only">Écran réel de REZO360 avec données de démonstration.</figcaption>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-white">
        <div className="absolute top-0 right-0 hidden aspect-video w-[74.5%] overflow-hidden lg:block xl:w-[74vw] xl:max-w-[79.5rem]">
          <img
            src="/images/landing-hero-4k.jpg"
            alt=""
            className="absolute inset-0 h-full w-full translate-x-3 object-cover"
            width="3840"
            height="2160"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, #fff 0%, #fff 7%, rgba(255,255,255,0.65) 12%, rgba(255,255,255,0) 20%)',
            }}
            aria-hidden="true"
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:min-h-[33.5rem] lg:px-8 xl:min-h-[clamp(33.5rem,41.625vw,44.71875rem)]">

          <div className="relative z-10 max-w-xl py-10 sm:py-12 lg:w-[43%] lg:pt-14 lg:pb-0">
            <h1 className="max-w-2xl text-center text-[2.5rem] leading-[1.08] font-bold tracking-tight text-balance text-brand-night sm:text-[3.125rem] lg:text-left lg:text-[3.5rem] lg:leading-[1.05]">
              Pilotez votre activité de terrain en toute simplicité
            </h1>

            <p className="mt-4 max-w-xl text-base leading-[1.55] text-muted-foreground sm:text-lg">
              REZO360 est la plateforme tout-en-un pour les entreprises, artisans et professionnels
              de terrain. De l’organisation des interventions à la facturation électronique,
              centralisez toute votre activité au même endroit.
            </p>

            <ul className="mt-4 space-y-2.5 text-sm font-medium text-foreground sm:text-base">
              {[
                'Simple à prendre en main',
                'Adapté à tous les métiers de terrain',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-touch px-6">
                <Link to={ROUTES.register}>
                  Commencer gratuitement
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-touch px-6">
                <Link to={ROUTES.pricing}>Voir les tarifs</Link>
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
              Aucune carte bancaire requise · 14 jours · Accès complet
            </p>
          </div>

          <div className="relative -mx-4 aspect-video w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] lg:hidden">
            <img
              src="/images/landing-hero-4k.jpg"
              alt="REZO360 présenté sur un ordinateur et un téléphone dans un décor lumineux"
              className="absolute inset-0 h-full w-full object-cover"
              width="3840"
              height="2160"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
      </section>

      <section aria-label="Engagements REZO360" className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-7xl divide-y divide-border px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:px-8">
          {REASSURANCES.map((item) => (
            <div key={item} className="flex min-h-16 items-center gap-3 px-3 py-4 lg:px-5">
              <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <ScrollRevealSection>
        <section className="bg-brand-night py-16 text-white sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-5">
                <div className="mb-5 flex items-center gap-3">
                  <span className="font-mono text-sm font-bold tracking-[0.18em] text-signal-lime">
                    01
                  </span>
                  <span className="h-px w-10 bg-signal-lime" aria-hidden="true" />
                  <span className="text-sm font-semibold tracking-[0.12em] text-cyan-100 uppercase">
                    Le cockpit
                  </span>
                </div>
                <h2 className="text-4xl leading-tight font-bold text-balance sm:text-5xl">
                  Tout voir. Tout décider. Sans courir après l’info.
                </h2>
              </div>
              <div className="space-y-4 text-base leading-relaxed text-blue-100 lg:col-span-6 lg:col-start-7">
                <p>
                  Le tableau de bord rassemble les priorités du jour, les missions actives et les
                  comptes rendus en attente. Le bureau sait où agir ; le terrain sait quoi faire.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {COCKPIT_POINTS.map(({ label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-2 text-sm font-medium text-white">
                      <Icon className="size-4 text-signal-cyan" aria-hidden="true" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative mt-12 lg:mt-16">
              <ProductCapture
                src="/images/product/dashboard.png"
                alt="Tableau de bord REZO360 montrant les priorités, indicateurs et missions récentes"
                eager
                className="border-white/15 bg-white"
              />
              <div className="mt-4 rounded-2xl border border-white/20 bg-white p-4 text-brand-night shadow-modal sm:absolute sm:-bottom-8 sm:right-6 sm:mt-0 sm:w-[22rem]">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-bold text-primary">2026-0142</span>
                  <span className="rounded-full bg-signal-lime px-2.5 py-1 text-xs font-bold">
                    En cours
                  </span>
                </div>
                <p className="mt-3 font-display text-lg font-bold">Maintenance préventive CVC</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
                  <span>Site Horizon · 08:30</span>
                  <span className="font-medium text-primary">Mission active</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <ChapterLabel number="02">Le parcours d’intervention</ChapterLabel>
              <h2 className="text-4xl leading-tight font-bold text-balance text-foreground sm:text-5xl">
                Une intervention, du planning au rapport signé.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                Chaque étape reprend la même information. La mission planifiée devient une
                intervention suivie, puis un compte rendu contrôlé — sans rupture entre les écrans.
              </p>
            </div>

            <div className="mt-14 space-y-16">
              <div className="grid items-center gap-8 lg:grid-cols-12">
                <ProductCapture
                  src="/images/product/missions.png"
                  alt="Liste réelle des missions REZO360 avec statuts, priorités et accès aux fiches"
                  className="lg:col-span-8"
                />
                <div className="lg:col-span-4">
                  <span className="font-mono text-xs font-bold tracking-widest text-signal-orange uppercase">
                    Planifier & affecter
                  </span>
                  <h3 className="mt-3 text-2xl font-bold text-foreground">Le travail part avec un cadre clair.</h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    Référence, priorité, horaire, site et intervenant restent visibles avant même
                    d’ouvrir la fiche. Le planning et la carte sont accessibles depuis le même flux.
                  </p>
                </div>
              </div>

              <div className="grid items-center gap-8 lg:grid-cols-12">
                <div className="order-2 lg:order-1 lg:col-span-4">
                  <span className="font-mono text-xs font-bold tracking-widest text-signal-orange uppercase">
                    Rendre compte
                  </span>
                  <h3 className="mt-3 text-2xl font-bold text-foreground">Le terrain documente pendant que c’est frais.</h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    L’intervention ouverte mène au compte rendu complet, aux pièces jointes et aux
                    signatures. Le responsable retrouve ensuite la soumission dans sa file de contrôle.
                  </p>
                  <ul className="mt-5 space-y-3 text-sm text-foreground">
                    {['Intervention en cours', 'Compte rendu structuré', 'Contrôle et validation'].map(
                      (item) => (
                        <li key={item} className="flex items-center gap-2">
                          <Check className="size-4 text-primary" aria-hidden="true" />
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
                <div className="order-1 grid gap-5 sm:grid-cols-2 lg:order-2 lg:col-span-8">
                  <ProductCapture
                    src="/images/product/reports.png"
                    alt="Écran réel REZO360 de sélection d’une intervention et de rédaction du compte rendu"
                  />
                  <ProductCapture
                    src="/images/product/review.png"
                    alt="File réelle de contrôle et validation des comptes rendus dans REZO360"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="bg-surface-sunken py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
            <div className="lg:col-span-7">
              <ChapterLabel number="03">La boîte à outils</ChapterLabel>
              <h2 className="max-w-3xl text-4xl leading-tight font-bold text-balance text-foreground sm:text-5xl">
                Les outils métier, comme une boîte à outils vivante.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Des outils rapides pour le chantier, regroupés avec les calculateurs, conversions et
                notes que les techniciens utilisent au quotidien.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {TOOL_GROUPS.map(({ name, detail, icon: Icon }) => (
                  <div key={name} className="rounded-2xl border border-border bg-surface p-5 shadow-raised">
                    <div className="flex items-start gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-foreground">{name}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button asChild variant="outline" size="lg" className="mt-8 min-h-touch">
                <Link to={ROUTES.tools}>
                  Explorer le catalogue
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="mx-auto w-full max-w-sm lg:col-span-5 lg:justify-self-end">
              <ProductCapture
                src="/images/product/tools-mobile.png"
                alt="Catalogue mobile réel des outils et instruments de terrain REZO360"
              />
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative min-h-[32rem] overflow-hidden rounded-3xl bg-brand-night">
              <img
                src="/images/backgrounds/field-technician-industrial.png"
                alt="Technicien de maintenance industrielle utilisant une tablette dans un local technique"
                className="absolute inset-0 h-full w-full object-cover object-[70%_center] sm:object-center"
                loading="lazy"
                decoding="async"
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-brand-night via-brand-night/90 to-brand-night/15"
                aria-hidden="true"
              />
              <div className="relative flex min-h-[32rem] max-w-2xl flex-col justify-end p-7 text-white sm:p-12 lg:p-16">
                <span className="font-mono text-sm font-bold tracking-[0.16em] text-signal-cyan uppercase">
                  Sur le terrain
                </span>
                <h2 className="mt-4 text-4xl leading-tight font-bold text-balance sm:text-5xl">
                  L’information utile, là où le travail se fait.
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-blue-100">
                  REZO360 reste lisible sur mobile pour retrouver une mission, renseigner
                  l’intervention et transmettre le compte rendu depuis le chantier.
                </p>
              </div>
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <Pricing />
      </ScrollRevealSection>

      <ScrollRevealSection>
        <Faq />
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-brand-night px-6 py-12 text-white shadow-modal sm:px-12 sm:py-16 lg:px-16">
              <div className="absolute -right-16 -top-20 size-64 rounded-full border-[3rem] border-signal-cyan/20" aria-hidden="true" />
              <div className="absolute -bottom-24 right-32 size-56 rounded-full border-[2.5rem] border-white/10" aria-hidden="true" />
              <div className="relative max-w-3xl">
                <span className="font-mono text-sm font-bold tracking-[0.16em] text-signal-lime uppercase">
                  Prêt pour le prochain départ
                </span>
                <h2 className="mt-4 text-4xl leading-tight font-bold text-balance sm:text-5xl">
                  Vos opérations, enfin dans le même tempo.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-blue-100">
                  Commencez avec la formule Free ou testez pendant quatorze jours les fonctions
                  d’équipe d’une formule payante.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="min-h-touch border-signal-lime bg-signal-lime px-6 text-brand-night hover:border-white hover:bg-white"
                  >
                    <Link to={ROUTES.register}>
                      Créer mon compte
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="min-h-touch border-white/60 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link to={ROUTES.pricing}>Comparer les formules</Link>
                  </Button>
                </div>
                <ul className="mt-8 grid gap-3 border-t border-white/20 pt-6 text-sm text-blue-50 sm:grid-cols-3">
                  {FINAL_POINTS.map(({ label, icon: Icon }) => (
                    <li key={label} className="flex items-center gap-2">
                      <Icon className="size-4 text-signal-lime" aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </ScrollRevealSection>
    </>
  );
}
