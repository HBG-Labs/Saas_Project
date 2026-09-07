import { ChevronRight, Folder, FolderInput, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui';
import type { DocumentFolder } from '@/types/domain';

import { cheminDe, enfantsDe } from '../folder-tree';

export interface FolderBreadcrumbProps {
  folders: DocumentFolder[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

/**
 * Le fil d'Ariane.
 *
 * Il porte deux informations que rien d'autre ne donne : où l'on est, et
 * comment remonter. Sur téléphone, il défile horizontalement plutôt que de
 * passer à la ligne — une arborescence profonde repousserait sinon le contenu
 * sous la ligne de flottaison.
 */
export function FolderBreadcrumb({
  folders,
  currentFolderId,
  onNavigate,
}: FolderBreadcrumbProps) {
  const chemin = cheminDe(folders, currentFolderId);

  return (
    <nav aria-label="Fil d’Ariane" className="-mx-1 overflow-x-auto">
      <ol className="text-muted-foreground flex items-center gap-1 px-1 text-sm whitespace-nowrap">
        <li>
          <button
            type="button"
            onClick={() => onNavigate(null)}
            className={[
              'hover:bg-muted rounded-md px-2 py-1 transition-colors',
              currentFolderId === null ? 'text-foreground font-medium' : '',
            ].join(' ')}
          >
            Bibliothèque
          </button>
        </li>
        {chemin.map((dossier, index) => (
          <li key={dossier.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
            <button
              type="button"
              onClick={() => onNavigate(dossier.id)}
              aria-current={index === chemin.length - 1 ? 'page' : undefined}
              className={[
                'hover:bg-muted rounded-md px-2 py-1 transition-colors',
                index === chemin.length - 1 ? 'text-foreground font-medium' : '',
              ].join(' ')}
            >
              {dossier.name}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface FolderGridProps {
  folders: DocumentFolder[];
  currentFolderId: string | null;
  canManage: boolean;
  canDelete: boolean;
  onOpen: (folderId: string) => void;
  onRename: (folder: DocumentFolder) => void;
  onMove: (folder: DocumentFolder) => void;
  onDelete: (folder: DocumentFolder) => void;
}

/**
 * Les sous-dossiers du dossier courant.
 *
 * Ils sont affichés AVANT les documents, et non mêlés à eux : ouvrir un dossier
 * et ouvrir un fichier sont deux gestes différents, et les intercaler oblige à
 * lire une icône avant chaque clic.
 */
export function FolderGrid({
  folders,
  currentFolderId,
  canManage,
  canDelete,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: FolderGridProps) {
  const enfants = enfantsDe(folders, currentFolderId);
  if (enfants.length === 0) return null;

  const compterEnfants = (id: string) => enfantsDe(folders, id).length;

  return (
    <section aria-label="Dossiers" className="space-y-2">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Dossiers
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {enfants.map((dossier) => {
          const sous = compterEnfants(dossier.id);
          return (
            <li
              key={dossier.id}
              className="border-border bg-card hover:border-primary/40 flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <button
                type="button"
                onClick={() => onOpen(dossier.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Folder className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {dossier.name}
                  </span>
                  {sous > 0 && (
                    <span className="text-muted-foreground block text-xs">
                      {sous} sous-dossier{sous > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              </button>

              {(canManage || canDelete) && (
                <Dropdown
                  align="end"
                  trigger={
                    <button
                      type="button"
                      aria-label={`Actions pour le dossier ${dossier.name}`}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </button>
                  }
                >
                  {canManage && (
                    <>
                      <DropdownItem onSelect={() => onRename(dossier)}>
                        <Pencil className="mr-2 h-4 w-4" aria-hidden />
                        Renommer
                      </DropdownItem>
                      <DropdownItem onSelect={() => onMove(dossier)}>
                        <FolderInput className="mr-2 h-4 w-4" aria-hidden />
                        Déplacer
                      </DropdownItem>
                    </>
                  )}
                  {canDelete && (
                    <>
                      {canManage && <DropdownSeparator />}
                      <DropdownItem onSelect={() => onDelete(dossier)}>
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                        Supprimer
                      </DropdownItem>
                    </>
                  )}
                </Dropdown>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
