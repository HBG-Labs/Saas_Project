import { UserCheck } from 'lucide-react';
import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth';
import { memberDisplayName } from '@/features/organizations';
import type { MemberWithProfile, Team } from '@/types/domain';

import { useAssignMission } from '../hooks/useMissions';

export interface AssignMissionDialogProps {
  missionId: string;
  teams: readonly Team[];
  members: readonly MemberWithProfile[];
  currentTeamId: string | null;
  currentMemberId: string | null;
}

/**
 * Affectation d'une mission à une équipe et/ou à un intervenant.
 *
 * Les deux ne s'excluent pas : `missions` porte `assigned_team_id` ET
 * `assigned_user_id`. Sur le terrain, on confie souvent un chantier à une équipe
 * en désignant qui en répond — et `app.is_mission_assignee()` reconnaît les deux
 * voies, si bien qu'un membre de l'équipe affectée peut faire avancer la mission
 * même sans être nommément désigné.
 *
 * Affecter fait passer la mission en `assigned` : c'est la transition
 * `draft → assigned`, arbitrée par le trigger comme toutes les autres.
 */
export function AssignMissionDialog({
  missionId,
  teams,
  members,
  currentTeamId,
  currentMemberId,
}: AssignMissionDialogProps) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState(currentTeamId ?? '');
  const [memberId, setMemberId] = useState(currentMemberId ?? '');
  const [error, setError] = useState<unknown>(null);

  const { user } = useAuth();
  const assignMission = useAssignMission(missionId);

  const submit = () => {
    if (user === null) return;

    setError(null);
    assignMission.mutate(
      {
        teamId: teamId === '' ? null : teamId,
        memberId: memberId === '' ? null : memberId,
        assignedBy: user.id,
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
        onError: (mutationError) => {
          setError(mutationError);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Affecter la mission"
      description="Une équipe, un intervenant, ou les deux. La mission passe alors à l’état « Affectée »."
      trigger={
        <Button variant="outline" size="sm">
          <UserCheck className="size-4" />
          Affecter
        </Button>
      }
    >
      <div className="space-y-4">
        <FormError error={error} />

        <Select
          options={teams.map((team) => ({ value: team.id, label: team.name }))}
          value={teamId}
          onValueChange={setTeamId}
          label="Équipe"
          placeholder="Aucune équipe"
          hint="Tout membre de l’équipe pourra faire avancer la mission."
        />

        <Select
          options={members.map((member) => ({
            value: member.id,
            label: memberDisplayName(member),
          }))}
          value={memberId}
          onValueChange={setMemberId}
          label="Intervenant"
          placeholder="Aucun intervenant désigné"
        />

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={assignMission.isPending || (teamId === '' && memberId === '')}
          >
            {assignMission.isPending ? 'Affectation…' : 'Affecter'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
