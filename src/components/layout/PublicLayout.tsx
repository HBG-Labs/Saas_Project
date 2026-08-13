import { Menu, Smartphone } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Suspense, useState } from 'react';
import { Link, Outlet } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
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
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50/50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#contenu-principal"
        className="sr-only rounded-md bg-blue-600 px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      {/* ---------------------------------------------------- NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo className="text-lg" />

          {/* Navigation centrale */}
          <nav aria-label="Navigation du site" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {MARKETING_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="flex h-9 items-center rounded-xl px-3.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Actions à droite */}
          <div className="flex items-center gap-3">
            {/* BOUTON TÉLÉCHARGER L'APP */}
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-500/20 transition-all shadow-xs dark:text-blue-400 cursor-pointer"
              aria-label="Télécharger l'application mobile ou desktop"
            >
              <Smartphone className="size-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Télécharger l'App</span>
            </button>

            <ThemeToggle />

            {isAuthenticated ? (
              <Button asChild size="sm" className="rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-500">
                <Link to={ROUTES.dashboard}>Ouvrir l&apos;application</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-xs font-semibold">
                  <Link to={ROUTES.login}>Connexion</Link>
                </Button>
                <Button asChild size="sm" className="rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-500 shadow-xs">
                  <Link to={ROUTES.register}>Commencer gratuitement</Link>
                </Button>
              </>
            )}

            {/* Burger mobile */}
            <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Dialog.Trigger
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden" />
                <Dialog.Content className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white p-4 shadow-xl md:hidden dark:border-slate-800 dark:bg-slate-950">
                  <Dialog.Title className="sr-only">Menu de navigation</Dialog.Title>
                  <ul className="space-y-1">
                    {MARKETING_LINKS.map((link) => (
                      <li key={link.to}>
                        <Link
                          to={link.to}
                          onClick={() => setMenuOpen(false)}
                          className="flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                    {!isAuthenticated ? (
                      <li className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <Link
                          to={ROUTES.login}
                          onClick={() => setMenuOpen(false)}
                          className="flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                          Connexion
                        </Link>
                      </li>
                    ) : null}
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

      {/* Modale Télécharger l'App (Mobile APK & Windows Desktop) */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </div>
  );
}

const FOOTER_SECTIONS = [
  {
    title: 'Plateforme NexoraTech',
    links: [
      { to: ROUTES.features, label: 'Fonctionnalités' },
      { to: ROUTES.tools, label: 'Catalogue d’outils' },
      { to: ROUTES.pricing, label: 'Tarifs' },
      { to: ROUTES.faq, label: 'FAQ' },
    ],
  },
  {
    title: 'Compte & Session',
    links: [
      { to: ROUTES.login, label: 'Connexion' },
      { to: ROUTES.register, label: 'Créer un compte' },
    ],
  },
] as const;

function PublicFooter() {
  return (
    <footer className={cn('border-t border-slate-200/80 bg-white py-12 dark:border-slate-800/80 dark:bg-slate-950')}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              NexoraTech est la plateforme SaaS dédiée aux techniciens et entreprises techniques. Centralisez vos missions, interventions, équipes et outils professionnels.
            </p>
            <div className="mt-4 flex items-center gap-2 text-2xs text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono font-semibold">Tous les services sont 100% opérationnels</span>
            </div>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                {section.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-xs text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row dark:border-slate-800/60">
          <span>© {new Date().getFullYear()} NexoraTech SaaS. Tous droits réservés.</span>
          <span className="font-mono text-2xs">NexoraTech Engine v2.4</span>
        </div>
      </div>
    </footer>
  );
}
