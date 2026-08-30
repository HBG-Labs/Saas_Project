import { Menu, Smartphone, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { ThemeToggle, useTheme } from '@/features/theme';
import { cn } from '@/lib/cn';

import { DownloadAppModal } from './DownloadAppModal';
import { Logo } from './Logo';

const MARKETING_LINKS = [
  { to: ROUTES.features, label: 'Fonctionnalités' },
  { to: ROUTES.tools, label: 'Outils' },
  { to: ROUTES.pricing, label: 'Tarifs' },
  { to: ROUTES.faq, label: 'FAQ' },
] as const;

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const { resolvedTheme } = useTheme();

  // Détection du défilement pour protéger la topbar lors du scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // La landing page est strictement verrouillée sur le thème sombre cyber-technique
  useEffect(() => {
    const root = document.documentElement;
    if (isLandingPage) {
      root.classList.add('dark');
    } else {
      root.classList.toggle('dark', resolvedTheme === 'dark');
    }
  }, [isLandingPage, resolvedTheme]);

  return (
    <div
      className={
        isLandingPage
          ? 'flex min-h-dvh flex-col bg-transparent text-white'
          : 'flex min-h-dvh flex-col bg-slate-50/50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100'
      }
    >
      <a
        href="#contenu-principal"
        className="sr-only rounded-md bg-blue-600 px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      {/* ---------------------------------------------------- NAVBAR */}
      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-200',
          isLandingPage
            ? isScrolled
              ? 'border-b border-white/10 bg-slate-950/80 backdrop-blur-md text-white shadow-lg shadow-black/30'
              : 'border-b border-transparent bg-transparent text-white shadow-none'
            : 'border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90'
        )}
      >
        <div className={cn('mx-auto flex h-16 items-center justify-between gap-2', isLandingPage ? 'max-w-[1600px] px-3 sm:gap-4 sm:px-5 lg:px-6' : 'max-w-7xl px-3 sm:gap-4 sm:px-6 lg:px-8')}>
          <Logo className={cn('shrink-0 text-base sm:text-lg', isLandingPage ? 'text-white' : 'text-slate-900 dark:text-white')} />

          {/* Navigation centrale */}
          <nav aria-label="Navigation du site" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {MARKETING_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className={cn(
                      'flex h-9 items-center px-3.5 text-xs font-semibold transition-colors',
                      isLandingPage
                        ? 'rounded-none text-slate-300 hover:bg-blue-600/15 hover:text-cyan-300'
                        : 'rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Actions à droite */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {/* BOUTON TÉLÉCHARGER L'APP */}
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(true)}
              className={cn(
                'hidden items-center gap-1.5 text-xs font-bold transition-all cursor-pointer sm:flex',
                isLandingPage
                  ? 'border-0 bg-transparent text-blue-400 hover:text-blue-300 shadow-none p-0 rounded-none'
                  : 'rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-blue-600 shadow-xs hover:bg-blue-500/20 dark:text-blue-400'
              )}
              aria-label="Installer l'application sur votre appareil"
            >
              <Smartphone className="size-4 shrink-0" />
              <span className="hidden sm:inline">Installer l’app</span>
            </button>

            {/* Bascule de thème masquée UNIQUEMENT sur la landing page */}
            {!isLandingPage && <ThemeToggle />}

            {isAuthenticated ? (
              isLandingPage ? (
                <Link to={ROUTES.dashboard} className="text-xs font-bold text-cyan-300 hover:text-cyan-200 transition-colors">
                  <span className="lg:hidden">Ouvrir</span>
                  <span className="hidden lg:inline">Ouvrir l&apos;application</span>
                </Link>
              ) : (
                <Button asChild size="sm" className="rounded-xl font-bold">
                  <Link to={ROUTES.dashboard}>
                    <span className="lg:hidden">Ouvrir</span>
                    <span className="hidden lg:inline">Ouvrir l&apos;application</span>
                  </Link>
                </Button>
              )
            ) : (
              <>
                {isLandingPage ? (
                  <Link to={ROUTES.login} className="hidden text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors lg:inline-flex">
                    Connexion
                  </Link>
                ) : (
                  <Button asChild variant="ghost" size="sm" className="hidden text-xs font-semibold lg:inline-flex">
                    <Link to={ROUTES.login}>Connexion</Link>
                  </Button>
                )}

                {isLandingPage ? (
                  <Link to={ROUTES.register} className="text-xs font-bold text-blue-400 hover:text-cyan-300 transition-colors">
                    <span className="lg:hidden">Commencer</span>
                    <span className="hidden lg:inline">Commencer gratuitement</span>
                  </Link>
                ) : (
                  <Button asChild size="sm" className="rounded-xl font-bold shadow-xs">
                    <Link to={ROUTES.register}>
                      <span className="lg:hidden">Commencer</span>
                      <span className="hidden lg:inline">Commencer gratuitement</span>
                    </Link>
                  </Button>
                )}
              </>
            )}

            {/* Burger mobile */}
            <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Dialog.Trigger
                className={cn(
                  'text-muted-foreground hover:bg-surface-hover hover:text-foreground -mr-1 flex size-touch items-center justify-center rounded-lg sm:size-9 lg:hidden',
                  isLandingPage && 'text-slate-200 hover:bg-slate-800 hover:text-white',
                )}
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" />
                <Dialog.Content
                  className={cn(
                    'fixed inset-x-0 top-0 z-50 border-b p-4 shadow-2xl lg:hidden',
                    isLandingPage
                      ? 'dark border-slate-800/90 bg-[#070b14]/98 text-white backdrop-blur-2xl shadow-black/80'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white',
                  )}
                >
                  <Dialog.Title className="sr-only">Menu de navigation</Dialog.Title>
                  <div className={cn('flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800/80', isLandingPage && 'border-slate-800/80')}>
                    <Logo className={cn('text-base', isLandingPage ? 'text-white' : 'text-slate-900 dark:text-white')} />
                    <Dialog.Close className={cn('rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white', isLandingPage && 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
                      <X className="size-5" />
                    </Dialog.Close>
                  </div>
                  <ul className="space-y-1">
                    {MARKETING_LINKS.map((link) => (
                      <li key={link.to}>
                        <Link
                          to={link.to}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            'flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                            isLandingPage && 'text-slate-200 hover:bg-blue-600/15 hover:text-cyan-300',
                          )}
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

      <PublicFooter isLandingPage={isLandingPage} />

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
    ],
  },
] as const;

function PublicFooter({ isLandingPage }: { isLandingPage?: boolean }) {
  return (
    <footer
      className={
        isLandingPage
          ? 'relative z-10 border-t border-white/10 bg-[#020808]/90 py-3 sm:py-6 text-white backdrop-blur-md'
          : 'relative z-10 border-t border-slate-200/80 bg-white py-3 sm:py-6 dark:border-slate-800/80 dark:bg-slate-950 text-slate-900 dark:text-white'
      }
    >
      <div className={isLandingPage ? 'mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'}>
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-5 lg:gap-6">
          {/* Logo & Descriptif ultra compact */}
          <div className="lg:col-span-2 space-y-1">
            <Logo className={cn('text-sm sm:text-base', isLandingPage && 'text-white')} />
            <p className={cn('max-w-sm text-[11px] sm:text-xs leading-tight sm:leading-relaxed', isLandingPage ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')}>
              Plateforme SaaS dédiée aux techniciens et entreprises techniques.
            </p>
          </div>

          {/* Les 3 menus STRICTEMENT sur la même ligne (3 colonnes) sur mobile comme sur desktop */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:col-span-3 lg:gap-6">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1">
                <h2 className={cn('text-[10px] sm:text-xs font-bold uppercase tracking-wider', isLandingPage ? 'text-white' : 'text-slate-900 dark:text-white')}>
                  {section.title}
                </h2>
                <ul className="space-y-0.5 sm:space-y-1">
                  {section.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className={cn(
                          'text-[10px] sm:text-xs transition-colors block py-0.5 truncate',
                          isLandingPage
                            ? 'text-slate-300 hover:text-cyan-300'
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        )}
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

        {/* Copyright & Mentions ultra compact */}
        <div className={cn('mt-3 sm:mt-5 flex flex-col items-center justify-between gap-1 border-t pt-2 sm:pt-3 text-[10px] sm:text-xs sm:flex-row', isLandingPage ? 'border-white/10 text-slate-400' : 'border-slate-100 text-slate-400 dark:border-slate-800/60')}>
          <span>© {new Date().getFullYear()} REZO360 SaaS. Tous droits réservés.</span>
          <span className="text-[10px] text-slate-500 hidden xs:inline">Conçu pour les professionnels du terrain</span>
        </div>
      </div>
    </footer>
  );
}
