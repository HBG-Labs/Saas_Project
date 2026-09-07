import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge, Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui';
import type { DocumentFolder, OrganizationDocument } from '@/types/domain';

import { familleDeDocument, formaterTaille, type FamilleDocument } from '../constants';

const ICONES: Record<FamilleDocument, LucideIcon> = {
  pdf: FileText,
  image: FileImage,
  document: FileText,
  tableur: FileSpreadsheet,
  autre: FileText,
};

const LIBELLES: Record<FamilleDocument, string> = {
  pdf: 'PDF',
  image: 'Image',
  document: 'Document',
  tableur: 'Tableur',
  autre: 'Fichier',
};

export interface DocumentListProps {
  documents: OrganizationDocument[];
  folders: DocumentFolder[];
  canManage: boolean;
  canDelete: boolean;
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
          const famille = familleDeDocument(document.mime_type);
          const Icone = ICONES[famille];
          const dossier = nomDossier(document.folder_id);
          return (
            <li
              key={document.id}
              className="border-border bg-card flex items-center gap-3 rounded-lg border p-3"
            >
              <Icone className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
              <button
                type="button"
                onClick={() => onOpen(document)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-foreground truncate text-sm font-medium">{document.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {LIBELLES[famille]} · {formaterTaille(document.file_size)}
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
              <th className="px-4 py-3 text-left font-medium">Dossier</th>
              <th className="px-4 py-3 text-left font-medium">Ajouté le</th>
              <th className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {documents.map((document) => {
              const famille = familleDeDocument(document.mime_type);
              const Icone = ICONES[famille];
              const dossier = nomDossier(document.folder_id);
              return (
                <tr key={document.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(document)}
                      className="flex items-center gap-2 text-left"
                    >
                      <Icone className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                      <span className="text-foreground font-medium">{document.name}</span>
                    </button>
                    {document.description !== null && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 pl-6 text-xs">
                        {document.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral">{LIBELLES[famille]}</Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formaterTaille(document.file_size)}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {dossier ?? <span className="opacity-60">—</span>}
                  </td>
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
