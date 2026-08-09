import { Star, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { memberDisplayName, RoleBadge } from '@/features/organizations';
import type { MemberWithProfile, TeamWithMembers } from '@/types/domain';

import {
  selectableMembers,
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamMemberRole,
} from '../hooks/useTeamMembers';

import { TeamManagerBadge, TeamRoleBadge } from './TeamRoleBadge';

export interface TeamMembersPanelProps {
  team: TeamWithMembers;
  /** Membres actifs de l'organisation, pour l'ajout. */
  organizationMembers: readonly MemberWithProfile[];
  canAssign: boolean;
}

/**
 * Composition d'une équipe.
 *
 * Chaque ligne porte DEUX badges, et c'est le point le plus important de cet
 * écran : le rôle dans l'entreprise (qui donne les permissions) et le rôle dans
 * l'équipe (qui donne le périmètre). Un technicien responsable d'équipe affiche
 * « Technicien » et « Responsable d'équipe » côte à côte — les fondre laisserait
 * croire à une promotion qui n'a pas eu lieu.
 */
export function TeamMembersPanel({
  team,
  organizationMembers,
  canAssign,
}: TeamMembersPanelProps) {
  const addMember = useAddTeamMember(team.id);
  const removeMember = useRemoveTeamMember(team.id);
  const setRole = useSetTeamMemberRole(team.id);

  const members = team.members;
  const busy = addMember.isPending || removeMember.isPending || setRole.isPending;

  return (
    <div className="space-y-4">
      {canAssign ? (
        <div className="flex justify-end">
          <AddMemberDialog
            candidates={selectableMembers(organizationMembers, team)}
            onAdd={(memberId) => {
              addMember.mutate({ memberId });
            }}
            busy={busy}
          />
        </div>
      ) : null}

      {members.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Équipe vide"
          description="Ajoutez des membres de l’entreprise pour pouvoir affecter des missions à cette équipe."
        />
      ) : (
        <ul className="divide-border divide-y">
          {members.map((entry) => {
            const name = memberDisplayName(entry.member);
            const isTeamManager = team.manager_id === entry.member_id;

            return (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={name} size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">{name}</p>
                  <p className="text-muted-foreground text-xs">
                    {entry.member.job_title ?? 'Membre de l’entreprise'}
                  </p>
                </div>

                {/* Rôle dans l'ENTREPRISE — les permissions. */}
                <RoleBadge role={entry.member.role} />

                {/* Rôle dans l'ÉQUIPE — le périmètre. */}
                <TeamRoleBadge role={entry.role} />

                {isTeamManager ? <TeamManagerBadge /> : null}

                {canAssign ? (
                  <div className="flex items-center gap-1">
                    <Tooltip
                      content={
                        entry.role === 'lead'
                          ? 'Retirer le rôle de responsable d’équipe'
                          : 'Désigner responsable d’équipe'
                      }
                    >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setRole.mutate({
                            teamMemberId: entry.id,
                            role: entry.role === 'lead' ? 'member' : 'lead',
                          });
                        }}
                        disabled={busy}
                        className={entry.role === 'lead' ? 'text-accent-foreground' : undefined}
                        aria-label={`Basculer le rôle d’équipe de ${name}`}
                      >
                        <Star className="size-4" />
                      </Button>
                    </Tooltip>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        removeMember.mutate(entry.id);
                      }}
                      disabled={busy}
                      className="text-muted-foreground hover:text-error"
                      aria-label={`Retirer ${name} de l’équipe`}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Aucune contrainte serveur n'impose qu'une équipe ait un responsable :
        on avertit sans bloquer. Inventer ici une règle absente de la base
        produirait une interface plus stricte que l'autorité — et ferait
        chercher un refus qui ne viendrait jamais.
      */}
      {members.length > 0 && !members.some((entry) => entry.role === 'lead') ? (
        <p className="text-warning text-xs">
          Aucun responsable d’équipe désigné. Personne ne pourra gérer sa composition sans
          permission d’entreprise.
        </p>
      ) : null}
    </div>
  );
}

function AddMemberDialog({
  candidates,
  onAdd,
  busy,
}: {
  candidates: readonly MemberWithProfile[];
  onAdd: (memberId: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Ajouter un membre"
      description="Seuls les membres actifs de l’entreprise qui ne font pas déjà partie de l’équipe sont proposés."
      trigger={
        <Button variant="outline" size="sm" disabled={candidates.length === 0}>
          <UserPlus className="size-4" />
          Ajouter un membre
        </Button>
      }
    >
      <div className="space-y-4">
        {candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Tous les membres actifs de l’entreprise font déjà partie de cette équipe.
          </p>
        ) : (
          <Select
            options={candidates.map((member) => ({
              value: member.id,
              label: memberDisplayName(member),
            }))}
            value={selected}
            onValueChange={setSelected}
            label="Membre"
            placeholder="Choisir un membre"
          />
        )}

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
            disabled={selected === '' || busy}
            onClick={() => {
              onAdd(selected);
              setSelected('');
              setOpen(false);
            }}
          >
            Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  );
}
