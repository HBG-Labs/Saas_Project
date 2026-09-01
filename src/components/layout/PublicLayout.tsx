import { Menu, Smartphone, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { ThemeToggle } from '@/features/theme';
import { cn } from '@/lib/cn';

import { DownloadAppModal } from './DownloadAppModal';
import { Logo } from './Logo';

const MARKETING_LINKS = [
  { to: ROUTES.features, label: 'Fonctionnalités' },
  { to: ROUTES.tools, label: 'Outils' },
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
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
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
          isScrolled
            ? 'border-border bg-surface/90 border-b backdrop-blur-md'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <Logo className="shrink-0 text-base sm:text-lg" />

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

            <ThemeToggle />

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
          <div className="space-y-2 lg:col-span-2">
            <Logo className="text-base" />
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Plateforme SaaS dédiée aux techniciens et entreprises techniques.
            </p>
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
