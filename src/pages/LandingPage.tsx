import { ArrowDown, ArrowRight, Check, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';

import { Faq } from '@/components/marketing/Faq';
import { ClosingScene } from '@/components/marketing/ClosingScene';
import { FieldFilm } from '@/components/marketing/FieldFilm';
import { FinanceNarrative, VoiceNarrative } from '@/components/marketing/LandingNarratives';
import { Pricing } from '@/components/marketing/Pricing';
import { ProductFrame } from '@/components/marketing/ProductFrame';
import { ROUTES } from '@/config/routes';

import '@/styles/landing-premium.css';
import '@/styles/landing-scenes.css';

const PRODUCT = '/images/product/premium/';
const JOURNEY = [
  { title: 'Planning', image: 'planning', detail: 'Une équipe. Le bon endroit. Le bon moment.' },
  {
    title: 'Intervention',
    image: 'missions',
    detail: 'Le contexte est déjà là. Le terrain peut avancer.',
  },
  { title: 'Compte rendu', image: 'report', detail: 'Le travail réalisé rejoint le dossier.' },
  { title: 'Facture', image: 'invoice', detail: 'La suite de l’intervention, au même endroit.' },
  { title: 'Paiement', image: 'payment', detail: 'Une vue claire, jusqu’au dernier règlement.' },
] as const;

function useLandingSeo() {
  useEffect(() => {
    const previous = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previousHref = previous?.href;
    const canonical = previous ?? document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = 'https://rezo360.com/';
    if (!previous) document.head.append(canonical);
    return () => {
      if (!previous) canonical.remove();
      else if (previousHref) canonical.href = previousHref;
    };
  }, []);
}

/** One observer for the page; content remains present when JavaScript or motion is unavailable. */
function useReveals() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches || !('IntersectionObserver' in window)) return;
    const elements = root.current?.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08 },
    );
    elements?.forEach((element) => {
      element.classList.add('will-reveal');
      observer.observe(element);
    });
    const showAll = () => elements?.forEach((element) => element.classList.add('is-revealed'));
    media.addEventListener('change', showAll);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', showAll);
    };
  }, []);
  return root;
}

function Cta({
  children = 'Essayer gratuitement',
  light = false,
}: {
  children?: ReactNode;
  light?: boolean;
}) {
  return (
    <Link className={light ? 'lp-cta lp-cta--light' : 'lp-cta'} to={ROUTES.register}>
      {children}
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="lp-eyebrow">{children}</p>;
}

function Phone({ className = '', priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={`lp-phone ${className}`}>
      <img
        src={`${PRODUCT}mobile.webp`}
        width="390"
        height="844"
        alt="Une mission dans la véritable application mobile REZO360"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  );
}

function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="lp-title">
      <div className="lp-container lp-hero-copy">
        <Eyebrow>Le terrain. Le bureau. Enfin réunis.</Eyebrow>
        <h1 id="lp-title">
          Votre activité en mieux. <br />
          <span>Tout simplement.</span>
        </h1>
        <p className="lp-hero-lead">
          Clients, équipes, interventions et factures.
          <br className="lp-desktop-break" /> Toute l’activité de votre entreprise de terrain, au
          même endroit.
        </p>
        <div className="lp-actions">
          <Cta />
          <a className="lp-text-link" href="#produit">
            Voir REZO360 en action
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
        <p className="lp-hero-note">Un compte gratuit pour découvrir. Aucun engagement.</p>
      </div>
    </section>
  );
}

function ProductIntro() {
  return (
    <section className="lp-product-intro" aria-label="REZO360, du bureau au terrain">
      <div className="lp-hero-stage">
        <img
          className="lp-hero-atmosphere"
          src="/images/landing/hero-light.webp"
          alt=""
          width="1600"
          height="905"
          loading="lazy"
          fetchPriority="low"
          decoding="async"
        />
        <div className="lp-hero-product" data-reveal>
          <ProductFrame
            src={`${PRODUCT}dashboard.webp`}
            alt="Le véritable tableau de bord REZO360 : activité, missions et suivi de l’équipe"
            label="Votre activité, en un regard"
            width={1440}
            height={960}
          />
          <Phone className="lp-hero-phone" />
        </div>
        <div className="lp-hero-caption">
          <span>GESTION</span>
          <i />
          <span>WORKSPACE</span>
          <i />
          <span>FINANCE</span>
        </div>
      </div>
      <p className="lp-demo-note">Interfaces réelles de REZO360 · Données de démonstration</p>
    </section>
  );
}

function ProductSequence() {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [scrollLinked, setScrollLinked] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(
      '(min-width: 1024px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)',
    );
    const updateMode = () => setScrollLinked(media.matches);
    updateMode();
    media.addEventListener('change', updateMode);
    return () => media.removeEventListener('change', updateMode);
  }, []);
  useEffect(() => {
    if (!scrollLinked || !('IntersectionObserver' in window)) return;
    let frame = 0;
    let visible = false;
    const update = () => {
      frame = 0;
      const element = section.current;
      if (!element || !visible) return;
      const rect = element.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(0.999, (100 - rect.top) / (rect.height - window.innerHeight)),
      );
      setActive(Math.floor(progress * JOURNEY.length));
    };
    const schedule = () => {
      if (!frame && visible) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      schedule();
    });
    if (section.current) observer.observe(section.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [scrollLinked]);

  function select(index: number) {
    setActive(index);
    if (scrollLinked && section.current) {
      const start = section.current.getBoundingClientRect().top + window.scrollY;
      const travel = section.current.offsetHeight - window.innerHeight;
      window.scrollTo({
        top: start - 100 + ((index + 0.25) / JOURNEY.length) * travel,
        behavior: 'instant',
      });
    }
  }

  return (
    <section
      id="produit"
      ref={section}
      className={scrollLinked ? 'lp-sequence lp-sequence--scroll' : 'lp-sequence'}
      aria-labelledby="lp-sequence-title"
    >
      <div className="lp-sequence-sticky lp-container">
        <div className="lp-sequence-heading">
          <h2 id="lp-sequence-title">Tout s’enchaîne.</h2>
          <p>
            Un dossier qui vous suit.
            <br />
            Du premier rendez-vous au paiement.
          </p>
        </div>
        <div className="lp-sequence-nav" aria-label="Étapes du produit">
          {JOURNEY.map((step, index) => (
            <button
              key={step.title}
              type="button"
              aria-pressed={active === index}
              aria-controls="lp-sequence-screen"
              onClick={() => select(index)}
            >
              <span>0{index + 1}</span>
              {step.title}
            </button>
          ))}
        </div>
        <div id="lp-sequence-screen" className="lp-sequence-screen" aria-live="off">
          {JOURNEY.map((step, index) => (
            <div
              key={step.image}
              className={active === index ? 'lp-sequence-layer is-active' : 'lp-sequence-layer'}
              aria-hidden={active !== index}
            >
              <ProductFrame
                src={`${PRODUCT}${step.image}.webp`}
                alt={`Interface réelle REZO360 — ${step.title}`}
                label={step.title}
                width={1440}
                height={960}
              />
            </div>
          ))}
        </div>
        <div className="lp-sequence-caption">
          <p>{JOURNEY[active]?.detail}</p>
          <span>{String(active + 1).padStart(2, '0')} / 05</span>
        </div>
        <div className="lp-sequence-mobile-controls">
          <button
            type="button"
            onClick={() => select(Math.max(0, active - 1))}
            disabled={active === 0}
            aria-label="Écran précédent"
          >
            <ChevronLeft />
          </button>
          <span>Explorez les vrais écrans</span>
          <button
            type="button"
            onClick={() => select(Math.min(4, active + 1))}
            disabled={active === 4}
            aria-label="Écran suivant"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </section>
  );
}

function FieldSection() {
  return (
    <section className="lp-field" aria-labelledby="lp-field-title">
      <div className="lp-container lp-editorial-heading" data-reveal>
        <div>
          <Eyebrow>Le logiciel suit le métier</Eyebrow>
          <h2 id="lp-field-title">
            Tout commence
            <br />
            <span className="lp-muted">sur le terrain.</span>
          </h2>
        </div>
        <p>
          Un site, une équipe, un travail à réaliser.
          <br />
          REZO360 garde le contexte à portée de main.
        </p>
      </div>
      <figure className="lp-field-photo" data-reveal>
        <div className="lp-field-art">
          <img
            src="/images/landing/field-work.webp"
            srcSet="/images/landing/field-work-small.webp 800w, /images/landing/field-work.webp 1800w"
            sizes="(max-width: 640px) 100vw, 92vw"
            width="1800"
            height="1195"
            alt="Une professionnelle consulte sa mission REZO360 sur son smartphone dans un local technique"
            loading="lazy"
            decoding="async"
          />
          <div className="lp-field-screen" aria-hidden="true">
            <img
              src={`${PRODUCT}mobile.webp`}
              width="390"
              height="844"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
        <figcaption>La bonne information. Là où le travail se fait.</figcaption>
      </figure>
    </section>
  );
}

const UNIVERSES = [
  {
    number: '01',
    title: 'Gestion',
    subtitle: 'Une vue d’ensemble.\nDes équipes qui avancent.',
    description: 'Du client au compte rendu signé, retrouvez le contexte de chaque intervention.',
    image: 'planning',
    detail: ['Clients & sites', 'Équipes & planning', 'Missions & rapports'],
    id: 'gestion',
  },
  {
    number: '02',
    title: 'Workspace',
    subtitle: 'Le savoir de l’équipe.\nÀ sa place.',
    description:
      'Pages, notes, tâches et documents restent proches du travail qu’ils accompagnent.',
    image: 'workspace',
    detail: ['Pages & tâches', 'Documents', 'Bibliothèque technique'],
    id: 'workspace',
  },
  {
    number: '03',
    title: 'Finance',
    subtitle: 'Le travail est fait.\nLa suite est claire.',
    description: 'Devis, factures, paiements et relances partagent le même fil client.',
    image: 'quotes',
    detail: ['Devis', 'Factures & paiements', 'Relances'],
    id: 'finance-univers',
  },
] as const;

function Universes() {
  return (
    <section id="univers" className="lp-universes" aria-labelledby="lp-universes-title">
      <div className="lp-container lp-universes-intro" data-reveal>
        <Eyebrow>Trois univers. Un même quotidien.</Eyebrow>
        <h2 id="lp-universes-title">
          Toute votre entreprise.
          <br />
          <span className="lp-muted">Sans changer de rythme.</span>
        </h2>
      </div>
      {UNIVERSES.map((universe) => (
        <article
          id={universe.id}
          className={`lp-universe lp-universe--${universe.id}`}
          key={universe.id}
        >
          <div className="lp-container">
            <div className="lp-universe-heading" data-reveal>
              <span className="lp-universe-number">{universe.number}</span>
              <h3>{universe.title}</h3>
              <p>{universe.subtitle}</p>
            </div>
            <div className="lp-universe-body">
              <div className="lp-universe-copy" data-reveal>
                <p>{universe.description}</p>
                <ul>
                  {universe.detail.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link to={ROUTES.features} className="lp-text-link">
                  Explorer les fonctionnalités
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
              <div className="lp-universe-visual" data-reveal>
                <ProductFrame
                  src={`${PRODUCT}${universe.image}.webp`}
                  alt={`Véritable espace ${universe.title} de REZO360`}
                  label={`REZO360 · ${universe.title}`}
                  width={1440}
                  height={960}
                />
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

const WORKFLOW = [
  ['Client', 'Le contexte est posé.'],
  ['Devis', 'La proposition prend forme.'],
  ['Planning', 'L’équipe sait où aller.'],
  ['Intervention', 'Le terrain enrichit le dossier.'],
  ['Rapport signé', 'Le travail est documenté.'],
  ['Facture', 'Les informations sont réunies.'],
  ['Paiement', 'Le suivi se poursuit.'],
] as const;

function Workflow() {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        });
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0 },
    );
    steps.current.forEach((step) => {
      if (step) observer.observe(step);
    });
    return () => observer.disconnect();
  }, []);
  return (
    <section className="lp-workflow" aria-labelledby="lp-workflow-title">
      <div className="lp-container lp-workflow-grid">
        <div className="lp-workflow-copy">
          <Eyebrow>Un dossier. Du début à la fin.</Eyebrow>
          <h2 id="lp-workflow-title">
            L’information
            <br />
            avance avec vous.
          </h2>
          <p>
            Le client, le site, les documents.
            <br />
            Gardez le fil, à chaque étape.
          </p>
          <div className="lp-dossier" aria-hidden="true">
            <span>DOSSIER DE DÉMONSTRATION</span>
            <strong>Maintenance · Les Alizés</strong>
            <div>
              <i />
              {WORKFLOW[active]?.[0]}
            </div>
            <small>Le même contexte, toujours disponible.</small>
          </div>
        </div>
        <ol className="lp-workflow-steps">
          {WORKFLOW.map(([title, detail], index) => (
            <li
              ref={(node) => {
                steps.current[index] = node;
              }}
              data-step={index}
              key={title}
              className={index <= active ? 'is-passed' : ''}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
              <Check aria-hidden="true" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function WorkspaceSection() {
  return (
    <section className="lp-workspace" aria-labelledby="lp-workspace-title">
      <div className="lp-container">
        <div className="lp-workspace-title" data-reveal>
          <Eyebrow>Un espace pour ce que vous savez</Eyebrow>
          <h2 id="lp-workspace-title">
            Les idées passent.
            <br />
            <span className="lp-muted">Le savoir reste.</span>
          </h2>
          <p>
            Une consigne, une page de chantier, une documentation.
            <br />
            La bonne ressource n’est jamais loin.
          </p>
        </div>
        <figure className="lp-workspace-photo" data-reveal>
          <img
            src="/images/landing/workspace-team-1800.webp"
            srcSet="/images/landing/workspace-team-800.webp 800w, /images/landing/workspace-team-1800.webp 1800w"
            sizes="(max-width: 640px) 100vw, 90vw"
            width="1800"
            height="1013"
            loading="lazy"
            decoding="async"
            alt="Deux professionnels réunissent leurs plans et documents dans un atelier"
          />
          <figcaption>Les bonnes idées se construisent ensemble.</figcaption>
        </figure>
        <div className="lp-workspace-composition" data-reveal>
          <ProductFrame
            src={`${PRODUCT}workspace.webp`}
            alt="Une page de préparation de chantier dans le véritable éditeur Workspace REZO360"
            label="Workspace · Pages de l’équipe"
            width={1440}
            height={960}
          />
          <div className="lp-library-inset">
            <ProductFrame
              src={`${PRODUCT}library.webp`}
              alt="La bibliothèque technique REZO360 avec dossiers et documents"
              label="Bibliothèque technique"
              width={1440}
              height={960}
            />
          </div>
        </div>
        <div className="lp-workspace-labels">
          <span>Pages</span>
          <span>Tâches</span>
          <span>Documents</span>
          <span>Bibliothèque</span>
        </div>
      </div>
    </section>
  );
}

function MobileSection() {
  const stage = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !('IntersectionObserver' in window)) return;
    if (!stage.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMobile(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  return (
    <section className="lp-mobile" aria-labelledby="lp-mobile-title">
      <div className="lp-container lp-mobile-grid">
        <div className="lp-mobile-copy" data-reveal>
          <Eyebrow>Le bureau tient dans la poche</Eyebrow>
          <h2 id="lp-mobile-title">
            Même dossier.
            <br />
            <span className="lp-muted">Autre point de vue.</span>
          </h2>
          <p>
            Consultez une mission, ajoutez vos informations et retrouvez vos documents depuis votre
            smartphone.
          </p>
          <p className="lp-mobile-install">
            <Smartphone aria-hidden="true" />
            Une application web installable sur Android et iPhone.
          </p>
          <Cta />
        </div>
        <div
          ref={stage}
          className={mobile ? 'lp-mobile-transform is-mobile' : 'lp-mobile-transform'}
        >
          <div className="lp-mobile-desktop">
            <ProductFrame
              src={`${PRODUCT}missions.webp`}
              alt="Vue des missions REZO360 sur ordinateur"
              label="Au bureau"
              width={1440}
              height={960}
            />
          </div>
          <Phone className="lp-mobile-phone" />
          <span className="lp-mobile-caption">Du bureau au terrain.</span>
        </div>
      </div>
    </section>
  );
}

function Proofs() {
  return (
    <section className="lp-proofs" aria-labelledby="lp-proofs-title">
      <div className="lp-container">
        <div data-reveal>
          <Eyebrow>Du concret, dès le départ</Eyebrow>
          <h2 id="lp-proofs-title">
            Un outil de travail.
            <br />
            Des bases claires.
          </h2>
        </div>
        <div className="lp-proof-list">
          <div>
            <strong>Un produit, trois univers</strong>
            <p>Gestion, Workspace et Finance dans la même application.</p>
          </div>
          <div>
            <strong>Web et mobile</strong>
            <p>Un accès depuis votre navigateur. Une application installable.</p>
          </div>
          <div>
            <strong>Des tarifs affichés</strong>
            <p>Une facturation mensuelle et des utilisateurs inclus dans chaque formule.</p>
          </div>
          <div>
            <strong>Vos documents, disponibles</strong>
            <p>Comptes rendus et exports pour prolonger le travail hors de REZO360.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="dernier-geste" className="lp-final" aria-labelledby="lp-final-title">
      <ClosingScene />
      <div className="lp-container">
        <Eyebrow>Et si tout devenait plus simple ?</Eyebrow>
        <h2 id="lp-final-title">
          Votre activité
          <br />
          en mieux.
          <br />
          <span>Tout simplement.</span>
        </h2>
        <Cta light>Essayer REZO360</Cta>
        <p>Votre prochain espace de travail commence ici.</p>
        <span className="lp-final-wordmark" aria-hidden="true">
          REZO360
        </span>
      </div>
    </section>
  );
}

export default function LandingPage() {
  useLandingSeo();
  const root = useReveals();
  return (
    <div className="landing-premium" ref={root} style={{ '--lp-blue': '#1b44c8' } as CSSProperties}>
      <Hero />
      <FieldFilm />
      <ProductIntro />
      <ProductSequence />
      <FieldSection />
      <Universes />
      <Workflow />
      <WorkspaceSection />
      <VoiceNarrative />
      <MobileSection />
      <FinanceNarrative />
      <Proofs />
      <Pricing />
      <Faq />
      <FinalCta />
    </div>
  );
}
