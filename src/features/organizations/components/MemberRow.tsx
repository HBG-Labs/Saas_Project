import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/cn';
import type { OrgRole } from '@/types/database';
import type { MemberWithProfile, Team } from '@/types/domain';

import { memberDisplayName } from '../hooks/useMembers';
import { ROLE_LABELS } from '../rbac';

import { RoleSelect } from './RoleSelect';

export interface MemberRowProps {
  member: MemberWithProfile;
  /** L'utilisateur courant se regarde-t-il lui-même ? */
  isSelf: boolean;
  /**
   * Équipes auxquelles cette personne appartient.
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
  onUpdateDetails?: (displayName: string, jobTitle: string) => void;
  onRemove: () => void;
}

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
  onUpdateDetails,
  onRemove,
}: MemberRowProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const name = memberDisplayName(member);
  const isInvited = member.status === 'invited';

  const [editName, setEditName] = useState(name);
  const [editJobTitle, setEditJobTitle] = useState(member.job_title ?? '');

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

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateDetails) {
      onUpdateDetails(editName, editJobTitle);
    }
    setIsEditOpen(false);
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

      <div className="flex items-start gap-2 shrink-0">
        {canUpdateRole && (
          <>
            <Tooltip content="Modifier le nom ou la spécialité / fonction">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditName(name);
                  setEditJobTitle(member.job_title ?? '');
                  setIsEditOpen(true);
                }}
                disabled={busy}
                aria-label={`Modifier les détails de ${name}`}
              >
                <Pencil className="size-3.5" />
                Modifier
              </Button>
            </Tooltip>

            <Modal
              open={isEditOpen}
              onOpenChange={setIsEditOpen}
              title="Modifier le technicien"
              description="Ajustez le nom complet et l'intitulé de poste ou la spécialité."
            >
              <form onSubmit={handleSaveDetails} className="space-y-4">
                <Input
                  label="Nom complet"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ex: Jean Dupont"
                  required
                />
                <Input
                  label="Poste / Spécialité / Fonction"
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  placeholder="Ex: Technicien Fibre Optique, Conducteur de travaux..."
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditOpen(false)}
                    disabled={busy}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" variant="primary" disabled={busy}>
                    {busy ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                </div>
              </form>
            </Modal>
          </>
        )}

        {canUpdateRole && !roleLocked ? (
          <div className="w-48 sm:w-56">
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
            <Button
              variant="outline"
              size="sm"
              disabled
              className={cn(
                'font-semibold opacity-100 disabled:opacity-100 cursor-default',
                member.role === 'owner' && 'border-purple-500/40 bg-purple-500/20 text-purple-700 dark:text-purple-300',
                member.role === 'admin' && 'border-blue-500/40 bg-blue-500/20 text-blue-700 dark:text-blue-300',
                member.role === 'manager' && 'border-sky-500/40 bg-sky-500/20 text-sky-700 dark:text-sky-300',
                member.role === 'technician' && 'border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
              )}
            >
              {ROLE_LABELS[member.role]}
            </Button>
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
