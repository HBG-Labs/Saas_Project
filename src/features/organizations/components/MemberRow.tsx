import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Tooltip } from '@/components/ui/Tooltip';
import { UserAvatar } from '@/components/ui/UserAvatar';
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
    <li className="border-border bg-surface-raised hover:border-primary/25 hover:shadow-raised focus-within:border-primary/30 flex flex-col gap-4 rounded-xl border p-3.5 transition-[border-color,box-shadow,transform] motion-reduce:hover:translate-y-0 sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:hover:-translate-y-0.5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <UserAvatar
          avatarId={member.profile?.avatar_id ?? null}
          name={name}
          size="lg"
          className="ring-border bg-surface shrink-0 ring-1"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-foreground truncate text-sm font-medium">{name}</p>
            {isSelf ? <Badge variant="neutral">Vous</Badge> : null}
            {isInvited ? <Badge variant="warning">Invitation en attente</Badge> : null}
          </div>

          {member.job_title !== null && member.job_title !== '' && name !== member.job_title ? (
            <p className="text-muted-foreground truncate text-xs">{member.job_title}</p>
          ) : null}

          {teams.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-1.5 pt-1.5">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="border-border bg-surface-sunken/60 text-muted-foreground text-2xs flex items-center gap-1.5 rounded-full border px-2 py-1 font-medium"
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

      {/*
        `flex-wrap` plutôt que `shrink-0`.

        `shrink-0` empêchait ce groupe de se réduire, et rien ne l'autorisait à
        se replier : sur iPhone SE il dépassait sa rangée de 13 px, mesuré. Les
        boutons passent maintenant à la ligne quand la place manque, ce qui est
        le comportement attendu d'une barre d'actions étroite.
      */}
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-start sm:justify-end">
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
                className="w-full sm:w-auto"
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
              footer={
                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditOpen(false)}
                    disabled={busy}
                    className="w-full sm:w-auto"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    form={`member-details-${member.id}`}
                    variant="primary"
                    disabled={busy}
                    isLoading={busy}
                    loadingLabel="Enregistrement du membre"
                    className="w-full sm:w-auto"
                  >
                    {busy ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                </div>
              }
            >
              <form
                id={`member-details-${member.id}`}
                onSubmit={handleSaveDetails}
                className="space-y-4"
              >
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
              </form>
            </Modal>
          </>
        )}

        {canUpdateRole && !roleLocked ? (
          <div className="w-full sm:w-56">
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
                'w-full cursor-default font-semibold opacity-100 disabled:opacity-100 sm:w-auto',
                member.role === 'owner' && 'border-accent/40 bg-accent/20 text-accent',
                member.role === 'admin' && 'border-primary/40 bg-primary/20 text-primary',
                member.role === 'manager' && 'border-primary/40 bg-primary/20 text-primary',
                member.role === 'technician' && 'border-success/40 bg-success/20 text-success',
              )}
            >
              {ROLE_LABELS[member.role]}
            </Button>
          </Tooltip>
        )}

        {canRemove ? (
          removeLocked ? (
            <Tooltip content={removeLockReason}>
              <span className="block w-full sm:w-auto">
                <Button
                  variant="danger-outline"
                  size="sm"
                  disabled
                  aria-label={`Retirer ${name}`}
                  className="w-full sm:w-auto"
                >
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
                className="w-full sm:w-auto"
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
                  <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsConfirmOpen(false);
                      }}
                      disabled={busy}
                      className="w-full sm:w-auto"
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleConfirmRemove}
                      disabled={busy}
                      isLoading={busy}
                      loadingLabel="Suppression du membre"
                      className="w-full sm:w-auto"
                    >
                      {busy ? 'Suppression…' : 'Supprimer le membre'}
                    </Button>
                  </div>
                }
              >
                <p className="text-muted-foreground text-sm">
                  Cette personne n'aura plus accès aux outils, missions et données de
                  l'organisation.
                </p>
              </Modal>
            </>
          )
        ) : null}
      </div>
    </li>
  );
}
