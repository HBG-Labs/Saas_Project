import { Ellipsis, ExternalLink, FileText, Link2, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui';
import { cn } from '@/lib/cn';

import type { WorkspacePage } from '../api/workspace.api';

type SidebarPage = Pick<WorkspacePage, 'id' | 'title' | 'icon'>;

export function WorkspaceSidebarPageRow({
  page,
  to,
  active = false,
  depth = 0,
  showFallbackIcon = true,
  canEdit,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onCopyLink,
  onArchive,
}: {
  page: SidebarPage;
  to: string;
  active?: boolean;
  depth?: number;
  showFallbackIcon?: boolean;
  canEdit: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (page: SidebarPage) => void;
  onCopyLink: (page: SidebarPage) => void;
  onArchive: (page: SidebarPage) => void;
}) {
  const title = page.title || 'Sans titre';

  return (
    <li
      className={cn(
        'group flex min-h-11 items-center rounded-lg text-sm lg:min-h-9',
        active ? 'bg-nav-selected text-nav-foreground font-bold' : 'hover:bg-surface-hover',
      )}
    >
      <Link
        to={to}
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        style={{ paddingLeft: `${String(8 + depth * 14)}px` }}
        className="focus-visible:ring-ring flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-2 focus-visible:ring-2 focus-visible:outline-none lg:min-h-9"
      >
        {page.icon || showFallbackIcon ? (
          <span className="w-5 shrink-0 text-center">
            {page.icon ?? <FileText className="inline size-4" aria-hidden />}
          </span>
        ) : null}
        <span className="truncate">{title}</span>
      </Link>

      <Dropdown
        align="end"
        trigger={
          <button
            type="button"
            aria-label={`Actions rapides pour ${title}`}
            className={cn(
              'text-muted-foreground hover:bg-surface-sunken hover:text-foreground focus-visible:ring-ring mr-1 flex size-8 shrink-0 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:outline-none',
              'opacity-100 pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100',
            )}
          >
            <Ellipsis className="size-4" aria-hidden />
          </button>
        }
      >
        <DropdownLabel>Page</DropdownLabel>
        <DropdownItem onSelect={() => onToggleFavorite(page)}>
          <Star className={cn(isFavorite && 'fill-current')} aria-hidden />
          {isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        </DropdownItem>
        <DropdownItem onSelect={() => onCopyLink(page)}>
          <Link2 aria-hidden /> Copier le lien
        </DropdownItem>
        <DropdownItem asChild>
          <Link to={to} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden /> Ouvrir dans un nouvel onglet
          </Link>
        </DropdownItem>
        {canEdit ? (
          <>
            <DropdownSeparator />
            <DropdownItem className="text-error" onSelect={() => onArchive(page)}>
              <Trash2 aria-hidden /> Déplacer dans la corbeille
            </DropdownItem>
          </>
        ) : null}
      </Dropdown>
    </li>
  );
}
