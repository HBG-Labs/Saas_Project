import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useState } from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/feedback/FormError';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { memberDisplayName, ROLE_LABELS } from '@/features/organizations';
import type { MemberWithProfile } from '@/types/domain';

import { useLeaveDaysPreview } from '../hooks/usePlanning';
import type { LeaveType } from '../types';

export interface NewLeaveSubmission {
  memberId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
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
  /** Territoire de l'entreprise : il détermine les jours fériés décomptés. */
  territory: string;
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
  territory,
  submitting,
  error,
  onSubmit,
}: NewLeaveModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<LeaveType>('paid_leave');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0] ?? '');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0] ?? '');
  const [reason, setReason] = useState<string>('');
  const [halfDayStart, setHalfDayStart] = useState(false);
  const [halfDayEnd, setHalfDayEnd] = useState(false);

  // Le membre par défaut n'est connu qu'une fois la liste chargée. Le résoudre
  // au rendu plutôt que dans un effet évite un rendu intermédiaire avec un
  // sélecteur vide — le motif déjà retenu dans `ReportEditorPage`.
  const effectiveMemberId =
    selectedMemberId !== '' ? selectedMemberId : (defaultMemberId ?? members[0]?.id ?? '');

  // Le décompte vient du SERVEUR, pas d'ici.
  //
  // La version précédente faisait `fin − début + 1` : une absence du vendredi au
  // lundi coûtait quatre jours, et le 1er mai en coûtait un. Un solde de congés
  // payés est une créance ; il ne se calcule pas dans le navigateur de
  // l'intéressé.
  const preview = useLeaveDaysPreview({
    startDate,
    endDate,
    territory,
    halfDayStart,
    halfDayEnd,
    enabled: open,
  });

  const days = preview.data ?? [];
  const total = days.reduce((sum, day) => sum + Number(day.value), 0);
  const excluded = days.filter((day) => !day.counted);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveMemberId === '') return;

    onSubmit({
      memberId: effectiveMemberId,
      type: leaveType,
      startDate,
      endDate,
      reason: reason.trim(),
      halfDayStart,
      halfDayEnd,
    });
  };

  return (
    <Modal
      presentation="drawer"
      open={open}
      onOpenChange={onOpenChange}
      title="Poser un congé ou une absence"
      description="Sélectionnez la personne concernée, le motif et la période à soumettre."
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="leave-request-form"
            variant="primary"
            isLoading={submitting}
            loadingLabel="Enregistrement de l’absence"
            disabled={effectiveMemberId === ''}
            className="gap-1.5"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Enregistrer l’absence
          </Button>
        </>
      }
    >
      <form id="leave-request-form" onSubmit={handleSubmit} className="space-y-5">
        <FormError error={error} />

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div className="flex items-start gap-3">
            <div className="border-warning/20 bg-warning/10 text-warning flex size-9 shrink-0 items-center justify-center rounded-xl border">
              <Calendar className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-semibold">Demande</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Identifiez la personne et la nature de l’absence.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="leave-tech-select"
              label="Membre du personnel"
              value={effectiveMemberId}
              disabled={!canRequestForOthers}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              hint={
                !canRequestForOthers
                  ? 'Vous ne pouvez déposer une demande que pour vous-même.'
                  : undefined
              }
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberDisplayName(member)} — {ROLE_LABELS[member.role]}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="leave-type-select"
              label="Motif de l’absence"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            >
              {LEAVE_TYPES.map((leave) => (
                <option key={leave.value} value={leave.value}>
                  {leave.label}
                </option>
              ))}
            </SelectField>
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Période</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Le décompte tient compte du territoire, des week-ends et des jours fériés.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="leave-start-date"
              label="Date de début"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              id="leave-end-date"
              label="Date de fin (incluse)"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <label className="min-h-touch border-border bg-surface text-foreground hover:bg-surface-hover flex cursor-pointer items-center gap-2 rounded-xl border px-3 transition-colors">
              <input
                type="checkbox"
                checked={halfDayStart}
                onChange={(e) => setHalfDayStart(e.target.checked)}
                className="border-border text-primary focus:ring-primary size-4 rounded-sm"
              />
              <span>Début l’après-midi</span>
            </label>
            <label className="min-h-touch border-border bg-surface text-foreground hover:bg-surface-hover flex cursor-pointer items-center gap-2 rounded-xl border px-3 transition-colors">
              <input
                type="checkbox"
                checked={halfDayEnd}
                onChange={(e) => setHalfDayEnd(e.target.checked)}
                className="border-border text-primary focus:ring-primary size-4 rounded-sm"
              />
              <span>Fin le matin</span>
            </label>
          </div>

          <div
            className="border-primary/15 bg-primary/5 space-y-1.5 rounded-xl border p-3 text-xs"
            aria-live="polite"
          >
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Jours décomptés</span>
              <strong className="text-foreground text-sm">
                {preview.isLoading ? 'Calcul…' : `${String(total)} jour(s)`}
              </strong>
            </div>

            {excluded.length > 0 && (
              <p className="text-3xs text-muted-foreground">
                Non décomptés :{' '}
                {excluded
                  .map((day) => `${day.day.slice(8, 10)}/${day.day.slice(5, 7)} (${day.reason})`)
                  .join(' · ')}
              </p>
            )}

            {preview.isError && (
              <p className="text-3xs text-error font-semibold">
                Le décompte n’a pas pu être calculé. Vérifiez les dates avant d’enregistrer.
              </p>
            )}
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <Textarea
            id="leave-reason"
            label="Commentaire / justificatif (facultatif)"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. Vacances en famille, rendez-vous médical…"
          />

          <p className="border-border/80 bg-surface-subtle text-muted-foreground rounded-xl border p-3 text-xs">
            La demande sera enregistrée en attente de validation par un responsable. Une personne ne
            peut pas statuer sur sa propre demande.
          </p>
        </section>
      </form>
    </Modal>
  );
}
