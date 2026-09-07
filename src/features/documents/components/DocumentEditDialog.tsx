import { useState } from 'react';

import { useToast } from '@/components/feedback/toast-context';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { SelectField } from '@/components/ui/SelectField';
import type { DocumentFolder, OrganizationDocument } from '@/types/domain';

import { destinationsPossibles } from '../folder-tree';
import { useDocumentMutations } from '../hooks/useDocuments';

export interface DocumentEditDialogProps {
  document: OrganizationDocument | null;
  folders: DocumentFolder[];
  onOpenChange: (open: boolean) => void;
}

/**
 * Renommer, déplacer, décrire.
 *
 * Les trois tiennent dans la même fenêtre parce qu'ils touchent la même ligne et
 * qu'aucun ne touche le fichier : le chemin Storage ne change jamais après le
 * dépôt. Déplacer un document est donc une écriture SQL, pas un transfert.
 */
export function DocumentEditDialog({ document, folders, onOpenChange }: DocumentEditDialogProps) {
  if (document === null) return null;

  // La cle remonte le formulaire d'un document a l'autre : les champs partent
  // des valeurs du document, sans effet charge de les recopier apres coup.
  return (
    <Formulaire
      key={document.id}
      document={document}
      folders={folders}
      onOpenChange={onOpenChange}
    />
  );
}

function Formulaire({
  document,
  folders,
  onOpenChange,
}: {
  document: OrganizationDocument;
  folders: DocumentFolder[];
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const { update } = useDocumentMutations();

  const [nom, setNom] = useState(document.name);
  const [description, setDescription] = useState(document.description ?? '');
  const [categorie, setCategorie] = useState(document.category ?? '');
  const [dossier, setDossier] = useState(document.folder_id ?? '');

  const nomInvalide = nom.trim() === '';

  async function enregistrer() {
    if (nomInvalide || update.isPending) return;
    const renomme = nom.trim() !== document.name;
    const deplace = (dossier === '' ? null : dossier) !== document.folder_id;

    try {
      await update.mutateAsync({
        documentId: document.id,
        patch: {
          name: nom,
          description: description.trim() === '' ? null : description,
          category: categorie.trim() === '' ? null : categorie,
          folder_id: dossier === '' ? null : dossier,
        },
      });
      toast.succes(renomme ? 'Document renommé' : deplace ? 'Document déplacé' : 'Document mis à jour');
      onOpenChange(false);
    } catch {
      toast.erreur('Modification impossible', 'Réessayez dans un instant.');
    }
  }

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title="Modifier le document"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Annuler
          </Button>
          <Button onClick={() => void enregistrer()} disabled={nomInvalide || update.isPending}>
            {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nom du document"
          value={nom}
          onChange={(event) => setNom(event.target.value)}
          {...(nomInvalide ? { error: 'Le nom ne peut pas être vide.' } : {})}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Catégorie"
            value={categorie}
            onChange={(event) => setCategorie(event.target.value)}
          />
          {/*
            Le chemin complet, pas le seul nom : deux dossiers « Plans » dans
            deux branches différentes sont indiscernables autrement.
          */}
          <SelectField
            label="Dossier"
            value={dossier}
            onChange={(event) => setDossier(event.target.value)}
          >
            {destinationsPossibles(folders).map((option) => (
              <option key={option.id ?? 'racine'} value={option.id ?? ''}>
                {option.chemin}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
    </Modal>
  );
}
