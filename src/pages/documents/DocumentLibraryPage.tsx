import { FolderOpen, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/toast-context';
import { Button, Input, ListSkeleton, Modal } from '@/components/ui';
import { SelectField } from '@/components/ui/SelectField';
import {
  DocumentEditDialog,
  DocumentList,
  DocumentPreviewDialog,
  DocumentUploadDialog,
  FILTRES_FAMILLE,
  getDocumentDownloadUrl,
  useDocumentFolders,
  useDocumentMutations,
  useDocuments,
  DOCUMENTS_PAR_PAGE,
  type FiltreFamille,
} from '@/features/documents';
import { useAuth } from '@/features/auth';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import type { OrganizationDocument } from '@/types/domain';

/**
 * Bibliothèque documentaire de l'organisation.
 *
 * Recherche, filtres et pagination sont résolus par la base : à plusieurs
 * milliers de documents, tout rapatrier pour en montrer vingt-quatre coûterait
 * à chaque ouverture. Aucune URL signée n'est produite ici — seulement à
 * l'ouverture d'un document.
 */
export default function DocumentLibraryPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const [search, setSearch] = useState('');
  const [famille, setFamille] = useState<FiltreFamille>('tous');
  const [dossier, setDossier] = useState<string>('tous');
  const [page, setPage] = useState(0);

  const [depotOuvert, setDepotOuvert] = useState(false);
  const [apercu, setApercu] = useState<OrganizationDocument | null>(null);
  const [edition, setEdition] = useState<OrganizationDocument | null>(null);
  const [suppression, setSuppression] = useState<OrganizationDocument | null>(null);

  const canManage = can(PERMISSIONS.documentManage);
  const canDelete = can(PERMISSIONS.documentDelete);

  const filtres = useMemo(
    () => ({
      search,
      famille,
      folderId: dossier === 'tous' ? undefined : dossier === 'aucun' ? null : dossier,
      page,
    }),
    [search, famille, dossier, page],
  );

  const documentsQuery = useDocuments(organizationId, filtres);
  const foldersQuery = useDocumentFolders(organizationId);
  const { remove } = useDocumentMutations();

  const documents = documentsQuery.data?.documents ?? [];
  const total = documentsQuery.data?.total ?? 0;
  const folders = foldersQuery.data ?? [];
  const pages = Math.max(1, Math.ceil(total / DOCUMENTS_PAR_PAGE));
  const filtreActif = search.trim() !== '' || famille !== 'tous' || dossier !== 'tous';

  function changerFiltre(appliquer: () => void) {
    appliquer();
    setPage(0);
  }

  async function telecharger(document: OrganizationDocument) {
    try {
      const lien = await getDocumentDownloadUrl(document.storage_path, document.name);
      window.open(lien, '_blank', 'noopener,noreferrer');
    } catch {
      toast.erreur('Téléchargement impossible', 'Réessayez dans un instant.');
    }
  }

  async function confirmerSuppression() {
    if (suppression === null || remove.isPending) return;
    try {
      await remove.mutateAsync(suppression);
      toast.succes('Document supprimé');
      setSuppression(null);
    } catch {
      toast.erreur('Suppression impossible', 'Vérifiez vos droits, puis réessayez.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Bibliothèque</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Documents partagés avec votre organisation
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setDepotOuvert(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Ajouter un document
          </Button>
        )}
      </header>

      <div className="space-y-3">
        <Input
          label="Rechercher"
          hideLabel
          placeholder="Rechercher un document..."
          value={search}
          onChange={(event) => changerFiltre(() => setSearch(event.target.value))}
        />

        <div className="flex flex-wrap items-center gap-2">
          {FILTRES_FAMILLE.map((option) => (
            <Button
              key={option.valeur}
              size="sm"
              variant={famille === option.valeur ? 'primary' : 'outline'}
              onClick={() => changerFiltre(() => setFamille(option.valeur))}
            >
              {option.label}
            </Button>
          ))}

          {folders.length > 0 && (
            <SelectField
              label="Dossier"
              hideLabel
              value={dossier}
              onChange={(event) => changerFiltre(() => setDossier(event.target.value))}
              className="ml-auto w-full sm:w-52"
            >
              <option value="tous">Tous les dossiers</option>
              <option value="aucun">Sans dossier</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      </div>

      {documentsQuery.isPending ? (
        <ListSkeleton />
      ) : documentsQuery.isError ? (
        <EmptyState
          icon={FolderOpen}
          title="La bibliothèque n’a pas pu être chargée"
          description="Vérifiez votre connexion, puis réessayez."
          action={<Button onClick={() => void documentsQuery.refetch()}>Réessayer</Button>}
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={filtreActif ? 'Aucun document ne correspond' : 'Aucun document partagé'}
          description={
            filtreActif
              ? 'Modifiez votre recherche ou vos filtres pour élargir les résultats.'
              : 'Ajoutez des documents techniques, procédures, plans, notices ou autres fichiers utiles à votre équipe.'
          }
          action={
            filtreActif ? (
              <Button
                variant="outline"
                onClick={() =>
                  changerFiltre(() => {
                    setSearch('');
                    setFamille('tous');
                    setDossier('tous');
                  })
                }
              >
                Réinitialiser les filtres
              </Button>
            ) : canManage ? (
              <Button onClick={() => setDepotOuvert(true)}>Ajouter un document</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DocumentList
            documents={documents}
            folders={folders}
            canManage={canManage}
            canDelete={canDelete}
            onOpen={setApercu}
            onDownload={(document) => void telecharger(document)}
            onEdit={setEdition}
            onDelete={setSuppression}
          />

          {pages > 1 && (
            <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
              <p className="text-muted-foreground text-sm">
                {total} document{total > 1 ? 's' : ''} · page {page + 1} sur {pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      {organizationId !== null && user !== null && (
        <DocumentUploadDialog
          open={depotOuvert}
          onOpenChange={setDepotOuvert}
          organizationId={organizationId}
          uploadedBy={user.id}
          folders={folders}
          defaultFolderId={dossier === 'tous' || dossier === 'aucun' ? null : dossier}
        />
      )}

      <DocumentPreviewDialog document={apercu} onOpenChange={() => setApercu(null)} />
      <DocumentEditDialog
        document={edition}
        folders={folders}
        onOpenChange={() => setEdition(null)}
      />

      {suppression !== null && (
        <Modal
          open
          onOpenChange={() => setSuppression(null)}
          title="Supprimer ce document ?"
          description={`« ${suppression.name} » sera retiré de la bibliothèque pour toute l’organisation. Cette action est définitive.`}
          size="sm"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => setSuppression(null)}
                disabled={remove.isPending}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={() => void confirmerSuppression()}
                disabled={remove.isPending}
              >
                {remove.isPending ? 'Suppression…' : 'Supprimer'}
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}
