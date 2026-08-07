import { Menu } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Suspense, useState } from 'react';
import { Link, Outlet } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { cn } from '@/lib/cn';

import { Logo } from './Logo';

const MARKETING_LINKS = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#categories', label: 'Catégories' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
] as const;

/**
 * Ossature des pages publiques (landing, authentification).
 *
 * Distincte d'`AppLayout` : le contexte marketing n'a ni barre latérale, ni
 * palette de commandes, et remonte la taille de police de base à 16 px — un
 * lecteur de page d'accueil est plus distant et moins engagé qu'un utilisateur
 * en session de travail (cf. Design System §5.2).
 */
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  return (
    <div className="flex min-h-dvh flex-col text-base">
      <a
        href="#contenu-principal"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      <header className="bg-background/80 border-border safe-top sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo className="text-lg" />

          <nav aria-label="Navigation du site" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {MARKETING_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground hover:bg-surface-hover flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link to={ROUTES.dashboard}>Ouvrir l&apos;application</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to={ROUTES.login}>Connexion</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to={ROUTES.register}>Commencer</Link>
                </Button>
              </>
            )}

            <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Dialog.Trigger
                className="text-muted-foreground hover:bg-surface-hover flex size-9 items-center justify-center rounded-md md:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
                <Dialog.Content className="bg-surface border-border shadow-modal fixed inset-x-0 top-0 z-50 border-b p-4 md:hidden">
                  <Dialog.Title className="sr-only">Menu</Dialog.Title>
                  <ul className="space-y-1">
                    {MARKETING_LINKS.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          onClick={() => {
                            setMenuOpen(false);
                          }}
                          className="hover:bg-surface-hover min-h-touch flex items-center rounded-md px-3 text-sm font-medium"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                    {!isAuthenticated ? (
                      <li>
                        <Link
                          to={ROUTES.login}
                          onClick={() => {
                            setMenuOpen(false);
                          }}
                          className="hover:bg-surface-hover min-h-touch flex items-center rounded-md px-3 text-sm font-medium"
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

      <main id="contenu-principal" className="flex-1">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>

      <PublicFooter />
    </div>
  );
}

const FOOTER_SECTIONS = [
  {
    title: 'Produit',
    links: [
      { to: ROUTES.tools, label: 'Catalogue' },
      { to: ROUTES.references, label: 'Références' },
    ],
  },
  {
    title: 'Compte',
    links: [
      { to: ROUTES.login, label: 'Connexion' },
      { to: ROUTES.register, label: 'Créer un compte' },
    ],
  },
] as const;

function PublicFooter() {
  return (
    <footer className={cn('border-border bg-surface-sunken border-t')}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="text-muted-foreground mt-2 max-w-xs text-sm">
              La boîte à outils technique des professionnels de la fibre, des réseaux et de
              l&apos;électricité.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-foreground text-xs font-semibold">{section.title}</h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border text-subtle-foreground mt-8 border-t pt-6 text-xs">
          © {new Date().getFullYear()} NexoraTech. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
