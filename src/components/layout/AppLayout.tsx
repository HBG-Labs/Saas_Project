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
import { TECHNICIAN_SIDEBAR_GROUPS } from '@/config/technician-navigation';
import { useAuth } from '@/features/auth';
import { usePermission } from '@/features/organizations';
import { OrganizationSwitcher } from '@/features/organizations/components/OrganizationSwitcher';
import { useCommandBar } from '@/features/search/useCommandBar';
import { ThemeToggle } from '@/features/theme/ThemeToggle';

import { DevRoleSelector } from './DevRoleSelector';
import { DownloadAppModal } from './DownloadAppModal';
import { Logo } from './Logo';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { displayNameOf } from './user-display';

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const { status, user, signOut } = useAuth();
  const { role } = usePermission();
  const { openCommandBar } = useCommandBar();
  const navigate = useNavigate();

  const isAuthenticated = status === 'authenticated';
  const displayName = displayNameOf(user);

  // Les sections « Espace Technicien » suivent le rôle RÉEL dans l'organisation
  // courante, pas une préférence d'affichage : un technicien connecté en
  // production doit voir sa navigation, et un dirigeant la sienne.
  const activeSidebarGroups = role === 'technician' ? TECHNICIAN_SIDEBAR_GROUPS : undefined;

  const handleSignOut = () => {
    void signOut().then(() => navigate(ROUTES.home));
  };

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <a
        href="#contenu-principal"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      {/* ---------------------------------------------------- BARRE SUPÉRIEURE (HEADER) */}
      <header className="border-border bg-surface/95 fixed inset-x-0 top-0 z-30 h-14 border-b backdrop-blur-md">
        {/*
          Trois zones, dont une seule est élastique.

          Le logo faisait 160 px fixes, les actions une centaine, et la
          recherche s'intercalait entre les deux : à 360 px la somme dépassait
          la largeur de l'écran et poussait la barre hors cadre. Le logo se
          réduit désormais sur mobile, la recherche est la seule à absorber
          l'espace restant (`min-w-0`, sans quoi un enfant en `flex` refuse de
          descendre sous la largeur de son contenu), et les actions ne se
          compriment jamais — ce sont des cibles tactiles.
        */}
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <div className="flex shrink-0 items-center gap-1">
            <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
              <Dialog.Trigger
                className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-touch items-center justify-center rounded-lg lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Dialog.Trigger>

              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs lg:hidden" />
                <Dialog.Content className="border-border bg-surface fixed inset-y-0 left-0 z-50 w-[min(17rem,85vw)] border-r shadow-xl lg:hidden">
                  <Dialog.Title className="sr-only">Menu de navigation</Dialog.Title>
                  <div className="border-border flex h-14 items-center border-b px-4">
                    <Logo to={ROUTES.home} />
                  </div>
                  <Sidebar
                    groups={activeSidebarGroups}
                    onNavigate={() => setDrawerOpen(false)}
                    onDownloadAppClick={() => {
                      setDrawerOpen(false);
                      setIsDownloadModalOpen(true);
                    }}
                    className="h-[calc(100%-3.5rem)]"
                  />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

            <Logo to={ROUTES.home} className="w-28 sm:w-36 lg:w-48" />
          </div>

          {/* Recherche globale ⌘K */}
          <button
            type="button"
            onClick={openCommandBar}
            className="border-border bg-surface-sunken text-muted-foreground hover:border-border-strong hover:bg-surface-hover flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors sm:max-w-64 lg:max-w-80"
            aria-label="Rechercher"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            {/* Le libellé s'efface avant de se réduire en bouillie : sur un très petit écran, l'icône et l'`aria-label` disent la même chose. */}
            <span className="hidden truncate xs:inline">Rechercher</span>
            <span className="hidden truncate lg:inline">dans NexoraTech</span>
            <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
          </button>

          {/* Actions utilisateur, Sélecteur de Rôle DEV & Thème */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {/* SÉLECTEUR DE RÔLE SIMULÉ EN DÉVELOPPEMENT */}
            <DevRoleSelector />

            <ThemeToggle />

            {isAuthenticated ? (
              <Dropdown
                trigger={
                  <button
                    type="button"
                    className="ring-border hover:ring-border-strong flex size-9 items-center justify-center rounded-full ring-2 transition-all"
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
                <DropdownItem onSelect={handleSignOut} className="text-rose-600 dark:text-rose-400">
                  <LogOut />
                  Se déconnecter
                </DropdownItem>
              </Dropdown>
            ) : (
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to={ROUTES.login}>Connexion</Link>
                </Button>
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                  <Link to={ROUTES.register}>Créer un compte</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- BARRE LATÉRALE DESKTOP */}
      <aside
        className={`border-border bg-surface fixed inset-y-0 top-14 left-0 z-20 hidden border-r transition-all duration-200 lg:block ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <Sidebar
          groups={activeSidebarGroups}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onDownloadAppClick={() => setIsDownloadModalOpen(true)}
        />
      </aside>

      {/* ---------------------------------------------------- CONTENU PRINCIPAL */}
      <main
        id="contenu-principal"
        // Le bas ne réserve de la place que là où la navigation basse existe :
        // elle disparaît à `md`, où 80 px de vide n'avaient plus de raison
        // d'être. `safe-x` écarte le contenu des bords arrondis en paysage.
        className={`safe-x px-4 pt-[4.5rem] pb-24 transition-all duration-200 sm:px-6 md:pb-10 lg:px-8 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Navigation basse mobile */}
      <MobileNav />

      {/* Modale de Téléchargement de l'Application (Mobile APK & Windows Desktop) */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </div>
  );
}
