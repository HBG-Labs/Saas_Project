import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CustomerPicker, SitePicker } from '@/features/customers';
import { useInterventionTypes } from '@/features/industries';
import { memberDisplayName, useMembers } from '@/features/organizations';
import { useTeams } from '@/features/teams';
import type { MissionPriority } from '@/types/database';

import { MISSION_PRIORITY_LABELS } from '../priority-labels';
import type { MissionValues } from '../schemas/mission.schema';

export interface MissionFormFieldsProps {
  register: UseFormRegister<MissionValues>;
  errors: FieldErrors<MissionValues>;
  organizationId: string | null;

  priority: MissionPriority;
  onPriorityChange: (priority: MissionPriority) => void;

  customerId: string | null;
  onCustomerChange: (customerId: string | null) => void;

  siteId: string | null;
  onSiteChange: (siteId: string | null) => void;

  assignedTeamId?: string | null;
  onAssignedTeamChange?: (teamId: string | null) => void;

  assignedMemberId?: string | null;
  onAssignedMemberChange?: (memberId: string | null) => void;

  interventionTypeId?: string | null;
  onInterventionTypeChange?: (typeId: string | null) => void;
}

export function MissionFormFields({
  register,
  errors,
  organizationId,
  priority,
  onPriorityChange,
  customerId,
  onCustomerChange,
  siteId,
  onSiteChange,
  assignedTeamId = null,
  onAssignedTeamChange,
  assignedMemberId = null,
  onAssignedMemberChange,
  interventionTypeId = null,
  onInterventionTypeChange,
}: MissionFormFieldsProps) {
  const teamsQuery = useTeams(organizationId);
  const typesQuery = useInterventionTypes();
  const membersQuery = useMembers(organizationId);

  const teamOptions = [
    { value: '', label: 'Aucune équipe affectée' },
    ...(teamsQuery.data ?? []).map((t) => ({ value: t.id, label: t.name })),
  ];

  /*
    Types du métier de l'entreprise, plus le socle commun.

    Le trigger `missions_intervention_type_matches_industry` applique la même
    règle côté serveur : cette liste est un confort de saisie, pas une barrière.
  */
  const typeOptions = [
    { value: '', label: 'Type non précisé' },
    ...(typesQuery.data ?? []).map((t) => ({ value: t.id, label: t.label })),
  ];

  const memberOptions = [
    { value: '', label: 'Aucun technicien affecté' },
    ...(membersQuery.data ?? []).map((m) => ({
      value: m.id,
      label: memberDisplayName(m),
    })),
  ];

  return (
    <>
      <Input
        label="Intitulé"
        placeholder="Raccordement FTTH — armoire de rue"
        required
        {...(errors.title?.message ? { error: errors.title.message } : {})}
        {...register('title')}
      />

      <Textarea
        label="Description"
        rows={3}
        placeholder="Nature des travaux, matériel attendu, contraintes particulières."
        {...register('description')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {onInterventionTypeChange ? (
          <Select
            options={typeOptions}
            value={interventionTypeId ?? ''}
            onValueChange={(value) => onInterventionTypeChange(value === '' ? null : value)}
            label="Nature de l'intervention"
            hint="Détermine le formulaire de compte rendu."
            disabled={typesQuery.isPending}
          />
        ) : null}

        <Select
          options={Object.entries(MISSION_PRIORITY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          value={priority}
          onValueChange={(value) => {
            onPriorityChange(value as MissionPriority);
          }}
          label="Priorité"
        />

        {onAssignedTeamChange ? (
          <Select
            options={teamOptions}
            value={assignedTeamId ?? ''}
            onValueChange={(value) => onAssignedTeamChange(value === '' ? null : value)}
            label="Affecter une équipe"
            hint="L'équipe entière recevra la notification"
          />
        ) : null}
      </div>

      {onAssignedMemberChange ? (
        <Select
          options={memberOptions}
          value={assignedMemberId ?? ''}
          onValueChange={(value) => onAssignedMemberChange(value === '' ? null : value)}
          label="Affecter un technicien"
          hint="Technicien désigné pour l'intervention terrain"
        />
      ) : null}

      <CustomerPicker
        organizationId={organizationId}
        value={customerId}
        onChange={(next) => {
          onCustomerChange(next);
          onSiteChange(null);
        }}
      />

      <SitePicker customerId={customerId} value={siteId} onChange={onSiteChange} />

      <Input
        label="Précision de lieu"
        placeholder="Armoire PM 12, trottoir pair"
        hint="Complète l’adresse du site — laissez vide pour reprendre celle du site."
        {...register('locationLabel')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Début prévu"
          type="datetime-local"
          {...(errors.scheduledStart?.message ? { error: errors.scheduledStart.message } : {})}
          {...register('scheduledStart')}
        />
        <Input
          label="Fin prévue"
          type="datetime-local"
          {...(errors.scheduledEnd?.message ? { error: errors.scheduledEnd.message } : {})}
          {...register('scheduledEnd')}
        />
      </div>

      <Textarea label="Notes internes" rows={2} {...register('notes')} />
    </>
  );
}
