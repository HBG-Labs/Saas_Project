import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useToast } from '@/components/feedback/toast-context';
import { Button, Input, Modal } from '@/components/ui';
import { SelectField } from '@/components/ui/SelectField';
import { qk } from '@/lib/query-keys';
import type { DocumentFolder } from '@/types/domain';

import { compterContenuDossier } from '../api/documents.api';
import { destinationsPossibles } from '../folder-tree';
import { useDocumentMutations } from '../hooks/useDocuments';

/**
 * Ce que l'utilisateur a demandé sur un dossier.
 *
 * Une union plutôt qu'un booléen `mode` accompagné de champs facultatifs :
 * « créer » a besoin d'un parent et pas de dossier, « renommer » et « déplacer »
 * l'inverse. Les rendre optionnels tous les deux autoriserait la combinaison
 * absurde — créer en renommant — et forcerait un `!` à chaque lecture.
 */
export type DemandeDossier =
  | { mode: 'creer'; parentFolderId: string | null }
  | { mode: 'renommer'; folder: DocumentFolder }
  | { mode: 'deplacer'; folder: DocumentFolder }
  | { mode: 'supprimer'; folder: DocumentFolder };

export interface FolderDialogProps {
  demande: DemandeDossier | null;
  folders: DocumentFolder[];
  organizationId: string;
  createdBy: string;
  onOpenChange: (open: boolean) => void;
  /** Appelé quand le dossier ouvert vient d'être supprimé. */
  onDeleted?: (folderId: string) => void;
}

export function FolderDialog({
  demande,
  folders,
  organizationId,
  createdBy,
  onOpenChange,
  onDeleted,
}: FolderDialogProps) {
  if (demande === null) return null;

  if (demande.mode === 'supprimer') {
    return (
      <SuppressionDossier
        key={demande.folder.id}
        folder={demande.folder}
        onOpenChange={onOpenChange}
        {...(onDeleted ? { onDeleted } : {})}
      />
    );
  }

  // La clé remonte le formulaire d'une demande à l'autre : les champs partent
  // des valeurs de la demande, sans effet chargé de les recopier après coup.
  const cle =
    demande.mode === 'creer'
      ? `creer-${demande.parentFolderId ?? 'racine'}`
      : `${demande.mode}-${demande.folder.id}`;

  return (
    <FormulaireDossier
      key={cle}
      demande={demande}
      folders={folders}
      organizationId={organizationId}
      createdBy={createdBy}
      onOpenChange={onOpenChange}
    />
  );
}

interface FormulaireProps {
  demande: Exclude<DemandeDossier, { mode: 'supprimer' }>;
  folders: DocumentFolder[];
  organizationId: string;
  createdBy: string;
  onOpenChange: (open: boolean) => void;
}

function FormulaireDossier({
  demande,
  folders,
  organizationId,
  createdBy,
  onOpenChange,
}: FormulaireProps) {
  const toast = useToast();
  const { addFolder, updateFolder } = useDocumentMutations();

  const [nom, setNom] = useState(demande.mode === 'creer' ? '' : demande.folder.name);
  const [parent, setParent] = useState<string>(
    demande.mode === 'creer'
      ? (demande.parentFolderId ?? '')
      : (demande.folder.parent_folder_id ?? ''),
  );

  // Un dossier ne peut pas descendre de lui-même ni de ses propres
  // sous-dossiers : `destinationsPossibles` les retire. Le serveur refuserait
  // de toute façon — proposer une action vouée à l'échec est une faute
  // d'interface, pas une sécurité en moins.
  const destinations = destinationsPossibles(
    folders,
    demande.mode === 'deplacer' ? demande.folder.id : undefined,
  );

  const nomInvalide = nom.trim() === '';
  const enCours = addFolder.isPending || updateFolder.isPending;

  async function enregistrer() {
    if (nomInvalide || enCours) return;

    try {
      if (demande.mode === 'creer') {
        await addFolder.mutateAsync({
          organizationId,
          name: nom,
          createdBy,
          parentFolderId: parent === '' ? null : parent,
        });
        toast.succes('Dossier créé');
      } else {
        await updateFolder.mutateAsync({
          folderId: demande.folder.id,
          patch:
            demande.mode === 'renommer'
              ? { name: nom }
              : { parent_folder_id: parent === '' ? null : parent },
        });
        toast.succes(demande.mode === 'renommer' ? 'Dossier renommé' : 'Dossier déplacé');
      }
      onOpenChange(false);
    } catch {
      // Le message du serveur — cycle, profondeur, dossier homonyme — n'est pas
      // présentable tel quel ; ce qui suit couvre les trois cas.
      toast.erreur(
        'Action impossible',
        'Vérifiez que le nom est libre à cet endroit et que la destination n’est pas un sous-dossier de celui déplacé.',
      );
    }
  }

  const titres: Record<typeof demande.mode, string> = {
    creer: 'Nouveau dossier',
    renommer: 'Renommer le dossier',
    deplacer: 'Déplacer le dossier',
  };

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={titres[demande.mode]}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enCours}>
            Annuler
          </Button>
          <Button
            onClick={() => void enregistrer()}
            disabled={enCours || (demande.mode !== 'deplacer' && nomInvalide)}
          >
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {demande.mode !== 'deplacer' && (
          <Input
            label="Nom du dossier"
            value={nom}
            onChange={(event) => setNom(event.target.value)}
            placeholder="Notices constructeur"
            {...(nomInvalide ? { error: 'Le nom ne peut pas être vide.' } : {})}
          />
        )}

        {demande.mode !== 'renommer' && (
          <SelectField
            label={demande.mode === 'creer' ? 'Créer dans' : 'Déplacer vers'}
            value={parent}
            onChange={(event) => setParent(event.target.value)}
          >
            {destinations.map((option) => (
              <option key={option.id ?? 'racine'} value={option.id ?? ''}>
                {option.chemin}
              </option>
            ))}
          </SelectField>
        )}
      </div>
    </Modal>
  );
}

interface SuppressionProps {
  folder: DocumentFolder;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (folderId: string) => void;
}

/**
 * Supprimer un dossier ne détruit rien — et c'est précisément ce qu'il faut
 * dire.
 *
 * Les clés étrangères sont en `on delete set null` : les sous-dossiers
 * remontent d'un niveau, les documents se retrouvent hors dossier. Rien n'est
 * perdu, mais tout DISPARAÎT de l'écran d'où l'on vient — et un utilisateur qui
 * voit trente documents s'évanouir conclut à une perte. Les comptes sont donc
 * lus avant, et annoncés.
 */
function SuppressionDossier({ folder, onOpenChange, onDeleted }: SuppressionProps) {
  const toast = useToast();
  const { removeFolder } = useDocumentMutations();

  const contenu = useQuery({
    queryKey: qk.documents.folderContent(folder.id),
    queryFn: () => compterContenuDossier(folder.id),
  });

  async function confirmer() {
    if (removeFolder.isPending) return;
    try {
      await removeFolder.mutateAsync(folder.id);
      toast.succes('Dossier supprimé');
      onDeleted?.(folder.id);
      onOpenChange(false);
    } catch {
      toast.erreur('Suppression impossible', 'Vérifiez vos droits, puis réessayez.');
    }
  }

  const total = (contenu.data?.sousDossiers ?? 0) + (contenu.data?.documents ?? 0);

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={`Supprimer « ${folder.name} » ?`}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={removeFolder.isPending}
          >
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={() => void confirmer()}
            disabled={removeFolder.isPending || contenu.isPending}
          >
            {removeFolder.isPending ? 'Suppression…' : 'Supprimer le dossier'}
          </Button>
        </div>
      }
    >
      {contenu.isPending ? (
        <p className="text-muted-foreground text-sm">Vérification du contenu…</p>
      ) : total === 0 ? (
        <p className="text-muted-foreground text-sm">Ce dossier est vide.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="text-foreground">Ce dossier n’est pas vide :</p>
          <ul className="text-muted-foreground list-inside list-disc">
            {(contenu.data?.sousDossiers ?? 0) > 0 && (
              <li>
                {contenu.data?.sousDossiers} sous-dossier
                {(contenu.data?.sousDossiers ?? 0) > 1 ? 's' : ''}
              </li>
            )}
            {(contenu.data?.documents ?? 0) > 0 && (
              <li>
                {contenu.data?.documents} document
                {(contenu.data?.documents ?? 0) > 1 ? 's' : ''}
              </li>
            )}
          </ul>
          <p className="text-muted-foreground">
            Rien n’est supprimé : les sous-dossiers remontent d’un niveau et les documents se
            retrouvent à la racine de la bibliothèque.
          </p>
        </div>
      )}
    </Modal>
  );
}
