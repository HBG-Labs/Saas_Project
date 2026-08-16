import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Calendar, CheckCircle2, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/feedback/FormError';
import { memberDisplayName, ROLE_LABELS } from '@/features/organizations';
import type { MemberWithProfile } from '@/types/domain';

import type { LeaveType } from '../types';

export interface NewLeaveSubmission {
  memberId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
}

interface NewLeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Les membres réels de l'organisation. Vide tant qu'ils chargent. */
  members: readonly MemberWithProfile[];
  /** Présélection : sa propre ligne de membership, quand elle est connue. */
  defaultMemberId?: string | null;
  /**
   * Faux pour qui ne peut déposer que ses propres congés. Le serveur applique
   * la même règle ; le sélecteur est simplement inutile dans ce cas.
   */
  canRequestForOthers: boolean;
  submitting: boolean;
  error: unknown;
  onSubmit: (submission: NewLeaveSubmission) => void;
}

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'paid_leave', label: 'Congés Payés (CP)' },
  { value: 'rtt', label: 'Réduction du Temps de Travail (RTT)' },
  { value: 'recovery', label: 'Heures de Récupération' },
  { value: 'family', label: 'Événement familial (Mariage, Naissance...)' },
  { value: 'sick_leave', label: 'Arrêt Maladie / Accident de travail' },
  { value: 'unpaid', label: 'Congé sans solde' },
];

export function NewLeaveModal({
  open,
  onOpenChange,
  members,
  defaultMemberId = null,
  canRequestForOthers,
  submitting,
  error,
  onSubmit,
}: NewLeaveModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<LeaveType>('paid_leave');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0] ?? '');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0] ?? '');
  const [reason, setReason] = useState<string>('');

  // Le membre par défaut n'est connu qu'une fois la liste chargée. Le résoudre
  // au rendu plutôt que dans un effet évite un rendu intermédiaire avec un
  // sélecteur vide — le motif déjà retenu dans `ReportEditorPage`.
  const effectiveMemberId =
    selectedMemberId !== '' ? selectedMemberId : (defaultMemberId ?? members[0]?.id ?? '');

  const calculateDays = () => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveMemberId === '') return;

    onSubmit({
      memberId: effectiveMemberId,
      type: leaveType,
      startDate,
      endDate,
      daysCount: calculateDays(),
      reason: reason.trim(),
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs animate-in fade-in" />
        <Dialog.Content className="fixed top-[50%] left-[50%] z-50 max-h-[90vh] w-[95vw] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-surface p-6 shadow-2xl border border-border overflow-y-auto animate-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Calendar className="size-4" />
              </div>
              <Dialog.Title className="text-base font-bold text-foreground">
                Poser un congé ou une absence
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <FormError error={error} />

            {/* Employé concerné */}
            <div>
              <label htmlFor="leave-tech-select" className="block text-xs font-semibold text-foreground mb-1.5">
                Membre du personnel
              </label>
              <select
                id="leave-tech-select"
                value={effectiveMemberId}
                disabled={!canRequestForOthers}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden disabled:opacity-60"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberDisplayName(member)} — {ROLE_LABELS[member.role]}
                  </option>
                ))}
              </select>
              {!canRequestForOthers && (
                <p className="text-3xs text-muted-foreground mt-1">
                  Vous ne pouvez déposer une demande que pour vous-même.
                </p>
              )}
            </div>

            {/* Type de congé */}
            <div>
              <label htmlFor="leave-type-select" className="block text-xs font-semibold text-foreground mb-1.5">
                Motif de l'absence
              </label>
              <select
                id="leave-type-select"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Période De / À */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="leave-start-date" className="block text-xs font-semibold text-foreground mb-1.5">
                  Date de début
                </label>
                <input
                  id="leave-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                />
              </div>
              <div>
                <label htmlFor="leave-end-date" className="block text-xs font-semibold text-foreground mb-1.5">
                  Date de fin (inclus)
                </label>
                <input
                  id="leave-end-date"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>

            {/* Durée estimée */}
            <div className="p-3 rounded-xl bg-surface-subtle border border-border/80 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Durée totale calculée :</span>
              <span className="font-extrabold text-foreground">{calculateDays()} jour(s)</span>
            </div>

            {/* Motif / Commentaire */}
            <div>
              <label htmlFor="leave-reason" className="block text-xs font-semibold text-foreground mb-1.5">
                Commentaire / Justificatif (facultatif)
              </label>
              <textarea
                id="leave-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. Vacances en famille, rendez-vous médical, etc."
                className="w-full p-2.5 rounded-xl border border-border bg-surface text-xs text-foreground focus:border-primary focus:outline-hidden resize-none"
              />
            </div>

            {/* La case « valider automatiquement » a disparu, et ce n'est pas
                un oubli : le serveur crée TOUTE demande en attente, puis exige
                que la décision vienne de quelqu'un d'autre que son titulaire.
                Offrir la case aurait produit une erreur à chaque envoi. */}
            <p className="text-3xs text-muted-foreground bg-surface-subtle border border-border/80 rounded-xl p-2.5">
              La demande est enregistrée en attente de validation. Elle devra être approuvée
              par un responsable — nul ne peut statuer sur ses propres congés.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || effectiveMemberId === ''}
                className="gap-1.5 font-semibold"
              >
                <CheckCircle2 className="size-4" />
                {submitting ? 'Enregistrement…' : "Enregistrer l'absence"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
