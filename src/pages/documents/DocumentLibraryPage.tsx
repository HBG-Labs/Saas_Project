import { FolderOpen, FolderPlus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/toast-context';
import { Button, Input, ListSkeleton, Modal } from '@/components/ui';
import {
  DocumentEditDialog,
  DocumentList,
  DocumentPreviewDialog,
  DocumentUploadDialog,
  FILTRES_FAMILLE,
  FolderBreadcrumb,
  FolderDialog,
  FolderGrid,
  getDocumentDownloadUrl,
  useDocumentFolders,
  useDocumentMutations,
  useDocuments,
  DOCUMENTS_PAR_PAGE,
  cheminDe,
  enfantsDe,
  type DemandeDossier,
  type FiltreFamille,
} from '@/features/documents';
import { useAuth } from '@/features/auth';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import type { OrganizationDocument } from '@/types/domain';

/**
 * Bibliothèque documentaire de l'organisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX MODES, ET UN SEUL ÉCRAN
 *
 * Sans recherche, on NAVIGUE : un dossier à la fois, ses sous-dossiers puis ses
 * documents. Avec une recherche, on CHERCHE : le filtre de dossier est levé et
 * toute la bibliothèque est fouillée. C'est ce qu'attend quelqu'un qui tape un
 * nom — chercher « dans le dossier courant seulement » oblige à savoir où l'on
 * a rangé, ce qui est précisément la question qu'on se pose.
 *
 * Recherche, filtres et pagination sont résolus par la base : à plusieurs
 * milliers de documents, tout rapatrier pour en montrer vingt-quatre coûterait
 * à chaque ouverture. Aucune URL signée n'est produite ici — seulement à
 * l'ouverture d'un document.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function DocumentLibraryPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const [search, setSearch] = useState('');
  const [famille, setFamille] = useState<FiltreFamille>('tous');
  const [dossierCourant, setDossierCourant] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [depotOuvert, setDepotOuvert] = useState(false);
  const [demandeDossier, setDemandeDossier] = useState<DemandeDossier | null>(null);
  const [apercu, setApercu] = useState<OrganizationDocument | null>(null);
  const [edition, setEdition] = useState<OrganizationDocument | null>(null);
  const [suppression, setSuppression] = useState<OrganizationDocument | null>(null);

  const canManage = can(PERMISSIONS.documentManage);
  const canDelete = can(PERMISSIONS.documentDelete);

  const recherche = search.trim();
  const enRecherche = recherche !== '';

  const filtres = useMemo(
    () => ({
      search,
      famille,
      // En recherche, le dossier courant ne filtre plus : on fouille tout.
      folderId: enRecherche ? undefined : dossierCourant,
      page,
    }),
    [search, famille, dossierCourant, page, enRecherche],
  );

  const documentsQuery = useDocuments(organizationId, filtres);
  const foldersQuery = useDocumentFolders(organizationId);
  const { remove } = useDocumentMutations();

  const documents = documentsQuery.data?.documents ?? [];
  const total = documentsQuery.data?.total ?? 0;
  const folders = foldersQuery.data ?? [];
  const pages = Math.max(1, Math.ceil(total / DOCUMENTS_PAR_PAGE));
  const filtreActif = enRecherche || famille !== 'tous';
  const sousDossiers = enRecherche ? [] : enfantsDe(folders, dossierCourant);

  function changerFiltre(appliquer: () => void) {
    appliquer();
    setPage(0);
  }

  function ouvrirDossier(folderId: string | null) {
    changerFiltre(() => {
      setDossierCourant(folderId);
      setSearch('');
    });
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

  /** Le dossier supprimé était peut-être celui qu'on regarde : on remonte. */
  function apresSuppressionDossier(folderId: string) {
    if (cheminDe(folders, dossierCourant).some((d) => d.id === folderId)) {
      setDossierCourant(null);
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() =>
                setDemandeDossier({ mode: 'creer', parentFolderId: dossierCourant })
              }
              className="w-full sm:w-auto"
            >
              <FolderPlus className="mr-2 h-4 w-4" aria-hidden />
              Nouveau dossier
            </Button>
            <Button onClick={() => setDepotOuvert(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Ajouter des documents
            </Button>
          </div>
        )}
      </header>

      <FolderBreadcrumb
        folders={folders}
        currentFolderId={enRecherche ? null : dossierCourant}
        onNavigate={ouvrirDossier}
      />

      <div className="space-y-3">
        <Input
          label="Rechercher"
          hideLabel
          placeholder="Rechercher dans toute la bibliothèque…"
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
        </div>

        {enRecherche && (
          <p className="text-muted-foreground text-xs">
            La recherche porte sur toute la bibliothèque, tous dossiers confondus.
          </p>
        )}
      </div>

      <FolderGrid
        folders={folders}
        currentFolderId={dossierCourant}
        canManage={canManage}
        canDelete={canDelete}
        onOpen={ouvrirDossier}
        onRename={(folder) => setDemandeDossier({ mode: 'renommer', folder })}
        onMove={(folder) => setDemandeDossier({ mode: 'deplacer', folder })}
        onDelete={(folder) => setDemandeDossier({ mode: 'supprimer', folder })}
      />

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
        // Un dossier qui ne contient que des sous-dossiers n'est pas « vide » :
        // le dire afficherait le contraire de ce que l'écran montre juste
        // au-dessus.
        sousDossiers.length > 0 ? null : (
          <EmptyState
            icon={FolderOpen}
            title={filtreActif ? 'Aucun document ne correspond' : 'Aucun document ici'}
            description={
              filtreActif
                ? 'Modifiez votre recherche ou vos filtres pour élargir les résultats.'
                : 'Ajoutez des documents techniques, procédures, plans ou notices utiles à votre équipe.'
            }
            action={
              filtreActif ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    changerFiltre(() => {
                      setSearch('');
                      setFamille('tous');
                    })
                  }
                >
                  Réinitialiser les filtres
                </Button>
              ) : canManage ? (
                <Button onClick={() => setDepotOuvert(true)}>Ajouter des documents</Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <DocumentList
            documents={documents}
            folders={folders}
            canManage={canManage}
            canDelete={canDelete}
            // Hors recherche, la colonne « Dossier » répète le dossier courant
            // sur chaque ligne, ou affiche « — » partout à la racine. En
            // recherche, elle devient la seule indication d'OÙ se trouve le
            // résultat — c'est là, et seulement là, qu'elle vaut sa place.
            showFolderColumn={enRecherche}
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
        <>
          <DocumentUploadDialog
            open={depotOuvert}
            onOpenChange={setDepotOuvert}
            organizationId={organizationId}
            uploadedBy={user.id}
            folders={folders}
            defaultFolderId={dossierCourant}
          />

          <FolderDialog
            demande={demandeDossier}
            folders={folders}
            organizationId={organizationId}
            createdBy={user.id}
            onOpenChange={() => setDemandeDossier(null)}
            onDeleted={apresSuppressionDossier}
          />
        </>
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
