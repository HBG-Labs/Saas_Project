import { Download, FileCode2, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { InvoiceWithItems, Organization } from '@/types/domain';
import { preparerExportCii, preparerExportUbl, verifierExportBrouillon } from '../canonical/mapper';
import { downloadFacturX, downloadTestFacturX } from '../api/facturx.api';
import { preparerTestFacturX } from '../canonical/test-preview';
import { serializeCii } from '../serializers/cii';
import { serializeUbl } from '../serializers/ubl';

export function ExportUblPanel({
  invoice,
  organization,
}: {
  invoice: InvoiceWithItems;
  organization: Organization | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<'ubl' | 'cii' | 'pdf' | 'test' | null>(null);
  const [preparing, setPreparing] = useState(false);
  const isDraft = invoice.status === 'draft';
  const isCreditNote = invoice.document_type === 'credit_note';
  const testResult = isDraft ? preparerTestFacturX(invoice, organization, new Date()) : null;
  const result =
    invoice.status === 'draft'
      ? verifierExportBrouillon(invoice, organization)
      : preparerExportUbl(invoice);
  const isConsumerInvoice = invoice.customer_type === 'individual';
  const ciiResult = preparerExportCii(invoice);
  const issues = testResult?.issues ?? result.issues;
  function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function downloadPdf(mode: 'final' | 'test') {
    if (preparing) return;
    setPreparing(true);
    setError(null);
    setDownloaded(null);
    try {
      const blob =
        mode === 'test'
          ? await downloadTestFacturX(invoice.id, invoice.updated_at)
          : await downloadFacturX(invoice.id);
      const name = mode === 'test' ? `TEST-${invoice.id}` : invoice.reference;
      saveBlob(blob, `${name.replace(/[^A-Za-z0-9_-]/g, '_')}-factur-x.pdf`);
      setDownloaded(mode === 'test' ? 'test' : 'pdf');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le PDF n’a pas pu être téléchargé.');
    } finally {
      setPreparing(false);
    }
  }
  function download(format: 'ubl' | 'cii') {
    setError(null);
    try {
      // Revalider lors du clic ; le téléchargement ne modifie aucun statut.
      const current = format === 'cii' ? preparerExportCii(invoice) : preparerExportUbl(invoice);
      if (!current.invoice) {
        setError(current.issues.join(' · '));
        return;
      }
      const xml = format === 'ubl' ? serializeUbl(current.invoice) : serializeCii(current.invoice);
      const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      const baseName = invoice.reference.replace(/[^A-Za-z0-9_-]/g, '_');
      link.download = `${baseName}${format === 'cii' ? '-factur-x' : ''}.xml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(format);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le fichier n’a pas pu être généré.');
    }
  }
  return (
    <section
      aria-label="Fichier électronique"
      className="border-border bg-surface space-y-3 rounded-xl border p-4 print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Fichier électronique</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {isCreditNote
              ? 'Un avoir lisible, avec les données et la référence de la facture corrigée intégrées.'
              : 'Un PDF lisible, avec les données de la facture intégrées.'}
          </p>
        </div>
        {!isDraft && (
          <div className="flex flex-wrap gap-2">
            {!isConsumerInvoice && (
              <Button
                className="gap-2"
                onClick={() => downloadPdf('final')}
                disabled={preparing || !ciiResult.invoice}
                aria-busy={preparing}
              >
                <Download className="size-4" aria-hidden="true" />
                {preparing ? 'Préparation du document…' : 'Télécharger le PDF Factur-X'}
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => download('ubl')}
              disabled={isConsumerInvoice || !result?.invoice}
            >
              <FileCode2 className="size-4" aria-hidden="true" />
              {isConsumerInvoice ? 'Export UBL non disponible' : 'Télécharger le fichier UBL'}
            </Button>
            {!isConsumerInvoice && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => download('cii')}
                disabled={!ciiResult.invoice}
              >
                <FileCode2 className="size-4" aria-hidden="true" />
                Télécharger les données CII
              </Button>
            )}
          </div>
        )}
      </div>
      {isDraft && !isConsumerInvoice && (
        <div className="border-primary/20 bg-primary/5 space-y-3 rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-primary flex items-center gap-2 text-sm font-semibold">
                <FlaskConical className="size-4" aria-hidden="true" /> Mode test
              </h3>
              <p className="text-muted-foreground max-w-lg text-xs">
                Essayez avec les données enregistrées : le PDF portera la mention TEST. Votre
                brouillon reste modifiable et aucun numéro {isCreditNote ? 'd’avoir' : 'de facture'}{' '}
                réel n’est attribué.
              </p>
            </div>
            <Button
              className="shrink-0 gap-2"
              onClick={() => downloadPdf('test')}
              disabled={preparing || !testResult?.invoice}
              aria-busy={preparing}
            >
              <FlaskConical className="size-4" aria-hidden="true" />
              {preparing ? 'Simulation en cours…' : 'Simuler l’émission'}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Le PDF de test est téléchargé directement. Il n’est ni conservé comme document définitif
            ni envoyé.
          </p>
        </div>
      )}
      {isConsumerInvoice ? (
        <p
          role="status"
          className="border-border bg-surface-subtle text-muted-foreground rounded-lg border px-3 py-2 text-xs"
        >
          {isCreditNote ? 'Cet avoir est adressé' : 'Cette facture est adressée'} à un particulier.
          Le premier export UBL est réservé aux documents entre professionnels ; utilisez le PDF ou
          votre canal habituel. Cette limitation ne bloque ni l’émission ni le suivi du document.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            Première version : factures et avoirs en euros entre professionnels en France. Ce
            téléchargement ne transmet rien à une plateforme agréée.
          </p>
          {!isDraft && (
            <p className="text-muted-foreground text-xs">
              Le PDF Factur-X est conservé lors de sa première génération. Les téléchargements
              suivants restituent le même document. Les exports UBL et CII restent disponibles pour
              votre prestataire.
            </p>
          )}
          {result.invoice && !ciiResult.invoice && (
            <p className="text-warning text-xs">{ciiResult.issues.join(' · ')}</p>
          )}
          {invoice.status === 'draft' && (
            <p className="text-muted-foreground text-xs">
              Le fichier définitif utilise le numéro et les informations figés à l’émission.
              Complétez le brouillon avant de l’émettre.
            </p>
          )}
          {!!issues.length && (
            <details className="text-sm" open>
              <summary className="text-warning cursor-pointer">
                Préparation de l’export · {issues.length} point(s) à vérifier
              </summary>
              <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-xs">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </details>
          )}
          {isDraft && issues.length === 0 && (
            <p className="text-success text-xs">
              Le brouillon est prêt pour la simulation. Les documents définitifs seront disponibles
              après émission réelle.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      )}
      {downloaded === 'ubl' && (
        <p role="status" className="text-success text-xs">
          Fichier UBL préparé.{' '}
          {isCreditNote ? 'Aucun avoir n’a été envoyé.' : 'Aucune facture n’a été envoyée.'}
        </p>
      )}
      {downloaded === 'cii' && (
        <p role="status" className="text-success text-xs">
          Données CII préparées. Aucun PDF Factur-X ni{' '}
          {isCreditNote ? 'aucun avoir' : 'aucune facture'} n’a été envoyé.
        </p>
      )}
      {downloaded === 'pdf' && (
        <p role="status" className="text-success text-xs">
          PDF Factur-X téléchargé. Le fichier est conservé avec{' '}
          {isCreditNote ? 'cet avoir' : 'cette facture'} ; aucun envoi n’a été effectué.
        </p>
      )}
      {downloaded === 'test' && (
        <p role="status" className="text-success text-xs">
          Simulation réussie : le PDF TEST a été téléchargé.{' '}
          {isCreditNote ? 'Aucun avoir n’a été émis' : 'Aucune facture n’a été émise'} et aucun
          numéro réel n’a été consommé.
        </p>
      )}
    </section>
  );
}
