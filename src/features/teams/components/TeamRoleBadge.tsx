import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import type { TeamMemberRole } from '@/types/database';

/**
 * Rôle d'un membre DANS L'ÉQUIPE — à ne jamais confondre avec son rôle
 * d'entreprise.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DEUX BADGES DISTINCTS
 *
 * Un technicien peut être `lead` d'une équipe. Il la pilote — ajouter des
 * membres, modifier la fiche — sans gagner la moindre permission RBAC : il ne
 * contrôlera jamais un compte rendu. Fondre les deux notions en un seul badge
 * ferait croire à une promotion qui n'a pas eu lieu, et ferait chercher des
 * droits qui n'existent pas.
 *
 * Côté serveur la séparation est nette : `organization_members.role` porte les
 * permissions, `team_members.role` élargit seulement `app.my_led_team_ids()`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function TeamRoleBadge({ role }: { role: TeamMemberRole }) {
  if (role !== 'lead') {
    return <Badge variant="neutral">Membre d’équipe</Badge>;
  }

  return (
    <Tooltip content="Pilote cette équipe : composition et fiche. N’accorde aucune permission d'administration globale dans l’entreprise.">
      <span>
        <Badge variant="warning">Responsable d’équipe</Badge>
      </span>
    </Tooltip>
  );
}

/**
 * Responsable désigné au niveau de l'équipe (`teams.manager_id`).
 *
 * Troisième niveau, distinct des deux autres et souvent oublié :
 * `app.my_led_team_ids()` lui accorde exactement le même pouvoir opérationnel
 * qu'à un `lead`. Ne pas l'afficher ferait passer un responsable pour un simple
 * observateur.
 */
export function TeamManagerBadge() {
  return (
    <Tooltip content="Responsable désigné de l’équipe. Mêmes pouvoirs opérationnels qu’un responsable d’équipe.">
      <span>
        <Badge variant="info">Responsable désigné</Badge>
      </span>
    </Tooltip>
  );
}
