import { Menu, Smartphone, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { ThemeToggle } from '@/features/theme';
import { cn } from '@/lib/cn';

import { DownloadAppModal } from './DownloadAppModal';
import { Logo } from './Logo';

/** Vitrine et tunnel d'inscription : voir le commentaire dans `PublicLayout`. */
const PAGES_EN_CLAIR: readonly string[] = [
  ROUTES.home,
  ROUTES.login,
  ROUTES.register,
  ROUTES.forgotPassword,
];

const MARKETING_LINKS = [
  { to: ROUTES.features, label: 'Fonctionnalités' },
  { to: ROUTES.tools, label: 'Outils' },
  { to: ROUTES.tutorials, label: 'Tutoriels' },
  { to: ROUTES.pricing, label: 'Tarifs' },
  { to: ROUTES.faq, label: 'FAQ' },
] as const;

/**
 * Coque des pages publiques.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN SEUL CHEMIN DE STYLE
 *
 * Ce composant portait un drapeau `isLandingPage` et, avec lui, deux jeux de
 * styles complets menés en parallèle : douze ternaires du type
 * `isLandingPage ? 'text-slate-300 hover:text-cyan-300' : 'text-slate-600 …'`.
 * L'accueil était en couleurs codées en dur, les autres pages en `slate` avec
 * variantes `dark:`. Aucun des deux ne passait par les jetons du produit.
 *
 * Il forçait en plus `document.documentElement.classList.add('dark')` sur `/` :
 * l'accueil était verrouillé en sombre quel que soit le choix de la personne,
 * et masquait même la bascule de thème pour que le verrou ne se voie pas.
 *
 * Tout passe désormais par les mêmes jetons que l'application. L'accueil suit
 * le thème comme le reste, la bascule est visible partout, et une seule série
 * de classes décrit chaque élément.
 *
 * CE QUE ÇA CORRIGE AU PASSAGE
 *
 * Sur l'accueil, « Connexion » et « Commencer gratuitement » étaient de simples
 * liens texte — la branche `isLandingPage` remplaçait les `<Button>` par des
 * `<Link>` sans surface. L'appel à l'action principal du site n'avait donc
 * l'air de rien. Ce sont maintenant de vrais boutons, partout.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  /*
    LA VITRINE ET LE TUNNEL D'INSCRIPTION RESTENT EN CLAIR.

    Ces quatre pages s'adressent à des gens qui ne connaissent pas encore le
    produit : elles doivent se présenter de la même façon à tout le monde. La
    bascule y disparaît parce qu'elle n'y ferait plus rien — laisser un bouton
    qui ne change rien apprend à se méfier des autres.

    Le reste des pages publiques — tarifs, fonctionnalités, tutoriels, mentions
    légales — suit le thème choisi, bascule comprise.

    Attention en relisant l'en-tête de ce fichier : une version antérieure
    verrouillait l'accueil en SOMBRE et masquait la bascule pour dissimuler le
    verrou. Ce n'est pas ce qui est fait ici — le verrou est assumé, il porte
    sur le clair, et il est annoncé par l'absence de bouton plutôt que caché
    derrière lui.
  */
  const { pathname } = useLocation();
  const pageEnClair = PAGES_EN_CLAIR.includes(pathname);

  // La bordure de l'en-tête n'apparaît qu'une fois le contenu passé dessous :
  // posée d'emblée, elle coupe la page en deux au premier coup d'œil.
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={cn(
        'bg-background text-foreground flex min-h-dvh flex-col',
        pageEnClair && 'theme-jour-verrouille',
      )}
    >
      <a
        href="#contenu-principal"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      {/* ---------------------------------------------------- NAVBAR */}
      <header
        className={cn(
          'sticky top-0 z-50 transition-colors duration-200',
          /*
            `bg-surface` ET NON `bg-white`.

            La barre etait blanche en dur. Sur les pages publiques qui suivent
            le theme — tarifs, fonctionnalites, FAQ, mentions legales — elle
            restait donc blanche au-dessus d'un contenu sombre. Le jeton suit
            le theme : blanc en clair, marine en sombre.

            Les pages verrouillees en clair ne changent pas d'aspect : leur
            `--surface` vaut blanc, puisque `theme-jour-verrouille` redeclare
            la palette claire.
          */
          isScrolled
            ? 'border-border bg-surface/95 border-b backdrop-blur-md'
            : 'bg-surface border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
          <Logo className="min-h-touch shrink-0 text-base sm:text-lg" />

          <nav aria-label="Navigation du site" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {MARKETING_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDownloadModalOpen(true)}
              className="hidden sm:inline-flex"
              aria-label="Installer l'application sur votre appareil"
            >
              <Smartphone className="size-4 shrink-0" />
              <span>Installer l’app</span>
            </Button>

            {!pageEnClair && <ThemeToggle />}

            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link to={ROUTES.dashboard}>
                  <span className="lg:hidden">Ouvrir</span>
                  <span className="hidden lg:inline">Ouvrir l&apos;application</span>
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                  <Link to={ROUTES.login}>Connexion</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to={ROUTES.register}>
                    <span className="lg:hidden">Commencer</span>
                    <span className="hidden lg:inline">Commencer gratuitement</span>
                  </Link>
                </Button>
              </>
            )}

            {/* Burger mobile */}
            <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Dialog.Trigger
                className="text-muted-foreground hover:bg-surface-hover hover:text-foreground -mr-1 flex size-touch cursor-pointer items-center justify-center rounded-lg sm:size-9 lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] lg:hidden" />
                <Dialog.Content className="border-border bg-surface-raised shadow-modal fixed inset-x-0 top-0 z-50 rounded-b-2xl border-b p-4 lg:hidden">
                  <Dialog.Title className="sr-only">Menu de navigation</Dialog.Title>
                  <div className="border-border mb-2 flex items-center justify-between border-b pb-3">
                    <Logo className="text-base" />
                    <Dialog.Close
                      className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-touch cursor-pointer items-center justify-center rounded-lg sm:size-9"
                      aria-label="Fermer le menu"
                    >
                      <X className="size-5" />
                    </Dialog.Close>
                  </div>
                  <ul className="space-y-1">
                    {MARKETING_LINKS.map((link) => (
                      <li key={link.to}>
                        <Link
                          to={link.to}
                          onClick={() => setMenuOpen(false)}
                          className="text-foreground hover:bg-surface-hover min-h-touch flex items-center rounded-lg px-3 text-sm font-medium"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                    <li className="border-border mt-2 border-t pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setIsDownloadModalOpen(true);
                        }}
                        className="text-foreground hover:bg-surface-hover min-h-touch flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium"
                      >
                        <Smartphone className="size-4 shrink-0" aria-hidden="true" />
                        Installer l’app
                      </button>
                    </li>
                  </ul>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- CONTENU PRINCIPAL */}
      <main id="contenu-principal" className="flex-1">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>

      <PublicFooter />

      {/* Installation sur l'appareil — REZO360 est une application web installable,
          il n'y a rien à télécharger. Voir le commentaire de `DownloadAppModal`. */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </div>
  );
}

const FOOTER_SECTIONS = [
  {
    title: 'Plateforme',
    links: [
      { to: ROUTES.features, label: 'Fonctions' },
      { to: ROUTES.tools, label: 'Outils' },
      { to: ROUTES.tutorials, label: 'Tutoriels' },
      { to: ROUTES.pricing, label: 'Tarifs' },
      { to: ROUTES.faq, label: 'FAQ' },
    ],
  },
  {
    title: 'Compte',
    links: [
      { to: ROUTES.login, label: 'Connexion' },
      { to: ROUTES.register, label: 'Inscription' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { to: ROUTES.legalNotice, label: 'Mentions' },
      { to: ROUTES.privacy, label: 'Confidentialité' },
      { to: ROUTES.terms, label: 'CGU' },
      { to: ROUTES.cookies, label: 'Cookies' },
      { to: ROUTES.servicesTerms, label: 'CGV Prestations' },
    ],
  },
] as const;

function PublicFooter() {
  return (
    <footer className="border-border bg-surface relative z-10 border-t py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-6">
          <div className="space-y-3 lg:col-span-2">
            <Logo className="text-base" />
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Plateforme SaaS dédiée aux techniciens et entreprises techniques.
            </p>
            {/* Réseaux sociaux */}
            <div className="flex items-center gap-3" aria-label="Nos réseaux sociaux">
              <a
                href="https://www.instagram.com/rezo.360"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="REZO360 sur Instagram"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {/* Instagram — lucide-react ne l'inclut plus, SVG officiel simplifié */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="https://www.tiktok.com/@rezo3601"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="REZO360 sur TikTok"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {/* TikTok n'est pas dans lucide-react — SVG officiel simplifié */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-5"
                  aria-hidden="true"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Les trois groupes tiennent sur une ligne, mobile compris. */}
          <div className="grid grid-cols-3 gap-4 lg:col-span-3 lg:gap-6">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-2">
                <h2 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                  {section.title}
                </h2>
                <ul className="space-y-1">
                  {section.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="text-muted-foreground hover:text-foreground block truncate py-0.5 text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border text-muted-foreground mt-8 flex flex-col items-center justify-between gap-1 border-t pt-4 text-xs sm:flex-row">
          <span>© {new Date().getFullYear()} REZO360. Tous droits réservés.</span>
          <span className="hidden xs:inline">Conçu pour les professionnels du terrain</span>
        </div>
      </div>
    </footer>
  );
}
