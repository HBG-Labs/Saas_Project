import {
  Briefcase,
  Building2,
  ChevronDown,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';

import {
  ACCOUNT_NAV,
  PLATFORM_ADMIN_NAV,
  SIDEBAR_GROUPS,
  type NavGroup,
  type ResolvedNavItem,
} from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { useCurrentIndustry } from '@/features/industries';
import { useCurrentOrganization, useVisibleNavGroups } from '@/features/organizations';
import { usePlatformAdmin } from '@/features/prospecting';
import { cn } from '@/lib/cn';

import { FALLBACK_NAV_ICON, NAV_ICONS } from './nav-icons';

/*
  Couleur des icônes, par groupe.

  Neuf groupes portaient neuf couleurs Tailwind écrites en dur — bleu, vert,
  ambre, violet, cyan… Aucune ne venait de la palette, aucune ne suivait le
  thème sombre, et l'ensemble faisait de la barre latérale l'endroit le plus
  bariolé de l'application, alors qu'elle est ce qu'on voit sur chaque écran.

  Une seule couleur porte l'identité : le bleu REZO. La seule exception est
  l'administration plateforme, en rouge parce qu'elle EST une zone réservée —
  la couleur y dit quelque chose, elle ne décore pas.
*/
const SIDEBAR_GROUP_ICON_COLORS: Record<string, string> = {
  'platform-admin': 'text-error',
};
const SIDEBAR_GROUP_ICON_COLOR_DEFAULT = 'text-primary';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  showCollapseButton?: boolean;
  className?: string;
  /**
   * Sections à afficher. Par défaut celles du pilotage ; `AppLayout` substitue
   * les sections « Espace Technicien » quand le rôle réel dans l'organisation
   * courante est `technician`.
   */
  groups?: readonly NavGroup[] | undefined;
}

function isGroupActive(group: NavGroup, pathname: string, search: string): boolean {
  const currentFullPath = pathname + search;
  return group.items.some((item) => {
    if (item.to.includes('?')) {
      return currentFullPath === item.to;
    }
    if (item.to === ROUTES.organization) {
      return pathname === ROUTES.organization || pathname === ROUTES.organizationNew;
    }
    if (item.to === ROUTES.tools) {
      return pathname === ROUTES.tools && (!search || search === '?cat=all');
    }
    if (item.to === ROUTES.metiers) {
      return pathname === ROUTES.metiers || pathname.startsWith('/metiers');
    }
    if (item.to === ROUTES.dashboard) {
      return pathname === ROUTES.dashboard;
    }
    if (item.to === ROUTES.stock) {
      return pathname === ROUTES.stock;
    }
    return pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to + '/'));
  });
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
  iconColor,
}: {
  item: ResolvedNavItem;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
  iconColor?: string | undefined;
}) {
  const Icon = NAV_ICONS[item.icon] ?? FALLBACK_NAV_ICON;
  const location = useLocation();

  const currentFullPath = location.pathname + location.search;

  const isActive = (() => {
    if (item.to.includes('?')) {
      return currentFullPath === item.to;
    }
    if (item.to === ROUTES.tools) {
      return (
        location.pathname === ROUTES.tools && (!location.search || location.search === '?cat=all')
      );
    }
    if (item.to === ROUTES.metiers) {
      return location.pathname === ROUTES.metiers;
    }
    if (item.to === ROUTES.dashboard) {
      return location.pathname === ROUTES.dashboard;
    }
    if (item.to === ROUTES.organization) {
      return (
        location.pathname === ROUTES.organization || location.pathname === ROUTES.organizationNew
      );
    }
    if (item.to === ROUTES.stock) {
      return location.pathname === ROUTES.stock;
    }
    return (
      location.pathname === item.to ||
      (item.to !== '/' && location.pathname.startsWith(item.to + '/'))
    );
  })();

  /*
    LE LIEN RESTE CLIQUABLE, MÊME VERROUILLÉ.

    Un lien inerte laisse la personne sans réponse : elle voit qu'il existe
    quelque chose, pas ce qu'il faut faire pour l'obtenir. La route est gardée
    par `RequirePlan`, qui nomme la formule requise, son prix, et propose la
    mise à niveau — soit exactement l'explication qu'une barre de 240 px ne peut
    pas donner. Le cadenas annonce le mur ; la page le justifie.

    `aria-disabled` serait donc faux : la destination est atteignable. C'est le
    libellé accessible qui porte l'information.
  */
  const libelleAccessible = item.locked
    ? `${item.label} — non inclus dans votre formule`
    : item.label;

  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onNavigate}
        title={collapsed || item.locked ? libelleAccessible : undefined}
        className={cn(
          'group relative flex min-h-9 items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium',
          'transition-all duration-150',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          collapsed ? 'mx-auto size-9 justify-center px-0' : 'w-full pr-3 pl-7',
          isActive
            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
            : item.locked
              ? // Atténué, jamais effacé : le contraste reste au-dessus du seuil
                // de lecture, sans quoi on n'aurait fait que cacher l'entrée
                // d'une autre manière.
                'text-subtle-foreground hover:bg-surface-hover hover:text-muted-foreground'
              : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
        )}
      >
        <Icon
          className={cn(
            'size-4 shrink-0 transition-transform group-hover:scale-105',
            iconColor,
            isActive && 'text-primary-foreground',
          )}
          aria-hidden="true"
        />
        <span className={cn(collapsed && 'sr-only', 'truncate')}>{item.label}</span>

        {item.locked ? (
          <>
            <Lock
              className={cn(
                'size-3 shrink-0',
                // Replié, l'icône de section occupe déjà la case : le cadenas
                // se pose en pastille dans l'angle plutôt qu'à côté du libellé,
                // qui est alors masqué.
                collapsed ? 'bg-surface absolute -top-0.5 -right-0.5 rounded-full' : 'ml-auto',
                isActive ? 'text-primary-foreground' : 'text-subtle-foreground',
              )}
              aria-hidden="true"
            />
            <span className="sr-only">non inclus dans votre formule</span>
          </>
        ) : null}
      </NavLink>
    </li>
  );
}

function CollapsibleSidebarSection({
  group,
  collapsed,
  isOpen,
  onToggle,
  children,
}: {
  group: NavGroup;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const Icon = group.icon ? NAV_ICONS[group.icon] : null;

  return (
    <div className="space-y-1">
      {!collapsed ? (
        <button
          type="button"
          onClick={onToggle}
          /*
            Ni majuscules forcées ni interlettrage élargi.

            « COMPTE & PARAMÈTRES » en capitales espacées ne tenait plus dans
            les 240 px de la barre une fois la typographie remontée à son
            plancher de lisibilité : le libellé était coupé. Les capitales
            n'apportaient rien qu'une graisse et une couleur atténuée ne disent
            déjà — et elles se lisent moins vite.
          */
          className="text-muted-foreground hover:text-foreground hover:bg-surface-hover/60 group text-2xs flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 font-semibold transition-colors select-none"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 truncate">
            {Icon && (
              <Icon
                className={cn(
                  'size-3.5 shrink-0',
                  SIDEBAR_GROUP_ICON_COLORS[group.id] ?? SIDEBAR_GROUP_ICON_COLOR_DEFAULT,
                )}
              />
            )}
            <span className="truncate">{group.label}</span>
          </div>
          <ChevronDown
            className={cn(
              'text-muted-foreground group-hover:text-foreground size-3.5 shrink-0 transition-transform duration-200',
              !isOpen && '-rotate-90',
            )}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'group mx-auto flex size-9 cursor-pointer items-center justify-center rounded-xl transition-all',
            isOpen
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
          )}
          title={`${group.label} (${isOpen ? 'fermer' : 'ouvrir'})`}
          aria-label={group.label}
          aria-expanded={isOpen}
        >
          {Icon ? (
            <Icon
              className={cn(
                'size-4 shrink-0 transition-transform group-hover:scale-110',
                SIDEBAR_GROUP_ICON_COLORS[group.id] ?? SIDEBAR_GROUP_ICON_COLOR_DEFAULT,
              )}
            />
          ) : (
            <div className="bg-border group-hover:bg-primary size-2 rounded-full" />
          )}
        </button>
      )}

      {/* Contenu déroulant accordéon contrôlé par isOpen */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          !isOpen ? 'pointer-events-none max-h-0 opacity-0' : 'max-h-[600px] opacity-100',
        )}
      >
        <ul className="space-y-1">{children}</ul>
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed: externalCollapsed,
  onToggleCollapse,
  onNavigate,
  onClose,
  showCollapseButton = true,
  className,
  groups,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = showCollapseButton ? (externalCollapsed ?? internalCollapsed) : false;
  const resolvedTenantGroups = useVisibleNavGroups(groups ?? SIDEBAR_GROUPS);
  const { organization } = useCurrentOrganization();
  const { label: industryLabel, isResolved } = useCurrentIndustry();
  const location = useLocation();
  const { isAdmin: isPlatformAdmin } = usePlatformAdmin();

  const accountGroup: NavGroup = {
    id: 'account',
    label: 'Compte & Paramètres',
    icon: 'settings',
    items: ACCOUNT_NAV,
  };

  // Jamais dans `SIDEBAR_GROUPS` : ce groupe ne dépend d'aucun rôle
  // d'organisation, d'aucun métier, d'aucun abonnement — seulement du statut
  // d'administrateur plateforme, invisible au système de permissions tenant.
  const platformAdminGroup: NavGroup | null = isPlatformAdmin
    ? {
        id: 'platform-admin',
        label: 'Administration REZO360',
        icon: 'radar',
        items: PLATFORM_ADMIN_NAV,
      }
    : null;

  // Sans organisation, `resolvedTenantGroups` (Interventions, Stock, Achats…)
  // reste toujours non vide — `useVisibleNavGroups` ne filtre que sur
  // métier/rôle, jamais sur « appartient à une organisation ». Un
  // administrateur plateforme sans organisation (Prospect Radar est
  // délibérément HORS `RequireOrganization`, Phase 6) atteint donc cette
  // sidebar sans jamais passer par la redirection « Créer votre entreprise »
  // — il ne doit voir QUE le volet plateforme.
  const tenantGroups = organization ? resolvedTenantGroups : [];
  const allGroups = [
    ...tenantGroups,
    ...(platformAdminGroup ? [platformAdminGroup] : []),
    accountGroup,
  ];
  const currentFullPath = location.pathname + location.search;

  // Un seul volet ouvert à la fois : celui qui contient la page courante.
  const activeGroupId =
    allGroups.find((g) => isGroupActive(g, location.pathname, location.search))?.id ??
    tenantGroups[0]?.id ??
    'interventions';

  // Le repli manuel ne vaut QUE pour la page où il a été fait. Mémoriser le
  // chemin avec le choix suffit à le périmer à la navigation suivante, sans
  // effet de synchronisation.
  //
  // Déduit au rendu, et non posé par un `useEffect` : `setOpenGroupId` dans un
  // effet provoquait un second rendu à chaque navigation, et le volet s'ouvrait
  // une image après le changement de page. C'est le défaut que le code
  // précédent documentait avoir corrigé — et que la règle ESLint
  // `react-hooks/set-state-in-effect` signalait ici.
  const [manualOverride, setManualOverride] = useState<{
    path: string;
    openId: string | null;
  } | null>(null);

  const openGroupId =
    manualOverride?.path === currentFullPath ? manualOverride.openId : activeGroupId;

  const handleToggleGroup = (groupId: string) => {
    setManualOverride({
      path: currentFullPath,
      openId: openGroupId === groupId ? null : groupId,
    });
  };

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        'bg-surface border-border flex h-full w-full flex-col justify-between transition-all duration-200',
        isCollapsed ? 'px-2 py-3' : 'p-3',
        className,
      )}
    >
      <div className="space-y-3 overflow-x-hidden overflow-y-auto pr-0.5">
        {/* En-tête Organisation & Métier */}
        <div
          className={cn(
            'flex items-center pt-1 pb-1',
            isCollapsed ? 'justify-center' : 'justify-between px-1',
          )}
        >
          {!isCollapsed ? (
            <NavLink
              to={ROUTES.organization}
              onClick={onNavigate}
              className="hover:bg-surface-hover/80 group -m-1 block min-w-0 cursor-pointer rounded-lg p-1 pr-2 transition-colors"
              title="Paramètres de l'entreprise (modifier nom et secteur d'activité)"
            >
              <div className="text-foreground group-hover:text-primary flex items-center gap-1.5 truncate text-xs font-bold transition-colors">
                <Building2 className="text-primary size-3.5 shrink-0" />
                <span className="truncate">{organization?.name ?? 'REZO360'}</span>
              </div>
              {organization && isResolved && industryLabel ? (
                <div className="text-2xs text-muted-foreground group-hover:text-foreground/80 mt-0.5 flex items-center gap-1 truncate transition-colors">
                  <Briefcase className="text-subtle-foreground size-3 shrink-0" />
                  <span className="truncate">{industryLabel}</span>
                </div>
              ) : null}
            </NavLink>
          ) : null}

          {showCollapseButton ? (
            <button
              type="button"
              onClick={handleToggle}
              className={cn(
                'text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 cursor-pointer rounded-lg p-1.5 transition-colors',
                isCollapsed && 'mx-auto',
              )}
              title={isCollapsed ? 'Développer la sidebar' : 'Réduire la sidebar'}
              aria-label="Toggle Sidebar"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          ) : onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:bg-surface-hover hover:text-foreground shrink-0 cursor-pointer rounded-lg p-1.5 transition-colors"
              title="Fermer le menu"
              aria-label="Fermer le menu"
            >
              <PanelLeftClose className="size-4" />
            </button>
          ) : null}
        </div>

        {/* Sections de navigation accordéon (un seul volet ouvert à la fois) */}
        {tenantGroups.map((group) => (
          <CollapsibleSidebarSection
            key={group.id}
            group={group}
            collapsed={isCollapsed}
            isOpen={openGroupId === group.id}
            onToggle={() => handleToggleGroup(group.id)}
          >
            {group.items.map((item) => (
              <SidebarLink
                key={`${group.id}-${item.to}-${item.label}`}
                item={item}
                collapsed={isCollapsed}
                onNavigate={onNavigate}
                iconColor={SIDEBAR_GROUP_ICON_COLORS[group.id] ?? SIDEBAR_GROUP_ICON_COLOR_DEFAULT}
              />
            ))}
          </CollapsibleSidebarSection>
        ))}

        {platformAdminGroup ? (
          <CollapsibleSidebarSection
            group={platformAdminGroup}
            collapsed={isCollapsed}
            isOpen={openGroupId === platformAdminGroup.id}
            onToggle={() => handleToggleGroup(platformAdminGroup.id)}
          >
            {platformAdminGroup.items.map((item) => (
              <SidebarLink
                key={`${platformAdminGroup.id}-${item.to}-${item.label}`}
                item={{ ...item, locked: false }}
                collapsed={isCollapsed}
                onNavigate={onNavigate}
                iconColor={SIDEBAR_GROUP_ICON_COLORS['platform-admin']}
              />
            ))}
          </CollapsibleSidebarSection>
        ) : null}
      </div>

      <div className="border-border border-t pt-2">
        <CollapsibleSidebarSection
          group={accountGroup}
          collapsed={isCollapsed}
          isOpen={openGroupId === 'account'}
          onToggle={() => handleToggleGroup('account')}
        >
          {/* Profil et Paramètres n'appartiennent à aucune formule : jamais de cadenas. */}
          {ACCOUNT_NAV.map((item) => (
            <SidebarLink
              key={item.to}
              item={{ ...item, locked: false }}
              collapsed={isCollapsed}
              onNavigate={onNavigate}
              iconColor={SIDEBAR_GROUP_ICON_COLOR_DEFAULT}
            />
          ))}
        </CollapsibleSidebarSection>
      </div>
    </nav>
  );
}
