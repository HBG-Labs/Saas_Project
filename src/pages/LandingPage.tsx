import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  Handshake,
  LockKeyhole,
  MapPinned,
  PackageSearch,
  PenTool,
  Radio,
  ShieldCheck,
  Smartphone,
  UsersRound,
  Wrench,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Faq } from '@/components/marketing/Faq';
import { Pricing } from '@/components/marketing/Pricing';
import { ScrollRevealSection } from '@/components/marketing/ScrollRevealSection';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

/**
 * Repli d'un pixel transparent, pour les deux `<picture>` du hero.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `display:none` N'EMPÊCHE PAS UN TÉLÉCHARGEMENT
 *
 * Les deux photos du hero vivaient chacune dans un conteneur masqué à l'autre
 * palier — `hidden lg:block` pour celle d'ordinateur, `lg:hidden` pour celle de
 * téléphone. On pouvait croire l'affaire réglée : ce qui n'est pas affiché
 * n'est pas chargé.
 *
 * C'est faux. Le navigateur récupère les images d'un conteneur en
 * `display:none`. Mesuré sur un iPhone SE simulé, avant ce changement :
 *
 *     786 Ko  /images/landing-hero-4k.jpg   ← JAMAIS AFFICHÉE À CETTE LARGEUR
 *     226 Ko  /images/landing-hero-v2.jpg   ← la seule réellement visible
 *
 * Pire que le gaspillage : la photo invisible portait `fetchPriority="high"`.
 * Elle entrait donc en concurrence avec celle qu'on cherchait à afficher vite,
 * et retardait le plus grand rendu de contenu sur les seuls appareils dont la
 * bande passante est comptée — c'est-à-dire sur le trafic acheté en publicité.
 *
 * `<picture>` règle cela à la racine : le navigateur évalue les `media` À
 * L'ANALYSE, avant toute requête, et ne télécharge QUE la source retenue.
 * L'`<img>` sert de repli obligatoire ; il pointe donc sur ce pixel, qui ne
 * coûte rien puisqu'il est en ligne dans le document.
 *
 * Deux `<picture>` distincts, et non une seule : les deux photos ne sont pas
 * deux tailles d'un même visuel. Celle de téléphone porte le logo et l'accroche
 * gravés, l'autre est volontairement muette — elles occupent des places
 * différentes dans la page et ne se remplacent pas l'une l'autre.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const PIXEL_VIDE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

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

/**
 * Quatre faits vérifiables, à la place de quatre adjectifs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI MANQUE ICI, ET POURQUOI ON NE L'INVENTE PAS
 *
 * La confiance se gagne normalement par des témoignages, des logos clients et
 * des compteurs d'usage. REZO360 se lance : il n'en a aucun de vrai, et en
 * fabriquer serait mentir à des artisans à qui l'on demande ensuite leur carte
 * bancaire.
 *
 * Reste ce qui est VÉRIFIABLE par le visiteur lui-même. « Infrastructure
 * évolutive » et « services reconnus » ne l'étaient pas : ce sont des
 * adjectifs, et n'importe quel site peut les écrire. Un SIRET se recherche sur
 * l'annuaire des entreprises en dix secondes ; c'est ce qui distingue un
 * éditeur réel d'une page montée en un week-end.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA LOCALISATION DES DONNÉES EST EXACTE, PAS FLATTEUSE
 *
 * « Hébergement européen » aurait mieux sonné. C'est faux : le projet tourne en
 * `ca-central-1`, à Montréal — vérifié auprès de l'API Supabase, et consigné
 * dans `config/legal.ts` → `SOUS_TRAITANTS`.
 *
 * Le Canada bénéficie d'une décision d'adéquation de la Commission européenne,
 * ce qui rend le transfert licite. Le dire ainsi est à la fois honnête et
 * rassurant ; l'annoncer « européen » serait une erreur de fait sur un point
 * que l'article 13 du RGPD rend opposable — un client professionnel recopie
 * cette ligne dans son propre registre de traitements.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const INFRASTRUCTURE_POINTS = [
  {
    title: 'Éditeur identifié',
    detail: 'HBG Labs, entreprise française — SIRET 109 198 440 00017',
    icon: Handshake,
    iconClassName: 'bg-orange-50 text-orange-600',
  },
  {
    title: 'Vos données au Canada',
    detail: 'Sous décision d’adéquation de la Commission européenne',
    icon: ShieldCheck,
    iconClassName: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Paiements sécurisés',
    detail: 'Transactions traitées par Stripe, jamais par nous',
    icon: LockKeyhole,
    iconClassName: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Sans engagement',
    detail: 'Résiliable en deux clics depuis votre espace',
    icon: Zap,
    iconClassName: 'bg-emerald-50 text-emerald-600',
  },
] as const;

type AnnotationTone = 'cyan' | 'orange' | 'violet' | 'lime';
type AnnotationArrow = 'curve-left' | 'curve-right' | 'loop-left';
type DoodleVariant = 'sparkles' | 'loop' | 'zigzag';
type TechnicianSketchVariant = 'electrical' | 'network' | 'measurement';

const ANNOTATION_TONES: Record<AnnotationTone, string> = {
  cyan: 'text-cyan-300',
  orange: 'text-orange-500',
  violet: 'text-violet-500',
  lime: 'text-emerald-600',
};

function DecorativeDoodle({ variant, className }: { variant: DoodleVariant; className: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={`pointer-events-none absolute ${className}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {variant === 'sparkles' ? (
        <>
          <path d="M28 8c1 13 6 19 18 21-12 2-17 8-18 22-2-14-7-20-19-22 12-2 17-8 19-21Z" />
          <path d="M69 42c1 9 4 13 13 15-9 1-12 6-13 15-1-9-5-14-13-15 8-2 12-6 13-15Z" />
          <path d="M44 66c1 6 3 9 9 10-6 1-8 4-9 11-1-7-4-10-10-11 6-1 9-4 10-10Z" />
        </>
      ) : null}
      {variant === 'loop' ? (
        <>
          <path d="M82 39C73 12 25 8 11 34-3 60 28 84 61 75c30-8 38-34 20-48" />
          <path d="m77 18 5 9-10 2" />
          <circle cx="19" cy="76" r="3" fill="currentColor" stroke="none" />
          <circle cx="87" cy="64" r="2" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {variant === 'zigzag' ? (
        <>
          <path d="m7 57 17-22 14 27 18-32 14 26 19-23" />
          <path d="M13 73c20 7 47 7 70-1" />
        </>
      ) : null}
    </svg>
  );
}

function TechnicianSketch({
  variant,
  className,
}: {
  variant: TechnicianSketchVariant;
  className: string;
}) {
  return (
    <svg
      viewBox="0 0 220 140"
      className={`pointer-events-none absolute ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' }}
    >
      {variant === 'electrical' ? (
        <>
          <text x="16" y="22" fill="currentColor" stroke="none" fontSize="17">
            U = R × I
          </text>
          <text x="126" y="126" fill="currentColor" stroke="none" fontSize="15">
            P = U × I
          </text>
          <path d="M20 66h32l8-12 12 24 12-24 12 24 9-12h28" />
          <path d="M133 66h19m28 0h20v42H20V66" />
          <path d="M158 51v30m12-22v14" />
          <circle cx="176" cy="30" r="14" />
          <path d="m166 20 20 20m0-20-20 20M176 10V4m0 52v-6m20-20h6m-52 0h6" />
        </>
      ) : null}
      {variant === 'network' ? (
        <>
          <rect x="18" y="50" width="52" height="34" rx="4" />
          <rect x="150" y="50" width="52" height="34" rx="4" />
          <circle cx="110" cy="68" r="18" />
          <path d="M70 67h22m36 0h22" strokeDasharray="5 5" />
          <path d="m84 61 8 6-8 6m52-12-8 6 8 6" />
          <path d="M101 61c5-5 13-5 18 0m-14 5c3-3 7-3 10 0" />
          <circle cx="110" cy="72" r="2" fill="currentColor" stroke="none" />
          <text x="17" y="105" fill="currentColor" stroke="none" fontSize="14">
            bureau
          </text>
          <text x="151" y="105" fill="currentColor" stroke="none" fontSize="14">
            terrain
          </text>
          <path d="M28 39c8-12 22-17 34-12m130 12c-8-12-22-17-34-12" />
        </>
      ) : null}
      {variant === 'measurement' ? (
        <>
          <path d="M35 104h132L167 28 35 104Z" />
          <path d="M154 104v-13h13" />
          <path d="M35 116h132m-126-6-6 6 6 6m120-12 6 6-6 6" />
          <path d="M180 104V28m-6 7 6-7 6 7m-12 62 6 7 6-7" />
          <text x="91" y="136" fill="currentColor" stroke="none" fontSize="14">
            L
          </text>
          <text x="190" y="70" fill="currentColor" stroke="none" fontSize="14">
            h
          </text>
          <text x="43" y="93" fill="currentColor" stroke="none" fontSize="14">
            α
          </text>
          <text x="30" y="22" fill="currentColor" stroke="none" fontSize="17">
            S = L × l
          </text>
        </>
      ) : null}
    </svg>
  );
}

function HandwrittenAnnotation({
  children,
  className,
  tone,
  arrow,
}: {
  children: ReactNode;
  className: string;
  tone: AnnotationTone;
  arrow: AnnotationArrow;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-20 hidden select-none ${ANNOTATION_TONES[tone]} ${className}`}
      style={{ fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' }}
    >
      <span className="block text-center text-[1.05rem] leading-snug font-semibold italic drop-shadow-sm">
        {children}
      </span>
      <svg
        viewBox="0 0 112 58"
        className="mt-1 h-12 w-full overflow-visible"
        fill="none"
        aria-hidden="true"
      >
        {arrow === 'curve-left' ? (
          <>
            <path d="M101 5C69 5 29 16 13 49" stroke="currentColor" strokeWidth="2.4" />
            <path d="M13 49 14 36M13 49l13-4" stroke="currentColor" strokeWidth="2.4" />
          </>
        ) : null}
        {arrow === 'curve-right' ? (
          <>
            <path d="M10 5c33 1 72 15 91 44" stroke="currentColor" strokeWidth="2.4" />
            <path d="m101 49-2-13m2 13-13-2" stroke="currentColor" strokeWidth="2.4" />
          </>
        ) : null}
        {arrow === 'loop-left' ? (
          <>
            <path
              d="M99 7C75-2 34 1 33 22c-1 17 29 21 42 7 8-9-1-19-14-13-17 8-31 23-45 37"
              stroke="currentColor"
              strokeWidth="2.4"
            />
            <path d="m16 53 3-13m-3 13 13-3" stroke="currentColor" strokeWidth="2.4" />
          </>
        ) : null}
      </svg>
    </div>
  );
}

function ChapterLabel({ number, children }: { number: string; children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="text-primary font-mono text-sm font-bold tracking-[0.18em]">{number}</span>
      <span className="bg-primary h-px w-10" aria-hidden="true" />
      <span className="text-muted-foreground text-sm font-semibold tracking-[0.12em] uppercase">
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
      className={`border-border bg-surface shadow-overlay overflow-hidden border ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className="block h-auto w-full"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      <figcaption className="sr-only">
        Écran réel de REZO360 avec données de démonstration.
      </figcaption>
    </figure>
  );
}

/**
 * Cinq scènes du quotidien, et ce qu'elles deviennent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'OBJECTION QUI N'ÉTAIT TRAITÉE NULLE PART
 *
 * La page expliquait très bien ce que fait REZO360. Elle ne répondait jamais à
 * la question que se pose vraiment un artisan devant un logiciel de gestion :
 * « pourquoi changer, puisque je m'en sors ? »
 *
 * C'est l'objection numéro un, et elle précède toutes les autres. Tant qu'elle
 * tient, aucune fonctionnalité ne convainc — elles ressemblent à des solutions
 * pour un problème qu'on n'a pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NE PAS MOQUER LA MÉTHODE ACTUELLE
 *
 * Le carnet, le tableur et WhatsApp ne sont pas des erreurs : ce sont des
 * outils qui MARCHENT, et qui ont porté l'entreprise jusqu'ici. Une page qui
 * les tourne en ridicule vexe exactement la personne qu'elle veut convaincre —
 * elle lui dit qu'elle travaille mal.
 *
 * La colonne de gauche décrit donc des situations, sans jugement. Ce qui les
 * disqualifie n'est pas leur bêtise, c'est leur coût : la même information
 * ressaisie trois fois, et la paperasse repoussée au dimanche.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DES SCÈNES, PAS DES FONCTIONNALITÉS
 *
 * « Gestion centralisée des documents » ne reconnaît personne. « Les photos du
 * chantier dorment dans une conversation WhatsApp » fait dire « c'est
 * exactement ça ». C'est cette reconnaissance qui fait lire la suite.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const SCENES_QUOTIDIEN = [
  {
    avant: 'L’intervention est notée sur un carnet, retapée dans un tableur, puis ressaisie une troisième fois pour la facture.',
    apres: 'Elle est saisie une fois sur le terrain, et suit d’elle-même jusqu’à la facture.',
  },
  {
    avant: 'Les photos du chantier dorment dans une conversation WhatsApp, introuvables six mois plus tard.',
    apres: 'Elles restent attachées à l’intervention, avec le compte rendu et la signature du client.',
  },
  {
    avant: '« Vous passez quand ? » — il faut appeler le technicien pour savoir où il en est.',
    apres: 'Le planning montre l’état de chaque mission, sans déranger personne.',
  },
  {
    avant: 'Le devis se refait de mémoire, et les prix varient d’un chantier à l’autre.',
    apres: 'Il reprend vos prestations déjà chiffrées, au même tarif qu’en janvier.',
  },
  {
    avant: 'Le dimanche soir passe dans la paperasse en retard.',
    apres: 'Le compte rendu part du chantier, avant même de remonter dans le camion.',
  },
] as const;

function MethodeActuelleSection() {
  return (
    <section className="bg-surface border-border border-y py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <ChapterLabel number="00">Avant de changer d’outil</ChapterLabel>
          <h2 className="text-foreground text-4xl leading-tight font-bold text-balance sm:text-5xl">
            Votre méthode actuelle fonctionne. C’est ce qu’elle vous coûte qui pose problème.
          </h2>
          <p className="text-muted-foreground mt-5 text-lg leading-relaxed">
            Le carnet, le tableur et les photos dans WhatsApp ont porté votre entreprise jusqu’ici.
            Ils ne tiennent plus dès que l’activité grossit — parce qu’ils font ressaisir la même
            information plusieurs fois, et repoussent le reste à plus tard.
          </p>
        </div>

        <div className="border-border mt-10 overflow-hidden rounded-2xl border sm:mt-14">
          {/* En-têtes de colonnes, sur écran large seulement : sur téléphone,
              chaque paire se lit de haut en bas et les intitulés répétés
              alourdiraient sans rien clarifier. */}
          <div className="border-border bg-surface-sunken hidden border-b sm:grid sm:grid-cols-2">
            <div className="text-muted-foreground px-5 py-3 font-mono text-xs font-bold tracking-widest uppercase">
              Aujourd’hui
            </div>
            <div className="border-border text-primary border-l px-5 py-3 font-mono text-xs font-bold tracking-widest uppercase">
              Avec REZO360
            </div>
          </div>

          <ul className="divide-border divide-y">
            {SCENES_QUOTIDIEN.map((scene) => (
              <li key={scene.avant} className="grid sm:grid-cols-2">
                <div className="text-muted-foreground flex gap-3 px-5 py-4 text-sm leading-relaxed">
                  <span
                    className="bg-muted-foreground/30 mt-2 size-1.5 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  {scene.avant}
                </div>
                <div className="border-border text-foreground bg-primary/[0.04] flex gap-3 border-t px-5 py-4 text-sm leading-relaxed font-medium sm:border-t-0 sm:border-l">
                  <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {scene.apres}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-muted-foreground mt-6 text-sm">
          Rien à réinstaller, rien à migrer le premier jour : vous commencez par une intervention, et
          vous voyez.
        </p>
      </div>
    </section>
  );
}

function InfrastructureSection() {
  return (
    <section
      id="infrastructure"
      aria-labelledby="infrastructure-title"
      className="relative overflow-hidden border-y border-blue-100/70 bg-gradient-to-b from-white via-blue-50/45 to-white py-14 sm:py-20"
    >
      <div
        className="absolute -top-32 -right-32 size-80 rounded-full bg-blue-100/45 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute top-24 -left-32 size-72 rounded-full bg-cyan-100/35 blur-3xl"
        aria-hidden="true"
      />
      <TechnicianSketch
        variant="network"
        className="top-14 left-4 hidden h-28 w-44 -rotate-6 text-cyan-700 opacity-30 xl:block"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2
            id="infrastructure-title"
            className="text-brand-night text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl"
          >
            Qui est{' '}
            <span className="from-primary bg-gradient-to-r to-blue-500 bg-clip-text text-transparent">
              derrière REZO360
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Une entreprise identifiée, des données localisées, des paiements confiés à Stripe. Rien
            de tout cela n’est à nous croire sur parole : chacun de ces points se vérifie.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-3 md:gap-6">
          <article className="shadow-raised grid grid-cols-[1fr_0.85fr] items-center gap-4 rounded-2xl border border-white/90 bg-white/90 px-5 py-5 text-left backdrop-blur-sm md:flex md:min-h-40 md:flex-col md:justify-center md:rounded-3xl md:px-6 md:py-6 md:text-center">
            <div
              className="text-brand-night flex items-center justify-start gap-3 md:justify-center"
              aria-label="Supabase"
            >
              <svg
                className="h-9 w-8 md:h-10 md:w-9"
                viewBox="0 0 40 48"
                role="img"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="supabase-mark-a"
                    x1="7"
                    y1="4"
                    x2="28"
                    y2="34"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#3ECF8E" />
                    <stop offset="1" stopColor="#1BAA73" />
                  </linearGradient>
                  <linearGradient
                    id="supabase-mark-b"
                    x1="18"
                    y1="17"
                    x2="35"
                    y2="43"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#7DE8BC" />
                    <stop offset="1" stopColor="#3ECF8E" />
                  </linearGradient>
                </defs>
                <path
                  d="M22.3 3.8c.9-2.1 4-1.5 4 .8v17.1H37c2.1 0 3.1 2.6 1.6 4.1L17.7 45.2c-1.5 1.4-3.9.3-3.6-1.8l2.3-17.1H3.1c-2.2 0-3.1-2.7-1.5-4.2L22.3 3.8Z"
                  fill="url(#supabase-mark-a)"
                />
                <path
                  d="M26.3 21.7H37c2.1 0 3.1 2.6 1.6 4.1L17.7 45.2c-1.5 1.4-3.9.3-3.6-1.8l12.2-21.7Z"
                  fill="url(#supabase-mark-b)"
                />
              </svg>
              <span className="text-xl font-bold tracking-tight md:text-3xl">supabase</span>
            </div>
            <p className="text-sm leading-5 text-slate-600 md:mt-4 md:max-w-64 md:text-[0.95rem] md:leading-6">
              Base de données sécurisée et évolutive
            </p>
          </article>

          <article className="shadow-raised grid grid-cols-[1fr_0.85fr] items-center gap-4 rounded-2xl border border-white/90 bg-white/90 px-5 py-5 text-left backdrop-blur-sm md:flex md:min-h-40 md:flex-col md:justify-center md:rounded-3xl md:px-6 md:py-6 md:text-center">
            <div
              className="flex items-center justify-start gap-3 text-black md:justify-center"
              aria-label="Vercel"
            >
              <svg className="size-8 md:size-9" viewBox="0 0 48 48" role="img" aria-hidden="true">
                <path d="M24 7 45 43H3L24 7Z" fill="currentColor" />
              </svg>
              <span className="text-2xl font-bold tracking-tight md:text-3xl">Vercel</span>
            </div>
            <p className="text-sm leading-5 text-slate-600 md:mt-4 md:max-w-64 md:text-[0.95rem] md:leading-6">
              Hébergement performant et fiable
            </p>
          </article>

          <article className="shadow-raised grid grid-cols-[1fr_0.85fr] items-center gap-4 rounded-2xl border border-white/90 bg-white/90 px-5 py-5 text-left backdrop-blur-sm md:flex md:min-h-40 md:flex-col md:justify-center md:rounded-3xl md:px-6 md:py-6 md:text-center">
            <div
              className="text-[2rem] leading-none font-bold tracking-[-0.06em] text-[#635BFF] md:text-[2.4rem]"
              aria-label="Stripe"
            >
              stripe
            </div>
            <p className="text-sm leading-5 text-slate-600 md:mt-4 md:max-w-64 md:text-[0.95rem] md:leading-6">
              Paiements traités de manière sécurisée
            </p>
          </article>
        </div>

        <div className="mt-8 grid gap-x-5 gap-y-6 border-t border-blue-100/80 pt-8 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4 lg:divide-x lg:divide-blue-100/90">
          {INFRASTRUCTURE_POINTS.map(({ title, detail, icon: Icon, iconClassName }) => (
            <div key={title} className="flex items-center gap-4 lg:px-5 first:lg:pl-0 last:lg:pr-0">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-brand-night text-sm font-bold sm:text-base">{title}</h3>
                <p className="mt-1 text-sm leading-snug text-slate-600">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-white">
        <DecorativeDoodle
          variant="sparkles"
          className="top-14 left-[45%] z-10 hidden size-14 rotate-6 stroke-orange-400 stroke-[2.2] opacity-75 xl:block"
        />
        <div className="absolute top-0 right-0 hidden aspect-video w-[74.5%] overflow-hidden lg:block xl:w-[74vw] xl:max-w-[79.5rem]">
          {/*
            DEUX PHOTOS, ET CE N'EST PAS UN OUBLI.

            Sur grand écran, le titre est du VRAI texte posé à gauche, sur un
            dégradé : la photo ne doit donc porter aucun mot, sinon ils se
            répondent en double. C'est le rôle de celle-ci.

            La version mobile, plus bas, porte au contraire le logo et
            l'accroche gravés — voir le commentaire qui l'accompagne.
          */}
          <picture>
            <source media="(min-width: 1024px)" srcSet="/images/landing-hero-4k.jpg" />
            <img
              src={PIXEL_VIDE}
              alt=""
              className="absolute inset-0 h-full w-full translate-x-3 object-cover"
              width="3840"
              height="2160"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
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
            {/*
              LA DOULEUR AVANT LA PROMESSE.

              La page ouvrait directement sur la solution. Le visiteur venu
              d'une publicité qui lui parlait de son problème — la ressaisie,
              les photos perdues, la paperasse du dimanche soir — devait faire
              lui-même le raccord entre ce qu'il venait de lire et ce qu'il
              découvrait. Beaucoup ne le font pas : ils repartent.

              Une seule phrase, interrogative, et volontairement CONCRÈTE. « Vos
              process sont-ils optimaux ? » ne reconnaît personne ; un carnet,
              WhatsApp et un dimanche soir, si. C'est la scène qu'il faut, pas
              le concept.

              Placée en amorce plutôt qu'en paragraphe : elle tient sur une
              ligne, ne repousse donc presque pas l'appel à l'action, et le
              titre juste en dessous y répond immédiatement.
            */}
            <p className="text-primary text-center text-sm font-semibold tracking-tight text-balance sm:text-base lg:text-left">
              Le devis sur un carnet, les photos dans WhatsApp, la facture le dimanche soir ?
            </p>

            <h1 className="text-brand-night mt-2 max-w-2xl text-center text-[2.5rem] leading-[1.08] font-bold tracking-tight text-balance sm:text-[3.125rem] lg:text-left lg:text-[3.5rem] lg:leading-[1.05]">
              Pilotez votre activité de terrain en toute simplicité
            </h1>

            <p className="text-muted-foreground mt-4 max-w-xl text-base leading-[1.55] sm:text-lg">
              REZO360 est la plateforme tout-en-un pour les entreprises, artisans et professionnels
              de terrain. De l’organisation des interventions à la facturation électronique,
              centralisez toute votre activité au même endroit.
            </p>

            <ul className="text-foreground mt-4 space-y-2.5 text-sm font-medium sm:text-base">
              {['Simple à prendre en main', 'Adapté à tous les métiers de terrain'].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="text-primary size-5 shrink-0" aria-hidden="true" />
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

            <p className="text-muted-foreground mt-3 text-xs sm:text-sm">
              Formule gratuite sans carte · 14 jours d’essai sur les offres payantes
            </p>
          </div>

          <div className="relative -mx-4 aspect-video w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] lg:hidden">
            {/*
              La version mobile porte le logo et l'accroche GRAVÉS dans
              l'image. Assumé : sur téléphone, la photo passe sous le bloc de
              texte, elle ne lui fait donc pas concurrence — elle prolonge le
              message au lieu de le doubler.

              Conséquence à connaître : ces mots-là ne sont ni traduisibles,
              ni lus par un lecteur d'écran, ni agrandis par les réglages
              d'accessibilité. D'où un `alt` qui les reprend intégralement —
              c'est le seul endroit où ils existent en texte.
            */}
            <picture>
              <source media="(max-width: 1023.98px)" srcSet="/images/landing-hero-v2.jpg" />
              <img
                src={PIXEL_VIDE}
                alt="REZO360 — Votre activité en mieux. Tout simplement. Un technicien devant son véhicule présente l’application sur son téléphone."
                className="absolute inset-0 h-full w-full object-cover"
                width="1672"
                height="941"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>
        </div>
      </section>

      <section aria-label="Engagements REZO360" className="border-border bg-surface border-y">
        <div className="divide-border mx-auto grid max-w-7xl divide-y px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:px-8">
          {REASSURANCES.map((item) => (
            <div key={item} className="flex min-h-16 items-center gap-3 px-3 py-4 lg:px-5">
              <CheckCircle2 className="text-primary size-5 shrink-0" aria-hidden="true" />
              <span className="text-foreground text-sm font-medium">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <ScrollRevealSection>
        <MethodeActuelleSection />
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="bg-brand-night relative overflow-hidden py-16 text-white sm:py-24">
          <DecorativeDoodle
            variant="zigzag"
            className="top-20 left-[45%] hidden size-16 -rotate-6 stroke-lime-300 stroke-[2.5] opacity-70 xl:block"
          />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-5">
                <div className="mb-5 flex items-center gap-3">
                  <span className="text-signal-lime font-mono text-sm font-bold tracking-[0.18em]">
                    01
                  </span>
                  <span className="bg-signal-lime h-px w-10" aria-hidden="true" />
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
                    <div
                      key={label}
                      className="flex items-center gap-2 text-sm font-medium text-white"
                    >
                      <Icon className="text-signal-cyan size-4" aria-hidden="true" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative mt-12 lg:mt-16">
              <HandwrittenAnnotation
                className="top-16 -right-28 w-32 rotate-3 min-[1400px]:block min-[1450px]:-right-40"
                tone="cyan"
                arrow="curve-left"
              >
                Vos priorités, d’un seul coup d’œil
              </HandwrittenAnnotation>
              <ProductCapture
                src="/images/product/dashboard.png"
                alt="Tableau de bord REZO360 montrant les priorités, indicateurs et missions récentes"
                eager
                className="border-white/15 bg-white"
              />
              <div className="text-brand-night shadow-modal mt-4 rounded-2xl border border-white/20 bg-white p-4 sm:absolute sm:right-6 sm:-bottom-8 sm:mt-0 sm:w-[22rem]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-primary font-mono text-xs font-bold">2026-0142</span>
                  <span className="bg-signal-lime rounded-full px-2.5 py-1 text-xs font-bold">
                    En cours
                  </span>
                </div>
                <p className="font-display mt-3 text-lg font-bold">Maintenance préventive CVC</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
                  <span>Site Horizon · 08:30</span>
                  <span className="text-primary font-medium">Mission active</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="relative overflow-hidden bg-gradient-to-br from-white via-blue-50/35 to-cyan-50/30 py-16 sm:py-24">
          <DecorativeDoodle
            variant="loop"
            className="top-16 right-[7%] hidden size-16 rotate-6 stroke-blue-300 stroke-[2] opacity-60 xl:block"
          />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <ChapterLabel number="02">Le parcours d’intervention</ChapterLabel>
              <h2 className="text-foreground text-4xl leading-tight font-bold text-balance sm:text-5xl">
                Une intervention, du planning au rapport signé.
              </h2>
              <p className="text-muted-foreground mt-5 text-lg leading-relaxed">
                Chaque étape reprend la même information. La mission planifiée devient une
                intervention suivie, puis un compte rendu contrôlé — sans rupture entre les écrans.
              </p>
            </div>

            <div className="mt-10 space-y-10 sm:mt-14 sm:space-y-16">
              <div className="grid items-center gap-8 lg:grid-cols-12">
                <div className="relative lg:col-span-8">
                  <ProductCapture
                    src="/images/product/missions.png"
                    alt="Liste réelle des missions REZO360 avec statuts, priorités et accès aux fiches"
                  />
                </div>
                <div className="relative lg:col-span-4">
                  <HandwrittenAnnotation
                    className="-top-64 left-0 w-52 -rotate-2 lg:block"
                    tone="orange"
                    arrow="loop-left"
                  >
                    Du bureau au terrain, sans ressaisie
                  </HandwrittenAnnotation>
                  <span className="text-signal-orange font-mono text-xs font-bold tracking-widest uppercase">
                    Planifier & affecter
                  </span>
                  <h3 className="text-foreground mt-3 text-2xl font-bold">
                    Le travail part avec un cadre clair.
                  </h3>
                  <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                    Référence, priorité, horaire, site et intervenant restent visibles avant même
                    d’ouvrir la fiche. Le planning et la carte sont accessibles depuis le même flux.
                  </p>
                </div>
              </div>

              <div className="grid items-center gap-8 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <span className="text-signal-orange font-mono text-xs font-bold tracking-widest uppercase">
                    Rendre compte
                  </span>
                  <h3 className="text-foreground mt-3 text-2xl font-bold">
                    Le terrain documente pendant que c’est frais.
                  </h3>
                  <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                    L’intervention ouverte mène au compte rendu complet, aux pièces jointes et aux
                    signatures. Le responsable retrouve ensuite la soumission dans sa file de
                    contrôle.
                  </p>
                  <ul className="text-foreground mt-5 space-y-3 text-sm">
                    {[
                      'Intervention en cours',
                      'Compte rendu structuré',
                      'Contrôle et validation',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="text-primary size-4" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lg:col-span-9">
                  <ProductCapture
                    src="/images/product/reports.png"
                    alt="Écran réel REZO360 de sélection d’une intervention et de rédaction du compte rendu"
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-center sm:mt-12">
              <Button asChild size="lg" className="min-h-touch px-6">
                <Link to={ROUTES.register}>
                  Essayer REZO360 gratuitement
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="relative overflow-hidden bg-gradient-to-bl from-slate-50 via-blue-50/45 to-white py-16 sm:py-24">
          <TechnicianSketch
            variant="electrical"
            className="bottom-9 left-[47%] hidden h-28 w-44 -rotate-3 text-blue-600 opacity-45 xl:block"
          />
          <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
            <div className="lg:col-span-7">
              <ChapterLabel number="03">La boîte à outils</ChapterLabel>
              <h2 className="text-foreground max-w-3xl text-4xl leading-tight font-bold text-balance sm:text-5xl">
                Les outils métier, comme une boîte à outils vivante.
              </h2>
              <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
                Des outils rapides pour le chantier, regroupés avec les calculateurs, conversions et
                notes que les techniciens utilisent au quotidien.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {TOOL_GROUPS.map(({ name, detail, icon: Icon }) => (
                  <div
                    key={name}
                    className="border-border bg-surface shadow-raised rounded-2xl border p-5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="bg-primary-subtle text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-foreground text-base font-bold">{name}</h3>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          {detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button asChild variant="outline" size="lg" className="min-h-touch mt-8">
                <Link to={ROUTES.tools}>
                  Explorer le catalogue
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="relative mx-auto w-full max-w-sm lg:col-span-5 lg:justify-self-end">
              <HandwrittenAnnotation
                className="-top-8 -left-36 w-40 -rotate-5 lg:block"
                tone="violet"
                arrow="curve-right"
              >
                Toute la boîte à outils dans la poche
              </HandwrittenAnnotation>
              <ProductCapture
                src="/images/product/tools-mobile.png"
                alt="Catalogue mobile réel des outils et instruments de terrain REZO360"
              />
            </div>
          </div>
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="bg-gradient-to-b from-white via-slate-50/60 to-blue-50/35 py-16 sm:py-24">
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <HandwrittenAnnotation
              className="-top-20 right-16 w-48 rotate-3 lg:block"
              tone="lime"
              arrow="curve-left"
            >
              Le chantier reste connecté
            </HandwrittenAnnotation>
            <div className="bg-brand-night relative min-h-[32rem] overflow-hidden rounded-3xl">
              {/*
                WebP et non PNG : la même image passe de 1 930 Ko à 97 Ko, soit
                95 % de moins, sans différence visible.

                Le PNG était le pire choix possible ici. Ce format est sans
                perte — pensé pour des aplats et des captures d'écran, pas pour
                une photographie de 1945 pixels de large, recouverte aux trois
                quarts par un dégradé sombre.

                Le PNG d'origine reste dans `public/images/backgrounds/` : plus
                aucun code ne le référence.
              */}
              <img
                src="/images/backgrounds/field-technician-industrial.webp"
                alt="Technicien de maintenance industrielle utilisant une tablette dans un local technique"
                className="absolute inset-0 h-full w-full object-cover object-[70%_center] sm:object-center"
                loading="lazy"
                decoding="async"
              />
              <div
                className="from-brand-night via-brand-night/90 to-brand-night/15 absolute inset-0 bg-gradient-to-r"
                aria-hidden="true"
              />
              <div className="relative flex min-h-[32rem] max-w-2xl flex-col justify-end p-7 text-white sm:p-12 lg:p-16">
                <span className="text-signal-cyan font-mono text-sm font-bold tracking-[0.16em] uppercase">
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
        <InfrastructureSection />
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
            <div className="bg-brand-night shadow-modal relative overflow-hidden rounded-3xl px-6 py-12 text-white sm:px-12 sm:py-16 lg:px-16">
              <div
                className="border-signal-cyan/20 absolute -top-20 -right-16 size-64 rounded-full border-[3rem]"
                aria-hidden="true"
              />
              <div
                className="absolute right-32 -bottom-24 size-56 rounded-full border-[2.5rem] border-white/10"
                aria-hidden="true"
              />
              <TechnicianSketch
                variant="measurement"
                className="right-12 bottom-10 hidden h-36 w-52 rotate-3 text-cyan-300 opacity-40 xl:block"
              />
              <div className="relative max-w-3xl">
                <span className="text-signal-lime font-mono text-sm font-bold tracking-[0.16em] uppercase">
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
                    className="min-h-touch border-signal-lime bg-signal-lime text-brand-night px-6 hover:border-white hover:bg-white"
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
                      <Icon className="text-signal-lime size-4" aria-hidden="true" />
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
