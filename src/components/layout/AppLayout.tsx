import { Building2, LogOut, Menu, Search, Settings, User } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
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
import { TrialBanner } from '@/features/billing';
import { NotificationBell } from '@/features/notifications';
import { useCurrentOrganization, usePermission } from '@/features/organizations';
import { OrganizationSwitcher } from '@/features/organizations/components/OrganizationSwitcher';
import { useAvatarStore } from '@/features/profile';
import { useCommandBar } from '@/features/search/useCommandBar';
import { ThemeMenuItems, ThemeToggle } from '@/features/theme/ThemeToggle';
import { cn } from '@/lib/cn';

import { Logo } from './Logo';
import { MobileDrawer } from './MobileDrawer';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { displayNameOf } from './user-display';

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pref_sidebar_collapsed') === 'true';
  });
  const { status, user, signOut } = useAuth();
  const { role } = usePermission();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { openCommandBar } = useCommandBar();
  const navigate = useNavigate();

  const { avatarUrl } = useAvatarStore();
  const isAuthenticated = status === 'authenticated';
  const displayName = displayNameOf(user);

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pref_sidebar_collapsed', String(next));
      } catch {
        // Stockage inaccessible
      }
      return next;
    });
  };

  // Les sections « Espace Technicien » suivent le rôle RÉEL dans l'organisation
  // courante, pas une préférence d'affichage : un technicien connecté en
  // production doit voir sa navigation, et un dirigeant la sienne.
  const activeSidebarGroups = role === 'technician' ? TECHNICIAN_SIDEBAR_GROUPS : undefined;

  // Permet d'ouvrir le tiroir en glissant le doigt depuis le bord gauche de l'écran (< 28px)
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isEdgeTouch = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || drawerOpen) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (touch.clientX <= 28) {
        isEdgeTouch = true;
        startX = touch.clientX;
        startY = touch.clientY;
      } else {
        isEdgeTouch = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEdgeTouch || drawerOpen || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (deltaX > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
        setDrawerOpen(true);
        isEdgeTouch = false;
      }
    };

    const handleTouchEnd = () => {
      isEdgeTouch = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [drawerOpen]);

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
        <div className="flex h-14 items-center gap-1 px-3 sm:gap-3 sm:px-4">
          <div className="flex min-w-0 shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="text-muted-foreground hover:bg-surface-hover hover:text-foreground -ml-1 flex size-touch shrink-0 items-center justify-center rounded-lg sm:size-9 lg:hidden cursor-pointer"
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            <MobileDrawer
              isOpen={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              headerContent={<Logo to={ROUTES.home} />}
            >
              <Sidebar
                groups={activeSidebarGroups}
                collapsed={false}
                showCollapseButton={false}
                onNavigate={() => setDrawerOpen(false)}
                onClose={() => setDrawerOpen(false)}
              />
            </MobileDrawer>

            <Logo to={ROUTES.home} className="shrink-0 text-sm sm:text-base lg:text-lg" />
          </div>

          {/*
            Recherche globale ⌘K — deux objets, pas un objet élastique.

            La version précédente était un champ en `flex-1` censé rétrécir avec
            l'écran. Elle rétrécissait trop bien : les actions à sa droite étant
            incompressibles, elle se réduisait à son propre rembourrage et
            n'affichait plus qu'une pastille ronde autour de la loupe.

            Un champ ne se réduit pas indéfiniment sans cesser d'être un champ.
            En dessous de `md` c'est donc un bouton d'icône de largeur fixe ; le
            champ n'apparaît qu'à partir du moment où il a la place d'exister.
          */}
          <button
            type="button"
            onClick={openCommandBar}
            className="text-muted-foreground hover:bg-surface-hover hover:text-foreground ml-auto flex size-touch shrink-0 items-center justify-center rounded-lg transition-colors sm:size-9 md:hidden"
            aria-label="Rechercher"
          >
            <Search className="size-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={openCommandBar}
            className="border-border bg-surface-sunken text-muted-foreground hover:border-border-strong hover:bg-surface-hover mx-auto hidden h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors md:flex md:max-w-64 lg:max-w-80"
            aria-label="Rechercher"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Rechercher dans REZO360…</span>
            <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
          </button>

          {/* Actions utilisateur et thème */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {!isOnline && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-3xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                Mode Hors-ligne (PWA)
              </span>
            )}
            {isAuthenticated && <NotificationBell />}
            <ThemeToggle />

            {isAuthenticated ? (
              <Dropdown
                trigger={
                  <button
                    type="button"
                    className="ring-border hover:ring-border-strong flex size-touch items-center justify-center rounded-full ring-2 transition-all sm:size-9 cursor-pointer overflow-hidden"
                    aria-label="Menu du compte"
                  >
                    <Avatar src={avatarUrl} name={displayName} size="sm" />
                  </button>
                }
              >
                <DropdownLabel>{user?.email ?? displayName}</DropdownLabel>
                <DropdownSeparator />
                <OrganizationSwitcher />
                <DropdownItem asChild>
                  <Link to={ROUTES.organization}>
                    <Building2 />
                    Entreprise & Métier
                  </Link>
                </DropdownItem>
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
                <div className="sm:hidden">
                  <DropdownLabel>Apparence</DropdownLabel>
                  <ThemeMenuItems />
                  <DropdownSeparator />
                </div>
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
                <Button asChild size="sm" className="font-semibold">
                  <Link to={ROUTES.register}>
                    <span className="sm:hidden">S&apos;inscrire</span>
                    <span className="hidden sm:inline">Créer un compte</span>
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- BARRE LATÉRALE DESKTOP */}
      <aside
        className={cn(
          'border-border bg-surface fixed inset-y-0 top-14 left-0 z-20 hidden border-r transition-all duration-200 lg:block',
          sidebarCollapsed ? 'w-16' : 'w-60',
        )}
      >
        <Sidebar
          groups={activeSidebarGroups}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
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
          {/*
            Au-dessus du contenu, pas dans une page : l'échéance d'essai suspend
            l'accès à TOUS les modules professionnels, pas seulement à celui
            qu'on regarde. La cantonner au tableau de bord serait la manquer.

            Le bandeau se retire de lui-même : hors période d'essai, à plus d'un
            mois de l'échéance, ou pour qui n'a pas `billing.view`.
          */}
          <TrialBanner organizationId={organizationId} />

          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Navigation basse mobile */}
      <MobileNav />

    </div>
  );
}
