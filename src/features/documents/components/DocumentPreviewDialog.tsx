import { Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Modal } from '@/components/ui';
import type { OrganizationDocument } from '@/types/domain';

import { getDocumentDownloadUrl, getDocumentUrl } from '../api/documents.api';
import { estPrevisualisable, familleDeDocument, formaterTaille } from '../constants';

export interface DocumentPreviewDialogProps {
  document: OrganizationDocument | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Aperçu d'un document.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'URL SIGNÉE EST DEMANDÉE ICI, PAS DANS LA LISTE
 *
 * En signer une par document au chargement coûterait autant d'appels que la
 * page compte de lignes, pour des liens que l'on n'ouvrira presque jamais. Elle
 * est donc produite à l'ouverture de cette fenêtre, et expire au bout d'une
 * heure.
 *
 * Seuls les PDF et les images se prévisualisent. Rendre un DOCX ou un XLSX
 * demanderait une bibliothèque lourde pour un confort marginal : ces formats
 * s'ouvrent dans l'outil de l'utilisateur, qui les rend mieux que nous.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function DocumentPreviewDialog({ document, onOpenChange }: DocumentPreviewDialogProps) {
  if (document === null) return null;

  // La cle remonte l'apercu d'un document a l'autre. L'etat repart donc vide de
  // lui-meme, la ou un effet charge de le reinitialiser aurait fait rendre une
  // premiere fois l'ancienne URL signee avec le nouveau document.
  return <Apercu key={document.id} document={document} onOpenChange={onOpenChange} />;
}

function Apercu({
  document,
  onOpenChange,
}: {
  document: OrganizationDocument;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!estPrevisualisable(document.mime_type)) return;

    let annule = false;
    void getDocumentUrl(document.storage_path)
      .then((signee) => {
        if (!annule) setUrl(signee);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });

    return () => {
      annule = true;
    };
  }, [document.mime_type, document.storage_path]);

  async function telecharger() {
    try {
      const lien = await getDocumentDownloadUrl(document.storage_path, document.name);
      window.open(lien, '_blank', 'noopener,noreferrer');
    } catch {
      setErreur(true);
    }
  }

  const famille = familleDeDocument(document.mime_type);

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={document.name}
      description={`${famille.toUpperCase()} · ${formaterTaille(document.file_size)}`}
      size="2xl"
      footer={
        <div className="flex justify-end">
          <Button onClick={() => void telecharger()}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Télécharger
          </Button>
        </div>
      }
    >
      {erreur ? (
        <p role="alert" className="text-destructive py-8 text-center text-sm">
          Ce document n’a pas pu être ouvert. Réessayez dans un instant.
        </p>
      ) : famille === 'image' && url !== null ? (
        <img src={url} alt={document.name} className="mx-auto max-h-[70vh] rounded-md" />
      ) : famille === 'pdf' && url !== null ? (
        <iframe src={url} title={document.name} className="h-[70vh] w-full rounded-md border-0" />
      ) : estPrevisualisable(document.mime_type) ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">Préparation de l’aperçu…</p>
        </div>
      ) : (
        <div className="py-10 text-center">
          <FileText className="text-muted-foreground mx-auto mb-3 h-10 w-10" aria-hidden />
          <p className="text-foreground text-sm font-medium">{document.name}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Ce format ne s’affiche pas ici. Téléchargez-le pour l’ouvrir dans votre application
            habituelle.
          </p>
        </div>
      )}
    </Modal>
  );
}
