import { ShieldOff } from 'lucide-react';
import { Outlet } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { usePlatformAdmin } from '@/features/prospecting';

export interface RequirePlatformAdminProps {
  /** Permission plateforme exigée (ex. `prospecting.view`). */
  permission: string;
}

/**
 * Réserve une branche de routes aux administrateurs plateforme REZO360 —
 * jamais aux clients, quel que soit leur rôle dans leur propre organisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE COMPOSANT NE SÉCURISE RIEN, EXACTEMENT COMME `RequirePermission`.
 *
 * Le refus qui compte vient des policies RLS de `platform_admins`,
 * `platform_admin_permissions` et de chaque table `prospect*`
 * (`app.has_platform_permission`, Phase 2) : un client qui atteindrait la
 * route à la main ne verrait toujours rien. Ce garde évite seulement d'y
 * laisser apparaître une page vide sans explication.
 *
 * Contrairement à `RequirePermission` (rôle dans `organization_members`),
 * ceci ne dépend d'AUCUNE organisation — c'est tout l'enjeu : un utilisateur
 * sans organisation, ou membre d'une organisation cliente ordinaire, peut être
 * administrateur plateforme ou ne jamais l'être, indépendamment de son rôle
 * organisationnel.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function RequirePlatformAdmin({ permission }: RequirePlatformAdminProps) {
  const { isAdmin, isLoading, can } = usePlatformAdmin();

  if (isLoading) {
    return <LoadingScreen label="Vérification des droits…" />;
  }

  if (!isAdmin || !can(permission)) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Cette section ne vous est pas accessible"
        description="Réservée aux administrateurs REZO360. Si vous pensez que c'est une erreur, contactez l'équipe REZO360."
      />
    );
  }

  return <Outlet />;
}
