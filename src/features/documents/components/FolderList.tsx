import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui';
import type { DocumentFolder } from '@/types/domain';

import { cheminDe, enfantsDe } from '../folder-tree';

export interface FolderBreadcrumbProps {
  folders: DocumentFolder[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

/**
 * Le fil d'Ariane, et le bouton pour remonter.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN LIEN QUI NE RESSEMBLE PAS À UN LIEN N'EXISTE PAS
 *
 * La première version rendait bien « Bibliothèque » cliquable — en gris, sans
 * soulignement, sans curseur distinct. Elle se lisait comme un titre, et la
 * question « comment je reviens en arrière ? » restait entière. Une fonction
 * qu'on ne devine pas vaut une fonction absente.
 *
 * D'où deux choses plutôt qu'une : les ancêtres prennent l'apparence de liens,
 * et un bouton « remonter » explicite précède le fil. Ce bouton n'est pas un
 * doublon : il porte une cible tactile pleine hauteur, atteignable au pouce
 * avec des gants, là où un mot de douze pixels ne l'est pas.
 *
 * Le dossier courant, lui, n'est plus un bouton. Il ne menait nulle part : un
 * élément qui réagit au survol puis ne fait rien apprend à se méfier des autres.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sur téléphone, le fil défile horizontalement plutôt que de passer à la ligne
 * — une arborescence profonde repousserait sinon le contenu sous la ligne de
 * flottaison. Le bouton « remonter », lui, ne défile pas.
 */
export function FolderBreadcrumb({
  folders,
  currentFolderId,
  onNavigate,
}: FolderBreadcrumbProps) {
  const chemin = cheminDe(folders, currentFolderId);
  const parent = chemin.length >= 2 ? (chemin[chemin.length - 2]?.id ?? null) : null;

  const lien =
    'hover:text-foreground rounded-md px-2 py-1 transition-colors hover:underline cursor-pointer';

  return (
    <div className="flex items-center gap-2">
      {currentFolderId !== null && (
        <button
          type="button"
          onClick={() => onNavigate(parent)}
          aria-label="Remonter d’un dossier"
          className="border-border text-muted-foreground hover:bg-muted hover:text-foreground h-touch inline-flex w-11 shrink-0 items-center justify-center rounded-md border transition-colors sm:h-9 sm:w-9"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
      )}

      {/*
        `overflow-y-hidden` ET `no-scrollbar` NE SONT PAS DÉCORATIFS.

        Dès qu'un axe cesse d'être `visible`, la specification fait passer
        l'AUTRE de `visible` à `auto`. `overflow-x-auto` seul rendait donc le
        fil d'Ariane scrollable verticalement, et la moindre fraction de pixel
        de dépassement — un arrondi de hauteur de ligne suffit — y faisait
        apparaître une barre de défilement verticale : deux petites flèches
        empilées, juste après « Bibliothèque », que l'on prend pour un bouton.

        `no-scrollbar` est la convention déjà suivie par tous les rubans
        horizontaux du produit (onglets Stock, Achats, Missions, Équipes). Ne
        pas la reprendre ici est précisément ce qui a rendu le défaut visible
        sur ce seul écran.

        Le défilement horizontal, lui, reste voulu : une arborescence profonde
        doit défiler plutôt que repousser le contenu sous la ligne de flottaison.
      */}
      <nav
        aria-label="Fil d’Ariane"
        className="no-scrollbar -mx-1 min-w-0 overflow-x-auto overflow-y-hidden"
      >
        <ol className="text-muted-foreground flex items-center gap-1 px-1 text-sm whitespace-nowrap">
          <li>
            {currentFolderId === null ? (
              <span aria-current="page" className="text-foreground px-2 py-1 font-medium">
                Bibliothèque
              </span>
            ) : (
              <button type="button" onClick={() => onNavigate(null)} className={lien}>
                Bibliothèque
              </button>
            )}
          </li>

          {chemin.map((dossier, index) => {
            const courant = index === chemin.length - 1;
            return (
              <li key={dossier.id} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                {courant ? (
                  <span aria-current="page" className="text-foreground px-2 py-1 font-medium">
                    {dossier.name}
                  </span>
                ) : (
                  <button type="button" onClick={() => onNavigate(dossier.id)} className={lien}>
                    {dossier.name}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
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
                {/*
                  Icône PLEINE et colorée, là où les documents portent une
                  icône fine. C'est ce qui sépare le contenant du contenu au
                  premier coup d'œil : avant, la carte « Cuivre » et la ligne
                  d'un fichier partageaient le même gris et le même trait, et
                  l'œil devait lire pour savoir sur quoi il allait cliquer.
                */}
                <Folder className="text-primary fill-primary/15 h-5 w-5 shrink-0" aria-hidden />
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
