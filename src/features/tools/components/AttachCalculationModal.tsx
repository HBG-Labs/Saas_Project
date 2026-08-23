import {
  Briefcase,
  Check,
  Copy,
  FileText,
  Send,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import { useMissions } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import type { CalculationHistoryEntry } from '../types/tools.types';

interface AttachCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculation: CalculationHistoryEntry | null;
}

export function AttachCalculationModal({
  isOpen,
  onClose,
  calculation,
}: AttachCalculationModalProps) {
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const [copied, setCopied] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');

  const missionsQuery = useMissions(organizationId, {
    status: ['in_progress', 'assigned', 'accepted', 'draft'],
    limit: 10,
  });

  if (!calculation) return null;

  const technicalNote = `[NOTE TECHNIQUE D'INGÉNIERIE — REZO360]
Outil : ${calculation.toolName} (${calculation.toolSlug})
Date : ${new Date(calculation.timestamp).toLocaleDateString('fr-FR')} à ${new Date(calculation.timestamp).toLocaleTimeString('fr-FR')}
Paramètres d'entrée : ${JSON.stringify(calculation.inputs, null, 2)}
Synthèse & Résultat : ${calculation.summary} => ${calculation.result}
Conformité : Calcul certifié selon algorithmes et formules normées REZO360.`;

  const handleCopyNote = () => {
    // Le presse-papiers peut refuser (permission, contexte non sécurisé) :
    // n'annoncer « Copié » qu'une fois l'écriture réellement acceptée.
    void navigator.clipboard.writeText(technicalNote).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setCopied(false);
      },
    );
  };

  const handleAttachToMission = () => {
    if (!selectedMissionId) return;
    // Enregistrement de la note technique dans le stockage local de session pour la mission
    try {
      const existing = localStorage.getItem(`mission_calc_note_${selectedMissionId}`) || '';
      const updated = existing ? `${existing}\n\n${technicalNote}` : technicalNote;
      localStorage.setItem(`mission_calc_note_${selectedMissionId}`, updated);
    } catch {
      // Ignore
    }

    onClose();
    void navigate(`${ROUTES.missions}/${selectedMissionId}`);
  };

  const handleCreateQuoteWithCalc = () => {
    try {
      localStorage.setItem('quote_draft_calc_note', technicalNote);
    } catch {
      // Ignore
    }
    onClose();
    void navigate(ROUTES.quotes);
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Joindre le calcul à une mission ou un devis"
      className="max-w-lg"
    >
      <div className="space-y-4 pt-2">
        {/* Aperçu du calcul */}
        <div className="rounded-2xl border border-border/80 bg-surface-sunken p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">{calculation.toolName}</span>
            <span className="font-mono text-3xs text-muted-foreground">
              {new Date(calculation.timestamp).toLocaleTimeString('fr-FR')}
            </span>
          </div>
          <div className="text-sm font-semibold text-primary font-mono">{calculation.result}</div>
          <p className="text-xs text-muted-foreground">{calculation.summary}</p>
        </div>

        {/* Option 1 : Rattacher à une mission existante */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <label htmlFor="mission-select" className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Briefcase className="size-3.5 text-primary" />
            <span>Rattacher à une intervention terrain :</span>
          </label>

          <div className="flex gap-2">
            <select
              id="mission-select"
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Sélectionnez une mission en cours...</option>
              {(missionsQuery.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.id.slice(0, 8)} — {m.title}
                </option>
              ))}
            </select>

            <Button
              type="button"
              size="sm"
              disabled={!selectedMissionId}
              onClick={handleAttachToMission}
              className="rounded-xl px-4 text-xs font-bold shrink-0"
            >
              <Send className="size-3.5 mr-1" />
              Rattacher
            </Button>
          </div>
        </div>

        {/* Option 2 : Créer ou insérer dans un devis */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Insérer dans un Devis Client</span>
            </div>
            <p className="text-3xs text-muted-foreground">Préremplit la description technique du devis.</p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateQuoteWithCalc}
            className="rounded-xl text-xs font-bold shrink-0"
          >
            Ouvrir le devis
          </Button>
        </div>

        {/* Option 3 : Copier la note technique certifiée */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Copier la Note Technique Certifiée</span>
            </div>
            <p className="text-3xs text-muted-foreground">Texte complet prêt à coller dans un mail ou rapport.</p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyNote}
            className="rounded-xl text-xs font-bold shrink-0 gap-1"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copié !</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copier</span>
              </>
            )}
          </Button>
        </div>

        <div className="pt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
