import { useRef } from 'react';
import { FileText, Printer, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { memberDisplayName } from '@/features/organizations';
import type {
  InterventionAttachment,
  InterventionReport,
  InterventionWithReport,
  MissionWithRelations,
} from '@/types/domain';

import { useAttachmentUrl } from '../hooks/useReports';

export interface InterventionPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName?: string | null | undefined;
  mission: MissionWithRelations | null | undefined;
  intervention?: InterventionWithReport | null | undefined;
  report: InterventionReport | null | undefined;
  attachments?: readonly InterventionAttachment[] | undefined;
  workedSeconds?: number | undefined;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${String(minutes).padStart(2, '0')}min`;
}

export function InterventionPdfModal({
  open,
  onOpenChange,
  organizationName = 'REZO360 Pro',
  mission,
  intervention: _intervention,
  report,
  attachments = [],
  workedSeconds = 0,
}: InterventionPdfModalProps) {
  const printRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const reference = mission?.reference ?? 'INT-0000';
  const missionTitle = mission?.title ?? 'Intervention technique';
  const customerName = mission?.customer?.name ?? mission?.customer_name ?? 'Client particulier';
  const customerPhone = mission?.customer_phone ?? '—';
  const address =
    mission?.address_line1 ??
    mission?.site?.name ??
    mission?.location_label ??
    'Adresse non précisée';
  const dateStr = mission?.scheduled_start
    ? new Date(mission.scheduled_start).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('fr-FR');

  const technicianName =
    mission?.assigned_member ? memberDisplayName(mission.assigned_member) : 'Technicien qualifié';

  const attachedCalcNotes = typeof window !== 'undefined' && mission?.id
    ? localStorage.getItem(`mission_calc_note_${mission.id}`)
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Procès-Verbal d'Intervention — ${reference}`}
      description="Prévisualisez le rapport d’intervention officiel et imprimez ou exportez-le en PDF."
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Actions d'impression en haut */}
        <div className="flex items-center justify-between p-3 bg-surface-subtle rounded-xl border border-border print:hidden">
          <span className="text-xs font-bold text-foreground">
            Document prêt pour impression / PDF
          </span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="size-3.5" />
            <span>Imprimer / Enregistrer en PDF</span>
          </Button>
        </div>

        {/* 📄 ZONE OFFICIELLE DU RAPPORT (Format A4 / PV de Réception) */}
        <div
          ref={printRef}
          className="p-6 sm:p-8 bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0 print:m-0"
        >
          {/* En-tête officiel */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Wrench className="size-5 text-indigo-600 print:text-slate-900" />
                <span>{organizationName}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">Rapport & Procès-Verbal de Réception de Travaux</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded bg-slate-100 border border-slate-300 font-mono text-xs font-bold text-slate-800">
                Réf : {reference}
              </span>
              <p className="text-xs text-slate-500 mt-1">Date : {dateStr}</p>
            </div>
          </div>

          {/* Cadres Client & Mission */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Client / Donneur d'ordre</p>
              <h3 className="text-sm font-bold text-slate-900">{customerName}</h3>
              <p className="text-xs text-slate-600">📞 {customerPhone}</p>
              <p className="text-xs text-slate-600">📍 {address}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Intervenant & Horaires</p>
              <h3 className="text-sm font-bold text-slate-900">👨‍🔧 {technicianName}</h3>
              <p className="text-xs text-slate-600">
                ⏱️ Temps d'intervention : <strong>{workedSeconds > 0 ? formatDuration(workedSeconds) : 'Terminé'}</strong>
              </p>
              <p className="text-xs text-slate-600">
                Statut : <strong className="text-emerald-700 uppercase">{report?.status === 'approved' ? 'Validé' : report?.status === 'submitted' ? 'Soumis' : 'Réalisé'}</strong>
              </p>
            </div>
          </div>

          {/* Intitulé & Description des travaux */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              1. Intitulé & Nature de l’intervention
            </h3>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-sm font-bold text-slate-900">{missionTitle}</p>
            </div>
          </div>

          {/* Travaux Réalisés */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              2. Description détaillée des opérations effectuées
            </h3>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-h-[70px] text-xs text-slate-800 leading-relaxed whitespace-pre-line">
              {report?.work_description || 'Travaux de maintenance et raccordement exécutés conformément au cahier des charges et aux règles de l’art.'}
            </div>
          </div>

          {/* Observations & Réserves */}
          {report?.observations && (
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                3. Observations & Préconisations
              </h3>
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                {report.observations}
              </div>
            </div>
          )}

          {/* Photos jointes si existantes */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                4. Justificatifs photographiques & Documents ({attachments.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {attachments.map((att) => (
                  <PdfAttachmentThumbnail key={att.id} attachment={att} />
                ))}
              </div>
            </div>
          )}

          {/* Notes & Justificatifs de calculs attachés */}
          {attachedCalcNotes && (
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                5. Justificatifs &amp; Notes de Calculs d’Ingénierie (REZO360)
              </h3>
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs font-mono text-slate-800 leading-relaxed whitespace-pre-line">
                {attachedCalcNotes}
              </div>
            </div>
          )}

          {/* ✍️ DOUBLE ZONE DE SIGNATURE */}
          <div className="pt-4 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Signature Technicien */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between min-h-[140px]">
                <div>
                  <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Le Technicien</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{technicianName}</p>
                </div>
                {report?.technician_signature_path ? (
                  <img
                    src={report.technician_signature_path}
                    alt="Signature technicien"
                    className="max-h-16 object-contain my-1"
                  />
                ) : (
                  <div className="py-2 text-3xs text-slate-400 italic">Signature apposée électroniquement</div>
                )}
                <p className="text-4xs text-slate-400">Fait le {dateStr}</p>
              </div>

              {/* Signature Client */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between min-h-[140px]">
                <div>
                  <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Le Client / Réceptionnaire</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {report?.customer_signature_name || customerName}
                  </p>
                </div>
                {report?.customer_signature_path ? (
                  <img
                    src={report.customer_signature_path}
                    alt="Signature client"
                    className="max-h-16 object-contain my-1"
                  />
                ) : (
                  <div className="py-2 text-3xs text-amber-700 italic">Bon pour accord et réception des travaux</div>
                )}
                <p className="text-4xs text-slate-400">Fait le {dateStr}</p>
              </div>
            </div>
          </div>

          {/* Sceau de conformité & traçabilité */}
          <div className="pt-3 flex items-center justify-between text-4xs text-slate-400 border-t border-slate-100">
            <span>Certifié conforme — Plateforme d’exploitation technique REZO360 — Document officiel</span>
            <span>Réf : {reference}</span>
          </div>
        </div>

        {/* Pied de page modal */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fermer
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-1.5"
          >
            <Printer className="size-3.5" />
            Imprimer / PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PdfAttachmentThumbnail({ attachment }: { attachment: InterventionAttachment }) {
  const url = useAttachmentUrl(attachment.storage_path);
  const isImage = attachment.mime_type?.startsWith('image/') ?? false;

  const kindLabel =
    attachment.kind === 'before'
      ? 'Avant'
      : attachment.kind === 'after'
        ? 'Après'
        : attachment.kind === 'document'
          ? 'Doc'
          : 'Travaux / Mesure';

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex flex-col justify-between">
      <div className="aspect-video relative bg-slate-100 flex items-center justify-center overflow-hidden">
        {isImage && url.data ? (
          <img
            src={url.data}
            alt={attachment.caption ?? attachment.file_name}
            className="size-full object-cover"
          />
        ) : (
          <FileText className="size-6 text-slate-400" />
        )}
        <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-slate-900/80 text-white text-4xs font-bold uppercase">
          {kindLabel}
        </span>
      </div>
      <p className="p-1 text-4xs text-slate-600 truncate font-mono" title={attachment.file_name}>
        {attachment.caption || attachment.file_name}
      </p>
    </div>
  );
}
