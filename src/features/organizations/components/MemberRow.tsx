import { Trash2, UserMinus } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Tooltip } from '@/components/ui/Tooltip';
import type { OrgRole } from '@/types/database';
import type { MemberWithProfile, Team } from '@/types/domain';

import { memberDisplayName } from '../hooks/useMembers';

import { RoleBadge } from './RoleBadge';
import { RoleSelect } from './RoleSelect';

export interface MemberRowProps {
  member: MemberWithProfile;
  /** L'utilisateur courant se regarde-t-il lui-même ? */
  isSelf: boolean;
  /**
   * Équipes auxquelles cette personne appartient.
   *
   * Le rôle dit ce qu'elle a le droit de faire ; l'équipe dit avec qui elle le
   * fait — et c'est par elle que les missions lui parviennent. Un « technicien »
   * sans équipe ne recevra jamais rien, ce que la ligne ne laissait pas voir.
   */
  teams?: readonly Team[];
  /** Dernier propriétaire actif : ni retrait ni rétrogradation possibles. */
  isLastOwner: boolean;
  canUpdateRole: boolean;
  canRemove: boolean;
  /** Seul un propriétaire peut en désigner un autre. */
  viewerIsOwner: boolean;
  busy: boolean;
  onRoleChange: (role: OrgRole) => void;
  onRemove: () => void;
}

/**
 * Ligne de membre.
 *
 * Trois règles métier appliquées par des triggers se lisent ici. L'interface ne
 * les APPLIQUE pas — elle évite de proposer une action qui sera refusée, et
 * surtout elle DIT pourquoi. Un bouton grisé sans explication est une énigme ;
 * une infobulle qui nomme la raison est une réponse.
 *
 *   • `protect_last_owner`          — le dernier propriétaire est intouchable
 *   • `prevent_privilege_escalation` — nul ne modifie son propre rôle
 *   • idem                           — seul un propriétaire en crée un autre
 */
export function MemberRow({
  member,
  isSelf,
  teams = [],
  isLastOwner,
  canUpdateRole,
  canRemove,
  viewerIsOwner,
  busy,
  onRoleChange,
  onRemove,
}: MemberRowProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const name = memberDisplayName(member);
  const isInvited = member.status === 'invited';

  const roleLocked = isSelf || isLastOwner;
  const roleLockReason = isSelf
    ? 'Vous ne pouvez pas modifier votre propre rôle. Un autre administrateur doit s’en charger.'
    : 'Cette personne est le dernier propriétaire : l’entreprise deviendrait ingérable.';

  const removeLocked = isSelf || isLastOwner;
  const removeLockReason = isSelf
    ? 'Vous ne pouvez pas vous retirer vous-même.'
    : 'Le dernier propriétaire ne peut pas être retiré.';

  const handleConfirmRemove = () => {
    setIsConfirmOpen(false);
    onRemove();
  };

  return (
    <li className="border-border flex flex-wrap items-start justify-between gap-4 border-b py-4 last:border-b-0">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Avatar name={name} size="sm" className="mt-0.5" />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-foreground truncate text-sm font-medium">{name}</p>
            {isInvited ? <Badge variant="warning">Invitation en attente</Badge> : null}
          </div>

          {member.job_title !== null && member.job_title !== '' && name !== member.job_title ? (
            <p className="text-muted-foreground truncate text-xs">{member.job_title}</p>
          ) : null}

          {teams.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="text-muted-foreground flex items-center gap-1.5 text-xs"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color ?? 'var(--color-border-strong)' }}
                  />
                  {team.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex items-start gap-3 shrink-0">
        {canUpdateRole && !roleLocked ? (
          <div className="w-56 sm:w-64">
            <RoleSelect
              value={member.role}
              onChange={onRoleChange}
              canAssignOwner={viewerIsOwner}
              disabled={busy}
              hideLabel
              label={`Rôle de ${name}`}
            />
          </div>
        ) : (
          <Tooltip content={canUpdateRole ? roleLockReason : 'Rôle non modifiable par vous.'}>
            <span>
              <RoleBadge role={member.role} />
            </span>
          </Tooltip>
        )}

        {canRemove ? (
          removeLocked ? (
            <Tooltip content={removeLockReason}>
              <span>
                <Button variant="danger-outline" size="sm" disabled aria-label={`Retirer ${name}`}>
                  <Trash2 className="size-3.5" />
                  Supprimer
                </Button>
              </span>
            </Tooltip>
          ) : (
            <>
              <Button
                variant="danger-outline"
                size="sm"
                onClick={() => {
                  setIsConfirmOpen(true);
                }}
                disabled={busy}
                aria-label={`Retirer ${name}`}
              >
                <Trash2 className="size-3.5" />
                Supprimer
              </Button>

              <Modal
                open={isConfirmOpen}
                onOpenChange={setIsConfirmOpen}
                title="Supprimer le membre"
                description={`Êtes-vous sûr de vouloir retirer ${name} de l'entreprise ?`}
                footer={
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsConfirmOpen(false);
                      }}
                      disabled={busy}
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="danger-outline"
                      size="sm"
                      onClick={handleConfirmRemove}
                      disabled={busy}
                    >
                      {busy ? 'Suppression…' : 'Supprimer le membre'}
                    </Button>
                  </div>
                }
              >
                <p className="text-muted-foreground text-sm">
                  Cette personne n'aura plus accès aux outils, missions et données de l'organisation.
                </p>
              </Modal>
            </>
          )
        ) : null}
      </div>
    </li>
  );
}
