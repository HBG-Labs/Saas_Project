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

/** Deux lettres pour l'avatar de l'entreprise : « Plomberie Dupont » → « PD ». */
function initiales(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const lettres = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : name.slice(0, 2);
  return lettres.toUpperCase();
}

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
            variant === 'side' && 'transition-colors',
            isActive
              ? variant === 'side'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-primary'
              : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
          )
        }
      >
        {({ isActive }) => (
          <>
            {variant === 'bottom' ? (
              <span
                className={cn(
                  'flex h-7 w-11 items-center justify-center rounded-full transition-colors',
                  isActive && 'bg-primary-subtle',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
            ) : (
              <Icon className="size-4" aria-hidden="true" />
            )}
            <span className={variant === 'bottom' ? 'truncate' : undefined}>{item.label}</span>
        {badge !== null ? (
          <span
            className={cn(
              'rounded-full px-1.5 text-[10px] font-bold leading-4',
              variant === 'bottom'
                ? 'bg-accent text-accent-foreground absolute top-1 right-1/4'
                : isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground ml-auto'
                  : 'bg-primary text-primary-foreground ml-auto',
            )}
            aria-label={`${badge} message(s) non lu(s)`}
          >
            {badge}
          </span>
        ) : null}
          </>
        )}
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

      {/*
        En-tête aux couleurs de la marque : dégradé de `primary`, texte en
        `primary-foreground` — identique en thème clair et sombre, et
        immédiatement distinct de l'espace entreprise.
      */}
      <header className="from-primary via-primary text-primary-foreground sticky top-0 z-40 bg-gradient-to-r to-blue-500 shadow-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Link to={ROUTES.portal} className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-sm font-bold uppercase shadow-inner ring-1 ring-white/30"
            >
              {initiales(context.organization_name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{context.organization_name}</span>
              <span className="block truncate text-[11px] text-white/80">Espace client · {context.customer_name}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[16rem] truncate text-xs text-white/80 sm:inline">{context.contact_email}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:text-primary-foreground hover:bg-white/15"
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
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-24 space-y-3">
            <nav
              aria-label="Navigation du portail"
              className="border-border bg-surface space-y-1 rounded-2xl border p-2 shadow-xs"
            >
              {items.map((item) => renderLink(item, 'side'))}
            </nav>
            <div className="border-border bg-surface-subtle rounded-2xl border p-3">
              <p className="text-foreground text-xs font-semibold">Une question ?</p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                Écrivez à {context.organization_name} depuis la messagerie, ou répondez simplement à l’un de
                ses e-mails : votre réponse arrive ici.
              </p>
            </div>
            <p className="text-muted-foreground px-2 text-center text-[11px]">
              Propulsé par <span className="text-foreground font-semibold">REZO360</span>
            </p>
          </div>
        </aside>

        <main id="contenu-principal" className="min-w-0 flex-1">
          <Outlet context={context} />
        </main>
      </div>

      <nav
        aria-label="Navigation du portail"
        className="border-border bg-surface/95 safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm md:hidden"
      >
        {items.map((item) => renderLink(item, 'bottom'))}
      </nav>
    </div>
  );
}
