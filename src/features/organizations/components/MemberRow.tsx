import { UserMinus } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import type { OrgRole } from '@/types/database';
import type { MemberWithProfile } from '@/types/domain';

import { memberDisplayName } from '../hooks/useMembers';

import { RoleBadge } from './RoleBadge';
import { RoleSelect } from './RoleSelect';

export interface MemberRowProps {
  member: MemberWithProfile;
  /** L'utilisateur courant se regarde-t-il lui-même ? */
  isSelf: boolean;
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
  isLastOwner,
  canUpdateRole,
  canRemove,
  viewerIsOwner,
  busy,
  onRoleChange,
  onRemove,
}: MemberRowProps) {
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

  return (
    <li className="border-border flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0">
      <Avatar name={name} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">{name}</p>
        {member.job_title !== null && member.job_title !== '' && name !== member.job_title ? (
          <p className="text-muted-foreground truncate text-xs">{member.job_title}</p>
        ) : null}
      </div>

      {isInvited ? <Badge variant="warning">Invitation en attente</Badge> : null}

      {canUpdateRole && !roleLocked ? (
        <div className="w-44">
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
              <Button variant="ghost" size="icon-sm" disabled aria-label={`Retirer ${name}`}>
                <UserMinus className="size-4" />
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            disabled={busy}
            className="text-muted-foreground hover:text-error"
            aria-label={`Retirer ${name}`}
          >
            <UserMinus className="size-4" />
          </Button>
        )
      ) : null}
    </li>
  );
}
