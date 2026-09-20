import { AlertTriangle, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { memberDisplayName, RoleBadge } from '@/features/organizations';
import type { TeamMemberRole } from '@/types/database';
import type { MemberWithProfile, TeamWithMembers } from '@/types/domain';

import {
  selectableMembers,
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamMemberRole,
} from '../hooks/useTeamMembers';

import { TeamRoleBadge } from './TeamRoleBadge';

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
export function TeamMembersPanel({ team, organizationMembers, canAssign }: TeamMembersPanelProps) {
  const addMember = useAddTeamMember(team.id);
  const removeMember = useRemoveTeamMember(team.id);
  const setRole = useSetTeamMemberRole(team.id);

  const members = [...team.members].sort((a, b) => {
    const isALead = a.role === 'lead';
    const isBLead = b.role === 'lead';
    if (isALead && !isBLead) return -1;
    if (!isALead && isBLead) return 1;
    return memberDisplayName(a.member).localeCompare(memberDisplayName(b.member), 'fr');
  });
  const busy = addMember.isPending || removeMember.isPending || setRole.isPending;

  return (
    <div className="space-y-4">
      {canAssign ? (
        <div className="flex justify-stretch sm:justify-end">
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
            const isLead = entry.role === 'lead';

            return (
              <li
                key={entry.id}
                className="hover:bg-surface-hover focus-within:bg-surface-hover flex flex-col gap-3 px-1 py-4 transition-colors sm:flex-row sm:items-center sm:px-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar
                    avatarId={entry.member.profile?.avatar_id ?? null}
                    name={name}
                    size="lg"
                    className="ring-border bg-surface ring-1"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-semibold">{name}</p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {entry.member.job_title ?? 'Membre de l’entreprise'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
                      <RoleBadge role={entry.member.role} />
                      {!canAssign ? <TeamRoleBadge role={isLead ? 'lead' : 'member'} /> : null}
                    </div>
                  </div>
                </div>

                {/* Rôle dans l'ENTREPRISE — les permissions. */}
                <div className="hidden sm:block">
                  <RoleBadge role={entry.member.role} />
                </div>

                {/* Rôle dans l'ÉQUIPE — le sélecteur pour choisir le responsable. */}
                {canAssign ? (
                  <div className="w-full sm:w-48">
                    <Select
                      value={isLead ? 'lead' : 'member'}
                      onValueChange={(val) => {
                        setRole.mutate({
                          teamMemberId: entry.id,
                          role: val as TeamMemberRole,
                        });
                      }}
                      options={[
                        { value: 'member', label: "Membre d'équipe" },
                        { value: 'lead', label: "Responsable d'équipe" },
                      ]}
                      hideLabel
                      label={`Rôle d'équipe de ${name}`}
                      disabled={busy}
                    />
                  </div>
                ) : (
                  <div className="hidden sm:block">
                    <TeamRoleBadge role={isLead ? 'lead' : 'member'} />
                  </div>
                )}

                {canAssign ? (
                  <div className="flex items-center sm:justify-end">
                    <Button
                      variant="danger-outline"
                      size="sm"
                      onClick={() => {
                        removeMember.mutate(entry.id);
                      }}
                      disabled={busy}
                      className="w-full sm:w-auto sm:px-2"
                      aria-label={`Retirer ${name} de l’équipe`}
                    >
                      <UserMinus className="size-4" />
                      <span className="sm:sr-only">Retirer de l’équipe</span>
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
        <div className="border-warning/35 bg-warning-subtle text-foreground flex items-start gap-2.5 rounded-xl border p-3 text-xs">
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Aucun responsable désigné.</strong>{' '}
            <span className="text-muted-foreground">
              Personne ne pourra gérer la composition de cette équipe sans permission d’entreprise.
            </span>
          </p>
        </div>
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
        <Button
          variant="outline"
          size="sm"
          disabled={candidates.length === 0}
          className="w-full sm:w-auto"
        >
          <UserPlus className="size-4" />
          Ajouter un membre
        </Button>
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={selected === '' || busy}
            isLoading={busy}
            loadingLabel="Ajout du membre"
            onClick={() => {
              onAdd(selected);
              setSelected('');
              setOpen(false);
            }}
            className="w-full sm:w-auto"
          >
            Ajouter
          </Button>
        </div>
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
      </div>
    </Modal>
  );
}
