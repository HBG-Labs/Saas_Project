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
    <div className="min-h-dvh bg-slate-50/50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#contenu-principal"
        className="sr-only rounded-md bg-blue-600 px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      {/* ---------------------------------------------------- BARRE SUPÉRIEURE (HEADER) */}
      <header className="fixed inset-x-0 top-0 z-30 h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
              <Dialog.Trigger
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Dialog.Trigger>

              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs lg:hidden" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white shadow-xl lg:hidden dark:border-slate-800 dark:bg-slate-950">
                  <Dialog.Title className="sr-only">Menu de navigation</Dialog.Title>
                  <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-800">
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

            <Logo to={ROUTES.home} className="w-40 lg:w-48" />
          </div>

          {/* Recherche globale ⌘K */}
          <button
            type="button"
            onClick={openCommandBar}
            className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/70 px-3 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 sm:w-64 lg:w-80 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-slate-700"
            aria-label="Rechercher"
          >
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">Rechercher dans NexoraTech…</span>
            <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
          </button>

          {/* Actions utilisateur, Sélecteur de Rôle DEV & Thème */}
          <div className="flex items-center gap-2">
            {/* SÉLECTEUR DE RÔLE SIMULÉ EN DÉVELOPPEMENT */}
            <DevRoleSelector />

            <ThemeToggle />

            {isAuthenticated ? (
              <Dropdown
                trigger={
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full ring-2 ring-slate-200 hover:ring-slate-300 transition-all dark:ring-slate-800"
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
        className={`fixed inset-y-0 top-14 left-0 z-20 hidden border-r border-slate-200/80 bg-white transition-all duration-200 lg:block dark:border-slate-800/80 dark:bg-slate-950 ${
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
        className={`pt-20 pb-20 px-4 sm:px-6 lg:px-8 transition-all duration-200 ${
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
