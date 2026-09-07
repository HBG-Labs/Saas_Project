import {
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge, Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui';
import type { BadgeProps } from '@/components/ui/Badge';
import type { DocumentFolder, OrganizationDocument } from '@/types/domain';

import { familleDeDocument, formaterTaille, type FamilleDocument } from '../constants';

/**
 * Apparence d'une famille de documents.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE LA COULEUR QUI RENSEIGNE, PAS QUI DÉCORE
 *
 * Les cinq familles partageaient une icône grise et un badge neutre : sur
 * quarante lignes, retrouver le PDF demandait de LIRE chaque libellé. Le rouge
 * du PDF et le vert du tableur ne sont pas un choix esthétique, ce sont les
 * conventions d'Explorer et de Drive — le lecteur les connaît déjà.
 *
 * Même forme que `ATTACHMENT_KINDS` dans `AttachmentGallery` — icône, couleur
 * et variante de badge au même endroit — et mêmes jetons sémantiques que le
 * reste du produit. La bibliothèque était le dernier écran de liste à les
 * ignorer.
 * ─────────────────────────────────────────────────────────────────────────────
 */
interface ApparenceFamille {
  icone: LucideIcon;
  couleur: string;
  badge: BadgeProps['variant'];
  libelle: string;
}

const APPARENCE: Record<FamilleDocument, ApparenceFamille> = {
  pdf: { icone: FileText, couleur: 'text-error', badge: 'error', libelle: 'PDF' },
  image: { icone: FileImage, couleur: 'text-accent', badge: 'accent', libelle: 'Image' },
  document: { icone: FileText, couleur: 'text-info', badge: 'info', libelle: 'Document' },
  tableur: {
    icone: FileSpreadsheet,
    couleur: 'text-success',
    badge: 'success',
    libelle: 'Tableur',
  },
  autre: { icone: File, couleur: 'text-muted-foreground', badge: 'neutral', libelle: 'Fichier' },
};

export interface DocumentListProps {
  documents: OrganizationDocument[];
  folders: DocumentFolder[];
  canManage: boolean;
  canDelete: boolean;
  /**
   * N'a de sens qu'en recherche.
   *
   * Dans un dossier, la colonne répète son nom sur chaque ligne ; à la racine,
   * elle affiche « — » partout. Une colonne qui ne distingue rien occupe la
   * place de celles qui distinguent.
   */
  showFolderColumn: boolean;
  onOpen: (document: OrganizationDocument) => void;
  onDownload: (document: OrganizationDocument) => void;
  onEdit: (document: OrganizationDocument) => void;
  onDelete: (document: OrganizationDocument) => void;
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * La bibliothèque, en tableau sur écran large et en cartes sur téléphone.
 *
 * Ce n'est pas le même tableau rendu plus petit : sur un chantier, une ligne de
 * tableau à faire défiler horizontalement est inutilisable d'une main. Les
 * cartes portent le strict nécessaire — nom, type, taille, date — et la même
 * zone de menu, assez grande pour un pouce.
 */
export function DocumentList({
  documents,
  folders,
  canManage,
  canDelete,
  showFolderColumn,
  onOpen,
  onDownload,
  onEdit,
  onDelete,
}: DocumentListProps) {
  const nomDossier = (id: string | null) =>
    id === null ? null : (folders.find((f) => f.id === id)?.name ?? null);

  function menu(document: OrganizationDocument) {
    return (
      <Dropdown
        align="end"
        trigger={
          <button
            type="button"
            aria-label={`Actions pour ${document.name}`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        }
      >
        <DropdownItem onSelect={() => onOpen(document)}>Ouvrir</DropdownItem>
        <DropdownItem onSelect={() => onDownload(document)}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          Télécharger
        </DropdownItem>
        {canManage && (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={() => onEdit(document)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Renommer, déplacer…
            </DropdownItem>
          </>
        )}
        {canDelete && (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={() => onDelete(document)}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
              Supprimer
            </DropdownItem>
          </>
        )}
      </Dropdown>
    );
  }

  return (
    <>
      {/* Téléphone : cartes compactes. */}
      <ul className="space-y-2 md:hidden">
        {documents.map((document) => {
          const apparence = APPARENCE[familleDeDocument(document.mime_type)];
          const Icone = apparence.icone;
          const dossier = nomDossier(document.folder_id);
          return (
            <li
              key={document.id}
              className="border-border bg-card flex items-center gap-3 rounded-lg border p-3"
            >
              <Icone className={`h-5 w-5 shrink-0 ${apparence.couleur}`} aria-hidden />
              <button
                type="button"
                onClick={() => onOpen(document)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-foreground truncate text-sm font-medium">{document.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {apparence.libelle} · {formaterTaille(document.file_size)}
                  {dossier !== null && ` · ${dossier}`}
                </p>
              </button>
              {menu(document)}
            </li>
          );
        })}
      </ul>

      {/* Écran large : tableau. */}
      <div className="border-border hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nom</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Taille</th>
              {showFolderColumn && <th className="px-4 py-3 text-left font-medium">Dossier</th>}
              <th className="px-4 py-3 text-left font-medium">Ajouté le</th>
              <th className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {documents.map((document) => {
              const apparence = APPARENCE[familleDeDocument(document.mime_type)];
              const Icone = apparence.icone;
              const dossier = nomDossier(document.folder_id);
              return (
                <tr key={document.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(document)}
                      className="flex items-center gap-2 text-left"
                    >
                      <Icone className={`h-4 w-4 shrink-0 ${apparence.couleur}`} aria-hidden />
                      <span className="text-foreground font-medium">{document.name}</span>
                    </button>
                    {document.description !== null && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 pl-6 text-xs">
                        {document.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={apparence.badge}>{apparence.libelle}</Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formaterTaille(document.file_size)}
                  </td>
                  {showFolderColumn && (
                    <td className="text-muted-foreground px-4 py-3">
                      {dossier ?? <span className="opacity-60">—</span>}
                    </td>
                  )}
                  <td className="text-muted-foreground px-4 py-3">
                    {dateCourte(document.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">{menu(document)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
