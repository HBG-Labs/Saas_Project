import { ShieldOff } from 'lucide-react';
import { Outlet } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { usePermission, ROLE_LABELS, type Permission } from '@/features/organizations';

export interface RequirePermissionProps {
  /** Permission exigée pour accéder à la branche de routes. */
  permission: Permission;
}

/**
 * Réserve une branche de routes à un niveau de droits.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE COMPOSANT NE SÉCURISE RIEN.
 *
 * Le refus qui compte vient des policies RLS. Ici, on épargne à l'utilisateur
 * un écran qu'il ne pourrait pas remplir — et surtout on lui DIT pourquoi.
 * Une page blanche laisse croire à une panne ; un message sur les droits
 * l'oriente vers la bonne personne.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function RequirePermission({ permission }: RequirePermissionProps) {
  const { can, role } = usePermission();

  if (!can(permission)) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Cette section ne vous est pas accessible"
        description={
          role === null
            ? 'Votre appartenance à cette entreprise n’est pas active. Contactez un administrateur.'
            : `Votre rôle (${ROLE_LABELS[role]}) ne permet pas d’accéder à cette section. Un propriétaire ou un administrateur peut le modifier.`
        }
      />
    );
  }

  return <Outlet />;
}
