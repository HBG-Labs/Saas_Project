import {
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
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
  /**
   * Partage avec le portail client. Absent : la formule ou la permission ne le
   * permettent pas, et le menu n'en parle pas. Le trigger
   * `guard_document_share_update` rejuge `client_content.share`.
   */
  onToggleShare?: ((document: OrganizationDocument) => void) | undefined;
  /** Nombre de clients avec lesquels chaque document est partagé (partage ciblé). */
  sharedCustomerCounts?: ReadonlyMap<string, number> | undefined;
}

/** Libellé de la portée d'un document, ou `null` s'il est interne. */
function porteeDePartage(document: OrganizationDocument, cibles: number): string | null {
  if (document.shared_with_client) return 'Tous les clients';
  if (cibles > 0) return `${cibles} client${cibles > 1 ? 's' : ''}`;
  return null;
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
  onToggleShare,
  sharedCustomerCounts,
}: DocumentListProps) {
  const portee = (document: OrganizationDocument) =>
    porteeDePartage(document, sharedCustomerCounts?.get(document.id) ?? 0);
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
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none sm:h-9 sm:w-9"
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
        {onToggleShare !== undefined && (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={() => onToggleShare(document)}>
              <Users className="mr-2 h-4 w-4" aria-hidden />
              Partager avec des clients…
            </DropdownItem>
          </>
        )}
        {canDelete && (
          <>
            <DropdownSeparator />
            <DropdownItem className="text-error" onSelect={() => onDelete(document)}>
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
      <ul className="space-y-2.5 md:hidden">
        {documents.map((document) => {
          const apparence = APPARENCE[familleDeDocument(document.mime_type)];
          const Icone = apparence.icone;
          const dossier = nomDossier(document.folder_id);
          return (
            <li
              key={document.id}
              className="border-border bg-card shadow-xs hover:border-primary/30 flex items-start gap-3 rounded-xl border p-3.5 transition-[border-color,box-shadow]"
            >
              <span className="bg-surface-sunken flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Icone className={`h-5 w-5 ${apparence.couleur}`} aria-hidden />
              </span>
              <button
                type="button"
                onClick={() => onOpen(document)}
                className="focus-visible:ring-ring min-w-0 flex-1 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
              >
                <p className="text-foreground truncate text-sm font-medium">{document.name}</p>
                {document.description !== null && (
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                    {document.description}
                  </p>
                )}
                {portee(document) !== null && (
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="info">
                      <Users className="mr-0.5 h-3 w-3" aria-hidden />
                      {portee(document)}
                    </Badge>
                  </span>
                )}
                <span className="text-muted-foreground mt-2 block truncate text-xs">
                  {apparence.libelle} · {formaterTaille(document.file_size)} ·{' '}
                  {dateCourte(document.created_at)}
                  {dossier !== null && ` · ${dossier}`}
                </span>
              </button>
              {menu(document)}
            </li>
          );
        })}
      </ul>

      {/* Écran large : tableau. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- la liste horizontale doit être défilable au clavier */}
      <div className="border-border bg-card shadow-xs focus-visible:ring-ring hidden overflow-x-auto rounded-xl border focus-visible:ring-2 focus-visible:outline-none md:block" role="region" aria-label="Liste des documents" tabIndex={0}>
        <table className="min-w-[720px] w-full text-sm">
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
                <tr key={document.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(document)}
                      className="focus-visible:ring-ring flex max-w-[32rem] min-w-0 items-center gap-2 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Icone className={`h-4 w-4 shrink-0 ${apparence.couleur}`} aria-hidden />
                      <span className="text-foreground truncate font-medium">{document.name}</span>
                    </button>
                    {document.description !== null && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 pl-6 text-xs">
                        {document.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <Badge variant={apparence.badge}>{apparence.libelle}</Badge>
                      {portee(document) !== null && (
                        <Badge variant="info">
                          <Users className="mr-1 h-3 w-3" aria-hidden />
                          {portee(document)}
                        </Badge>
                      )}
                    </span>
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
