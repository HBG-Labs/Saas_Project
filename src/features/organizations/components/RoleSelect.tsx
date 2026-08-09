import { Select } from '@/components/ui/Select';
import type { OrgRole } from '@/types/database';

import { ORG_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../rbac';

export interface RoleSelectProps {
  value: OrgRole;
  onChange: (role: OrgRole) => void;
  /**
   * `false` retire « Propriétaire » des choix.
   *
   * Le trigger `prevent_privilege_escalation` refuse déjà qu'un non-propriétaire
   * en crée un. Masquer l'option évite de proposer une action systématiquement
   * rejetée — sans rien sécuriser : c'est le trigger qui décide.
   */
  canAssignOwner?: boolean;
  disabled?: boolean;
  label?: string;
  hideLabel?: boolean;
  id?: string;
}

export function RoleSelect({
  value,
  onChange,
  canAssignOwner = false,
  disabled = false,
  label = 'Rôle',
  hideLabel = false,
  id,
}: RoleSelectProps) {
  const options = ORG_ROLES.filter((role) => canAssignOwner || role !== 'owner').map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  return (
    <Select
      options={options}
      value={value}
      onValueChange={(next) => onChange(next as OrgRole)}
      label={label}
      hideLabel={hideLabel}
      // La description du rôle SÉLECTIONNÉ plutôt qu'une aide générique :
      // « Responsable » ne dit rien de ce qu'il pourra faire, et personne
      // n'ouvre la documentation pour attribuer un rôle.
      hint={ROLE_DESCRIPTIONS[value]}
      disabled={disabled}
      {...(id !== undefined ? { id } : {})}
    />
  );
}
