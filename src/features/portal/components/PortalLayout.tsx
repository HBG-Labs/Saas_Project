import {
  FileText,
  FolderOpen,
  Home,
  LogOut,
  MessageSquare,
  Receipt,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { cn } from '@/lib/cn';
import type { PortalContext } from '@/types/database';

import { usePortalUnread, useTouchLastSeen } from '../hooks/usePortal';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Module de l'entreprise requis ; absent = toujours affiché. */
  feature?: keyof PortalContext['features'];
}

const NAV: NavItem[] = [
  { to: ROUTES.portal, label: 'Accueil', icon: Home },
  { to: ROUTES.portalMissions, label: 'Interventions', icon: Wrench, feature: 'missions' },
  { to: ROUTES.portalQuotes, label: 'Devis', icon: FileText, feature: 'quotes' },
  { to: ROUTES.portalInvoices, label: 'Factures', icon: Receipt, feature: 'invoicing' },
  { to: ROUTES.portalDocuments, label: 'Documents', icon: FolderOpen, feature: 'documents' },
  { to: ROUTES.portalMessages, label: 'Messages', icon: MessageSquare },
];

/**
 * Ossature du portail : en-tête, navigation basse sur téléphone, latérale sur
 * écran large. Volontairement indépendante de `AppLayout` — rien de l'espace
 * entreprise (organisation courante, permissions, palette de commandes) n'a de
 * sens pour un client.
 */
export function PortalLayout({ context }: { context: PortalContext }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const unread = usePortalUnread();
  const touch = useTouchLastSeen();

  // Une visite = une trace (`portal.access`), une fois par chargement.
  useEffect(() => {
    touch.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- au montage seulement
  }, []);

  const items = NAV.filter((item) => item.feature === undefined || context.features[item.feature]);
  const unreadCount = unread.data ?? 0;

  const handleSignOut = async () => {
    await signOut();
    await navigate(ROUTES.portalLogin, { replace: true });
  };

  const renderLink = (item: NavItem, variant: 'bottom' | 'side') => {
    const Icon = item.icon;
    const badge = item.to === ROUTES.portalMessages && unreadCount > 0 ? unreadCount : null;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === ROUTES.portal}
        className={({ isActive }) =>
          cn(
            variant === 'bottom'
              ? 'min-h-touch relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium'
              : 'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
            isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            variant === 'side' && isActive && 'bg-primary-subtle',
          )
        }
      >
        <Icon className={variant === 'bottom' ? 'size-5' : 'size-4'} aria-hidden="true" />
        <span className={variant === 'bottom' ? 'truncate' : undefined}>{item.label}</span>
        {badge !== null ? (
          <span
            className={cn(
              'bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-bold leading-4',
              variant === 'bottom' ? 'absolute top-1 right-1/4' : 'ml-auto',
            )}
            aria-label={`${badge} message(s) non lu(s)`}
          >
            {badge}
          </span>
        ) : null}
      </NavLink>
    );
  };

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <a
        href="#contenu-principal"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      <header className="border-border bg-surface sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Link to={ROUTES.portal} className="min-w-0">
            <p className="text-foreground truncate text-sm font-bold">{context.organization_name}</p>
            <p className="text-muted-foreground truncate text-[11px]">Espace client · {context.customer_name}</p>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden max-w-[16rem] truncate text-xs sm:inline">
              {context.contact_email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleSignOut();
              }}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Se déconnecter</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-4 pb-24 md:pb-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav aria-label="Navigation du portail" className="sticky top-20 space-y-1">
            {items.map((item) => renderLink(item, 'side'))}
          </nav>
        </aside>

        <main id="contenu-principal" className="min-w-0 flex-1">
          <Outlet context={context} />
        </main>
      </div>

      <nav
        aria-label="Navigation du portail"
        className="border-border bg-surface safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t md:hidden"
      >
        {items.map((item) => renderLink(item, 'bottom'))}
      </nav>
    </div>
  );
}
