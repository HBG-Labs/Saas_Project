import { SelectField } from '@/components/ui/SelectField';
import { Briefcase, Check, Copy, FileText, Send, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import { useAppendMissionNote, useMissions } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import type { CalculationHistoryEntry } from '../types/tools.types';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

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

  const [copied, signalerCopied] = useEphemeralFlag();
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const appendMissionNote = useAppendMissionNote();

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
Traçabilité : résultat produit par l’outil REZO360 indiqué ci-dessus. À valider par le professionnel responsable avant exécution.`;

  const handleCopyNote = () => {
    // Le presse-papiers peut refuser (permission, contexte non sécurisé) :
    // n'annoncer « Copié » qu'une fois l'écriture réellement acceptée.
    void navigator.clipboard.writeText(technicalNote).then(
      () => {
        signalerCopied();
      },
      () => {
        // Échec d'écriture dans le presse-papiers : l'indicateur n'a jamais
        // été levé, il n'y a rien à rabaisser.
      },
    );
  };

  const handleAttachToMission = async () => {
    if (!selectedMissionId) return;
    try {
      await appendMissionNote.mutateAsync({ missionId: selectedMissionId, note: technicalNote });
      onClose();
      void navigate(`${ROUTES.missions}/${selectedMissionId}`);
    } catch {
      // L'erreur reste affichée dans la modale ; aucune réussite fictive.
    }
  };

  const handleCreateQuoteWithCalc = () => {
    onClose();
    void navigate(ROUTES.quotes, { state: { calculationNote: technicalNote } });
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
        <div className="border-border/80 bg-surface-sunken space-y-2 rounded-2xl border p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-bold">{calculation.toolName}</span>
            <span className="text-3xs text-muted-foreground font-mono">
              {new Date(calculation.timestamp).toLocaleTimeString('fr-FR')}
            </span>
          </div>
          <div className="text-primary font-mono text-sm font-semibold">{calculation.result}</div>
          <p className="text-muted-foreground text-xs">{calculation.summary}</p>
        </div>

        {/* Option 1 : Rattacher à une mission existante */}
        <div className="border-border/60 space-y-2 border-t pt-2">
          <label
            htmlFor="mission-select"
            className="text-foreground flex items-center gap-1.5 text-xs font-bold"
          >
            <Briefcase className="text-primary size-3.5" />
            <span>Rattacher à une intervention terrain :</span>
          </label>

          <div className="flex gap-2">
            <SelectField
              id="mission-select"
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="border-border bg-surface text-foreground focus:ring-primary/20 flex-1 rounded-xl border px-3 py-2 text-xs font-medium focus:ring-2 focus:outline-hidden"
            >
              <option value="">Sélectionnez une mission en cours...</option>
              {(missionsQuery.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.id.slice(0, 8)} — {m.title}
                </option>
              ))}
            </SelectField>

            <Button
              type="button"
              size="sm"
              disabled={!selectedMissionId || appendMissionNote.isPending}
              isLoading={appendMissionNote.isPending}
              onClick={() => void handleAttachToMission()}
              className="shrink-0 rounded-xl px-4 text-xs font-bold"
            >
              <Send className="mr-1 size-3.5" />
              Rattacher
            </Button>
          </div>
          <FormError error={appendMissionNote.error} />
        </div>

        {/* Option 2 : Créer ou insérer dans un devis */}
        <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-2">
          <div className="text-xs">
            <div className="text-foreground flex items-center gap-1.5 font-bold">
              <FileText className="text-primary dark:text-primary size-3.5" />
              <span>Insérer dans un Devis Client</span>
            </div>
            <p className="text-3xs text-muted-foreground">
              Préremplit la description technique du devis.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateQuoteWithCalc}
            className="shrink-0 rounded-xl text-xs font-bold"
          >
            Ouvrir le devis
          </Button>
        </div>

        {/* Option 3 : Copier la note technique certifiée */}
        <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-2">
          <div className="text-xs">
            <div className="text-foreground flex items-center gap-1.5 font-bold">
              <Sparkles className="text-warning size-3.5" />
              <span>Copier la note technique documentée</span>
            </div>
            <p className="text-3xs text-muted-foreground">
              Texte complet prêt à coller dans un mail ou rapport.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyNote}
            className="shrink-0 gap-1 rounded-xl text-xs font-bold"
          >
            {copied ? (
              <>
                <Check className="text-success size-3.5" />
                <span className="text-success">Copié !</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copier</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex justify-end pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
