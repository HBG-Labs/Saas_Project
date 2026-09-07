import { UploadCloud } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';

import { useToast } from '@/components/feedback/toast-context';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { SelectField } from '@/components/ui/SelectField';
import type { DocumentFolder } from '@/types/domain';

import { ACCEPT_FICHIER, TAILLE_MAX_LISIBLE, formaterTaille, verifierFichier } from '../constants';
import { useDocumentMutations } from '../hooks/useDocuments';

export interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  uploadedBy: string;
  folders: DocumentFolder[];
  /** Dossier pré-sélectionné, celui que l'utilisateur consultait. */
  defaultFolderId?: string | null;
}

/**
 * Dépôt d'un document.
 *
 * Le fichier est vérifié avant tout appel réseau — format et taille — pour
 * éviter un aller-retour voué à l'échec. Ce contrôle ne protège rien : le
 * bucket refuse de son côté, et c'est lui qui fait autorité.
 */
export function DocumentUploadDialog({
  open,
  onOpenChange,
  organizationId,
  uploadedBy,
  folders,
  defaultFolderId = null,
}: DocumentUploadDialogProps) {
  const toast = useToast();
  const { upload } = useDocumentMutations();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fichier, setFichier] = useState<File | null>(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [dossier, setDossier] = useState<string>(defaultFolderId ?? '');
  const [refus, setRefus] = useState<string | null>(null);
  const [surviens, setSurvient] = useState(false);

  function reinitialiser() {
    setFichier(null);
    setNom('');
    setDescription('');
    setCategorie('');
    setDossier(defaultFolderId ?? '');
    setRefus(null);
    setSurvient(false);
  }

  function accepter(candidat: File | undefined) {
    if (!candidat) return;
    const probleme = verifierFichier(candidat);
    if (probleme) {
      setRefus(probleme.message);
      setFichier(null);
      return;
    }
    setRefus(null);
    setFichier(candidat);
    // Le nom du fichier fait un premier titre acceptable, que l'on peut corriger.
    if (nom.trim() === '') setNom(candidat.name.replace(/\.[^.]+$/, ''));
  }

  function surDepot(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setSurvient(false);
    accepter(event.dataTransfer.files[0]);
  }

  async function soumettre() {
    if (!fichier || upload.isPending) return;

    try {
      await upload.mutateAsync({
        organizationId,
        file: fichier,
        name: nom.trim() === '' ? fichier.name : nom,
        uploadedBy,
        folderId: dossier === '' ? null : dossier,
        ...(description.trim() ? { description } : {}),
        ...(categorie.trim() ? { category: categorie } : {}),
      });
      toast.succes('Document ajouté');
      reinitialiser();
      onOpenChange(false);
    } catch {
      // Le détail Supabase ne dit rien d'actionnable à un utilisateur.
      toast.erreur(
        'Impossible d’ajouter le document',
        'Vérifiez le format et la taille, puis réessayez.',
      );
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(suivant) => {
        if (!suivant) reinitialiser();
        onOpenChange(suivant);
      }}
      title="Ajouter un document"
      description={`Formats acceptés : PDF, images, Word, Excel, CSV et texte. ${TAILLE_MAX_LISIBLE} maximum.`}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={upload.isPending}>
            Annuler
          </Button>
          <Button onClick={() => void soumettre()} disabled={!fichier || upload.isPending}>
            {upload.isPending ? 'Envoi en cours…' : 'Ajouter'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setSurvient(true);
          }}
          onDragLeave={() => setSurvient(false)}
          onDrop={surDepot}
          className={[
            'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            surviens ? 'border-primary bg-primary/5' : 'border-border',
          ].join(' ')}
        >
          <UploadCloud className="text-muted-foreground mx-auto mb-2 h-8 w-8" aria-hidden />
          {fichier ? (
            <p className="text-foreground text-sm font-medium">
              {fichier.name}{' '}
              <span className="text-muted-foreground font-normal">
                ({formaterTaille(fichier.size)})
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              <span className="hidden sm:inline">Glissez un fichier ici, ou </span>
              choisissez-en un depuis votre appareil.
            </p>
          )}

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT_FICHIER}
            className="sr-only"
            onChange={(event) => accepter(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => inputRef.current?.click()}
          >
            Choisir un fichier
          </Button>
        </div>

        {refus !== null && (
          <p role="alert" className="text-destructive text-sm">
            {refus}
          </p>
        )}

        <Input
          label="Nom du document"
          value={nom}
          onChange={(event) => setNom(event.target.value)}
          placeholder="Procédure de raccordement"
        />

        <Textarea
          label="Description (facultatif)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Catégorie (facultatif)"
            value={categorie}
            onChange={(event) => setCategorie(event.target.value)}
            placeholder="Sécurité, Notices…"
          />
          <SelectField
            label="Dossier"
            value={dossier}
            onChange={(event) => setDossier(event.target.value)}
          >
            <option value="">Aucun dossier</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
    </Modal>
  );
}
