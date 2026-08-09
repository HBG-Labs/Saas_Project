import { LogOut, Menu, Search, Settings, User } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Suspense, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import { Kbd } from '@/components/ui/Kbd';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { OrganizationSwitcher } from '@/features/organizations/components/OrganizationSwitcher';
import { useCommandBar } from '@/features/search/useCommandBar';
import { ThemeToggle } from '@/features/theme/ThemeToggle';

import { Logo } from './Logo';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { displayNameOf } from './user-display';

/**
 * Ossature de l'application connectée.
 *
 * Trois modèles de navigation selon la largeur (Design System §8.2) :
 *   • < 768 px  : barre supérieure + navigation basse + tiroir latéral
 *   • ≥ 1024 px : barre latérale persistante
 *
 * La barre latérale est rendue DEUX fois — une version fixe pour le desktop,
 * une dans un tiroir pour le mobile. C'est volontaire : masquer/afficher un
 * unique élément par CSS ne permettrait pas le piège de focus du tiroir.
 *
 * Le catalogue étant public, cette ossature sert AUSSI aux visiteurs non
 * connectés : l'en-tête s'adapte donc à l'état d'authentification.
 */
export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { status, user, signOut } = useAuth();
  const { openCommandBar } = useCommandBar();
  const navigate = useNavigate();

  const isAuthenticated = status === 'authenticated';
  const displayName = displayNameOf(user);

  const handleSignOut = () => {
    void signOut().then(() => navigate(ROUTES.home));
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#contenu-principal"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      {/* ---------------------------------------------------- barre supérieure */}
      <header className="bg-surface/95 border-border safe-top fixed inset-x-0 top-0 z-30 h-14 border-b backdrop-blur-sm">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Dialog.Trigger
              className="text-muted-foreground hover:bg-surface-hover flex size-9 items-center justify-center rounded-md lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 lg:hidden" />
              <Dialog.Content className="bg-surface border-border fixed inset-y-0 left-0 z-50 w-64 border-r shadow-modal lg:hidden">
                <Dialog.Title className="sr-only">Menu de navigation</Dialog.Title>
                <div className="border-border flex h-14 items-center border-b px-4">
                  <Logo to={ROUTES.tools} />
                </div>
                <Sidebar
                  onNavigate={() => {
                    setDrawerOpen(false);
                  }}
                  className="h-[calc(100%-3.5rem)]"
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Logo to={isAuthenticated ? ROUTES.dashboard : ROUTES.home} className="lg:w-52" />

          {/* Un vrai <input> ouvrirait le clavier virtuel avant d'afficher la
              palette, produisant un double saut visuel sur téléphone. */}
          <button
            type="button"
            onClick={openCommandBar}
            className="text-subtle-foreground hover:bg-surface-hover border-border bg-surface-sunken ml-auto flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm transition-colors lg:ml-0 lg:w-72"
            aria-label="Rechercher"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">Rechercher…</span>
            <Kbd className="ml-auto hidden lg:inline-flex">⌘K</Kbd>
          </button>

          <div className="flex items-center gap-1 lg:ml-auto">
            <ThemeToggle />

            {isAuthenticated ? (
              <Dropdown
                trigger={
                  <button
                    type="button"
                    className="hover:bg-surface-hover flex size-9 items-center justify-center rounded-md transition-colors"
                    aria-label="Menu du compte"
                  >
                    <Avatar name={displayName} size="sm" />
                  </button>
                }
              >
                <DropdownLabel>{user?.email ?? displayName}</DropdownLabel>
                <DropdownSeparator />
                <OrganizationSwitcher />
                <DropdownItem asChild>
                  <Link to={ROUTES.profile}>
                    <User />
                    Profil
                  </Link>
                </DropdownItem>
                <DropdownItem asChild>
                  <Link to={ROUTES.settings}>
                    <Settings />
                    Paramètres
                  </Link>
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem onSelect={handleSignOut} className="text-error">
                  <LogOut />
                  Se déconnecter
                </DropdownItem>
              </Dropdown>
            ) : (
              // Le catalogue est public : un visiteur non connecté ne doit pas
              // voir d'avatar ni de menu « Se déconnecter ».
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to={ROUTES.login}>Connexion</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to={ROUTES.register}>Créer un compte</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------- barre latérale desktop */}
      <aside className="border-border fixed inset-y-0 top-14 left-0 z-20 hidden w-52 border-r lg:block">
        <Sidebar />
      </aside>

      {/* pb-20 sur mobile : réserve la hauteur de la navigation basse fixe. */}
      <main id="contenu-principal" className="px-4 pt-20 pb-20 sm:px-6 md:pb-10 lg:pl-56 xl:pl-60">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
