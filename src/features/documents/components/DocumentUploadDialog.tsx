import { AlertCircle, Check, Loader2, UploadCloud, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';

import { useToast } from '@/components/feedback/toast-context';
import { Button, Modal } from '@/components/ui';
import { SelectField } from '@/components/ui/SelectField';
import type { DocumentFolder } from '@/types/domain';

import { ACCEPT_FICHIER, TAILLE_MAX_LISIBLE, formaterTaille } from '../constants';
import { destinationsPossibles } from '../folder-tree';
import { useFileTeleversement, type EtatFichier } from '../hooks/useUploadQueue';

export interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  uploadedBy: string;
  folders: DocumentFolder[];
  /** Dossier pré-sélectionné : celui que l'utilisateur consultait. */
  defaultFolderId?: string | null;
}

const LIBELLES: Record<EtatFichier, string> = {
  en_attente: 'En attente',
  envoi: 'Envoi…',
  reussi: 'Ajouté',
  echec: 'Échec',
};

/**
 * Dépôt de documents, un ou vingt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI LA FILE EST VISIBLE AVANT D'ÊTRE LANCÉE
 *
 * L'utilisateur choisit vingt fichiers d'un coup ; deux sont trop lourds. Les
 * lui montrer refusés AVANT d'envoyer quoi que ce soit lui laisse le choix de
 * les retirer ou de partir quand même — plutôt que de découvrir l'échec à la
 * fin, mêlé aux dix-huit réussites.
 *
 * Les noms sont repris des fichiers. Faire saisir vingt titres avant l'envoi
 * transformerait un import en formulaire ; renommer se fait après, sur les
 * documents qui le méritent.
 * ─────────────────────────────────────────────────────────────────────────────
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
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { file, ajouter, retirer, vider, demarrer, enCours, enAttente, traites } =
    useFileTeleversement();

  const [dossier, setDossier] = useState<string>(defaultFolderId ?? '');
  const [survole, setSurvole] = useState(false);

  const destinations = destinationsPossibles(folders);

  function accepter(fichiers: FileList | null) {
    if (fichiers === null || fichiers.length === 0) return;
    ajouter(Array.from(fichiers));
  }

  function surDepot(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setSurvole(false);
    accepter(event.dataTransfer.files);
  }

  function fermer() {
    vider();
    setDossier(defaultFolderId ?? '');
    onOpenChange(false);
  }

  async function envoyer() {
    if (enAttente === 0 || enCours) return;

    const { reussis, echoues } = await demarrer({
      organizationId,
      uploadedBy,
      folderId: dossier === '' ? null : dossier,
    });

    if (echoues === 0) {
      toast.succes(reussis > 1 ? `${reussis} documents ajoutés` : 'Document ajouté');
      fermer();
      return;
    }

    // La fenêtre reste ouverte : elle porte le détail de ce qui a échoué, et
    // la fermer obligerait à tout recommencer pour le savoir.
    toast.erreur(
      `${echoues} fichier${echoues > 1 ? 's' : ''} non envoyé${echoues > 1 ? 's' : ''}`,
      reussis > 0 ? `${reussis} ont bien été ajoutés.` : 'Consultez le détail dans la fenêtre.',
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(suivant) => (suivant ? onOpenChange(true) : fermer())}
      title="Ajouter des documents"
      description={`PDF, images, Word, Excel, CSV et texte. ${TAILLE_MAX_LISIBLE} par fichier.`}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground text-sm" aria-live="polite">
            {file.length === 0
              ? ''
              : enCours
                ? `${traites} sur ${file.length} traités…`
                : `${file.length} fichier${file.length > 1 ? 's' : ''} sélectionné${file.length > 1 ? 's' : ''}`}
          </span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={fermer} disabled={enCours}>
              {traites > 0 && enAttente === 0 ? 'Fermer' : 'Annuler'}
            </Button>
            <Button onClick={() => void envoyer()} disabled={enAttente === 0 || enCours}>
              {enCours
                ? 'Envoi en cours…'
                : enAttente > 1
                  ? `Ajouter ${enAttente} documents`
                  : 'Ajouter'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setSurvole(true);
          }}
          onDragLeave={() => setSurvole(false)}
          onDrop={surDepot}
          className={[
            'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            survole ? 'border-primary bg-primary/5' : 'border-border',
          ].join(' ')}
        >
          <UploadCloud className="text-muted-foreground mx-auto mb-2 h-8 w-8" aria-hidden />
          <p className="text-muted-foreground text-sm">
            <span className="hidden sm:inline">Glissez vos fichiers ici, ou </span>
            choisissez-en plusieurs depuis votre appareil.
          </p>

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={ACCEPT_FICHIER}
            className="sr-only"
            onChange={(event) => {
              accepter(event.target.files);
              // Sans cette remise à zéro, re-sélectionner le MÊME fichier après
              // l'avoir retiré de la file ne déclenche aucun `change`.
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={enCours}
            onClick={() => inputRef.current?.click()}
          >
            Choisir des fichiers
          </Button>
        </div>

        <SelectField
          label="Dossier de destination"
          value={dossier}
          disabled={enCours}
          onChange={(event) => setDossier(event.target.value)}
        >
          {destinations.map((option) => (
            <option key={option.id ?? 'racine'} value={option.id ?? ''}>
              {option.chemin}
            </option>
          ))}
        </SelectField>

        {file.length > 0 && (
          <ul className="divide-border border-border max-h-64 divide-y overflow-y-auto rounded-lg border">
            {file.map((entree) => (
              <li key={entree.id} className="flex items-center gap-3 p-3">
                <EtatIcone etat={entree.etat} />

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {entree.fichier.name}
                  </p>
                  <p
                    className={[
                      'truncate text-xs',
                      entree.etat === 'echec' ? 'text-destructive' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {formaterTaille(entree.fichier.size)} · {entree.erreur ?? LIBELLES[entree.etat]}
                  </p>
                </div>

                {entree.etat !== 'envoi' && (
                  <button
                    type="button"
                    onClick={() => retirer(entree.id)}
                    aria-label={`Retirer ${entree.fichier.name}`}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function EtatIcone({ etat }: { etat: EtatFichier }) {
  if (etat === 'reussi') {
    return <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (etat === 'echec') {
    return <AlertCircle className="text-destructive h-5 w-5 shrink-0" aria-hidden />;
  }
  if (etat === 'envoi') {
    return <Loader2 className="text-primary h-5 w-5 shrink-0 animate-spin" aria-hidden />;
  }
  return <UploadCloud className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />;
}
