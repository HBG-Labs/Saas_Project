import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Expand, Smartphone } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { DownloadAppModal } from '@/components/layout/DownloadAppModal';
import { ClosingScene } from '@/components/marketing/ClosingScene';
import { Faq } from '@/components/marketing/Faq';
import { FieldFilm } from '@/components/marketing/FieldFilm';
import { VoiceNarrative } from '@/components/marketing/LandingNarratives';
import { Pricing } from '@/components/marketing/Pricing';
import { ProductFrame } from '@/components/marketing/ProductFrame';
import { ROUTES } from '@/config/routes';
import { trackLandingAction } from '@/lib/meta-pixel';

import '@/styles/landing-premium.css';
import '@/styles/landing-scenes.css';
import '@/styles/landing-conversion.css';

const PRODUCT = '/images/product/premium/';
const JOURNEY = [
  {
    title: 'Planning',
    image: 'planning',
    mobile: 'mobile-planning',
    crop: 'planning',
    action: 'Préparer la journée',
    detail: 'Retrouvez les missions, les équipes et les créneaux dans le planning.',
  },
  {
    title: 'Intervention',
    image: 'mobile',
    mobile: 'mobile',
    crop: 'phone',
    action: 'Intervenir avec le bon contexte',
    detail: 'Sur le site, consultez la mission et complétez le dossier depuis votre téléphone.',
  },
  {
    title: 'Compte rendu',
    image: 'report',
    mobile: '',
    crop: 'report',
    action: 'Garder une trace du travail',
    detail:
      'Renseignez les travaux et observations avant la signature et le contrôle du compte rendu.',
  },
  {
    title: 'Facture',
    image: 'invoice',
    mobile: '',
    crop: 'invoice',
    action: 'Préparer la facturation',
    detail: 'Retrouvez le client, les prestations et les montants dans votre facture.',
  },
  {
    title: 'Paiement',
    image: 'payment',
    mobile: '',
    crop: 'invoice',
    action: 'Suivre le règlement',
    detail: 'Consultez les paiements enregistrés. Les validations restent sous votre contrôle.',
  },
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

function useReveals() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !('IntersectionObserver' in window)) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;
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
  children = 'Créer mon compte gratuit',
  light = false,
  placement,
}: {
  children?: ReactNode;
  light?: boolean;
  placement: string;
}) {
  return (
    <Link
      className={light ? 'lp-cta lp-cta--light' : 'lp-cta'}
      to={ROUTES.register}
      onClick={() => trackLandingAction('signup', placement)}
    >
      {children}
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="lp-title">
      <div className="lp-container lp-hero-copy">
        <p className="lp-eyebrow">Le logiciel des entreprises de terrain</p>
        <h1 id="lp-title">
          Votre activité en mieux. <br />
          <span>Tout simplement.</span>
        </h1>
        <p className="lp-hero-lead">
          Planifiez vos interventions. Retrouvez vos dossiers.
          <br className="lp-desktop-break" /> Préparez vos comptes rendus, devis et factures au même
          endroit.
        </p>
        <div className="lp-actions">
          <Cta placement="hero" />
          <a
            className="lp-text-link"
            href="#produit"
            onClick={() => trackLandingAction('explore', 'hero')}
          >
            Explorer les écrans
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
        <p className="lp-hero-note">
          Compte Free sans carte, pour les outils techniques.
          <br className="lp-mobile-break" /> Gestion d’interventions dès Starter.{' '}
          <a href="#tarifs">Voir les offres et l’essai de 14 jours.</a>
        </p>
      </div>
      <div className="lp-product-intro" aria-label="REZO360, du bureau au terrain">
        <div className="lp-hero-stage">
          <img
            className="lp-hero-atmosphere"
            src="/images/landing/hero-light.webp"
            alt=""
            width="1600"
            height="905"
            loading="lazy"
            decoding="async"
          />
          <div className="lp-hero-product">
            <ProductFrame
              src={PRODUCT + 'dashboard.webp'}
              alt="Tableau de bord réel REZO360 : missions, équipes et comptes rendus à valider"
              label="Votre activité, en un regard"
              priority
            />
            <div className="lp-phone lp-hero-phone">
              <img
                src={PRODUCT + 'mobile.webp'}
                width="390"
                height="844"
                alt="Une intervention REZO360 sur smartphone"
                decoding="async"
              />
            </div>
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
      </div>
    </section>
  );
}

function ProductSequence() {
  const [active, setActive] = useState(0);
  const step = JOURNEY[active]!;
  function select(index: number) {
    setActive(index);
    trackLandingAction('product_step', JOURNEY[index]!.image);
  }
  return (
    <section id="produit" className="lp-journey" aria-labelledby="lp-sequence-title">
      <div className="lp-container">
        <div className="lp-journey-heading" data-reveal>
          <div>
            <p className="lp-eyebrow">Du bureau au terrain, puis au règlement</p>
            <h2 id="lp-sequence-title">
              Gardez le fil.
              <br />
              <span className="lp-muted">À chaque étape.</span>
            </h2>
          </div>
          <p>
            Une intervention de maintenance, du planning au suivi financier. Explorez les vrais
            écrans, à votre rythme.
          </p>
        </div>
        <div className="lp-journey-layout">
          <div className="lp-journey-navigation">
            <p className="lp-journey-case">
              PARCOURS DE DÉMONSTRATION
              <br />
              <strong>Maintenance · Atelier Horizon</strong>
            </p>
            <div className="lp-journey-steps" aria-label="Étapes du produit">
              {JOURNEY.map((item, index) => (
                <button
                  key={item.image}
                  type="button"
                  aria-label={`${String(index + 1).padStart(2, '0')} ${item.title}`}
                  aria-pressed={index === active}
                  aria-controls="lp-sequence-screen"
                  onClick={() => select(index)}
                >
                  <span>0{index + 1}</span>
                  {item.title}
                  <ArrowRight aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="lp-journey-scope">
              Captures de démonstration. Le passage d’une étape à l’autre illustre le parcours, pas
              une automatisation.
            </p>
          </div>
          <div className="lp-journey-display">
            <div
              id="lp-sequence-screen"
              className={'lp-journey-shot lp-journey-shot--' + step.crop}
            >
              <ProductFrame
                key={step.image}
                src={PRODUCT + step.image + '.webp'}
                mobileSrc={step.mobile ? PRODUCT + step.mobile + '.webp' : undefined}
                alt={'Interface réelle REZO360 — ' + step.title}
                label={step.title}
                width={step.image === 'mobile' ? 390 : 1440}
                height={step.image === 'mobile' ? 844 : 960}
              />
            </div>
            <div className="lp-journey-caption" aria-live="polite" aria-atomic="true">
              <h3>{step.action}</h3>
              <p>{step.detail}</p>
            </div>
            <div className="lp-journey-controls">
              <button
                type="button"
                onClick={() => select(Math.max(0, active - 1))}
                disabled={active === 0}
                aria-label="Écran précédent"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <span>
                {active + 1} / {JOURNEY.length}
              </span>
              <button
                type="button"
                onClick={() => select(Math.min(JOURNEY.length - 1, active + 1))}
                disabled={active === JOURNEY.length - 1}
                aria-label="Écran suivant"
              >
                <ChevronRight aria-hidden="true" />
              </button>
              <Dialog.Root>
                <Dialog.Trigger className="lp-enlarge">
                  <Expand aria-hidden="true" />
                  Agrandir l’écran
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="lp-screen-overlay" />
                  <Dialog.Content className="lp-screen-dialog">
                    <div className="lp-screen-dialog-heading">
                      <Dialog.Title>{step.title} · REZO360</Dialog.Title>
                      <Dialog.Close aria-label="Fermer l’aperçu">Fermer</Dialog.Close>
                    </div>
                    <Dialog.Description>
                      Capture réelle, avec des données de démonstration. Faites défiler pour
                      explorer l’écran complet.
                    </Dialog.Description>
                    {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the explicitly scrollable screenshot. */}
                    <div
                      className="lp-screen-dialog-image"
                      tabIndex={0}
                      role="region"
                      aria-label="Capture agrandie"
                    >
                      <img
                        src={PRODUCT + step.image + '.webp'}
                        alt={'Écran complet : ' + step.title}
                        width={step.image === 'mobile' ? 390 : 1440}
                        height={step.image === 'mobile' ? 844 : 960}
                      />
                    </div>
                    {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          </div>
        </div>
        <div className="lp-journey-conversion">
          <p>
            Votre prochain dossier commence ici.
            <span>Créez votre compte, puis choisissez votre formule.</span>
          </p>
          <Cta placement="journey" />
        </div>
      </div>
    </section>
  );
}

function FieldExperience() {
  const [install, setInstall] = useState(false);
  return (
    <div className="lp-field-experience">
      <FieldFilm />
      <div className="lp-field-companion lp-container">
        <Smartphone aria-hidden="true" />
        <div>
          <h3>Le même dossier, aussi sur mobile.</h3>
          <p>
            Consultez la mission, ajoutez vos informations et retrouvez vos documents sur Android et
            iPhone.
          </p>
        </div>
        <button className="lp-text-link" onClick={() => setInstall(true)} type="button">
          Installer l’application
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
      <DownloadAppModal isOpen={install} onClose={() => setInstall(false)} />
    </div>
  );
}

const UNIVERSES = [
  {
    id: 'gestion',
    title: 'Gestion',
    image: 'planning',
    heading: 'Organisez le travail de l’équipe.',
    description:
      'Clients, sites, planning et interventions : préparez la journée et retrouvez le contexte de chaque mission.',
    detail: 'Clients & sites · Équipes · Missions & rapports',
  },
  {
    id: 'workspace',
    title: 'Workspace',
    image: 'workspace',
    heading: 'Retrouvez ce que votre équipe sait.',
    description:
      'Réunissez pages, tâches et documents. Gardez les procédures et la bibliothèque technique à portée de main.',
    detail: 'Pages & tâches · Documents · Bibliothèque technique',
  },
  {
    id: 'finance',
    title: 'Finance',
    image: 'quotes',
    heading: 'Suivez le travail jusqu’au règlement.',
    description:
      'Préparez les devis et factures, consultez les paiements et organisez les relances dans votre espace Finance.',
    detail: 'Devis · Factures & paiements · Relances',
  },
] as const;

function Universes() {
  const [active, setActive] = useState(0);
  const universe = UNIVERSES[active]!;
  return (
    <section id="univers" className="lp-universes-compact" aria-labelledby="lp-universes-title">
      <div className="lp-container">
        <div className="lp-universes-intro" data-reveal>
          <p className="lp-eyebrow">Un rôle clair pour chaque espace</p>
          <h2 id="lp-universes-title">
            Trois univers.
            <br />
            Une activité réunie.
          </h2>
        </div>
        <div className="lp-universe-switch" aria-label="Explorer les trois univers">
          {UNIVERSES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`${String(index + 1).padStart(2, '0')} ${item.title}`}
              aria-pressed={active === index}
              aria-controls="lp-universe-panel"
              onClick={() => {
                setActive(index);
                trackLandingAction('universe', item.id);
              }}
            >
              <span>0{index + 1}</span>
              {item.title}
            </button>
          ))}
        </div>
        <div
          id="lp-universe-panel"
          className={'lp-universe-panel lp-universe-panel--' + universe.id}
        >
          <div className="lp-universe-summary">
            <h3>{universe.heading}</h3>
            <p>{universe.description}</p>
            <p className="lp-universe-detail">{universe.detail}</p>
            <Link to={ROUTES.features} className="lp-text-link">
              Toutes les fonctionnalités
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <ProductFrame
            src={PRODUCT + universe.image + '.webp'}
            alt={'Véritable espace ' + universe.title + ' de REZO360'}
            label={universe.title}
          />
        </div>
      </div>
    </section>
  );
}

function Proofs() {
  return (
    <section className="lp-evidence" aria-labelledby="lp-proofs-title">
      <div className="lp-container lp-evidence-grid">
        <div data-reveal>
          <p className="lp-eyebrow">Avant de vous engager</p>
          <h2 id="lp-proofs-title">
            Du concret.
            <br />À vérifier vous-même.
          </h2>
          <p>
            Explorez le produit, comparez les fonctions et posez vos questions. Les données des
            aperçus sont des exemples, pas des témoignages clients.
          </p>
        </div>
        <div className="lp-evidence-links">
          <a href={PRODUCT + 'report.webp'} target="_blank" rel="noreferrer">
            <span>01</span>
            <div>
              <h3>Regardez un vrai écran de compte rendu</h3>
              <p>
                Travaux réalisés, observations et documents. Capture de démonstration, dans un
                nouvel onglet.
              </p>
            </div>
            <ArrowRight aria-hidden="true" />
          </a>
          <Link to={ROUTES.pricing}>
            <span>02</span>
            <div>
              <h3>Calculez le prix de votre équipe</h3>
              <p>Le simulateur inclut les utilisateurs et les sièges supplémentaires.</p>
            </div>
            <ArrowRight aria-hidden="true" />
          </Link>
          <a href="mailto:contact@rezo360.fr">
            <span>03</span>
            <div>
              <h3>Posez-nous vos questions</h3>
              <p>contact@rezo360.fr · Pour parler de votre activité et de vos besoins.</p>
            </div>
            <ArrowRight aria-hidden="true" />
          </a>
          <Link to={ROUTES.privacy} className="lp-evidence-privacy">
            Consulter la politique de confidentialité
            <ArrowRight aria-hidden="true" />
          </Link>
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
        <p className="lp-eyebrow">Prêt pour votre prochain dossier ?</p>
        <h2 id="lp-final-title">
          Votre activité en mieux.
          <br />
          <span>Tout simplement.</span>
        </h2>
        <Cta light placement="closing" />
        <p>Compte Free sans carte. Essai d’une offre payante à activer ensuite, avec carte.</p>
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
    <div className="landing-premium landing-conversion" ref={root}>
      <Hero />
      <ProductSequence />
      <FieldExperience />
      <VoiceNarrative />
      <Universes />
      <Proofs />
      <Pricing />
      <Faq />
      <FinalCta />
    </div>
  );
}
