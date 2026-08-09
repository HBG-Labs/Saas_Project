import { Building2 } from 'lucide-react';
import { Outlet } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { useCurrentOrganization } from '@/features/organizations';

/**
 * Réserve une branche de routes aux membres d'une organisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE COMPOSANT NE SÉCURISE RIEN.
 *
 * Un utilisateur qui atteindrait la route sans appartenance ne verrait de toute
 * façon aucune donnée : chaque policy du module professionnel filtre par
 * `app.my_organization_ids()`. Ce garde évite simplement d'afficher une
 * succession d'écrans vides sans jamais dire pourquoi.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Volontairement sans redirection : tant que l'écran de création d'entreprise
 * n'existe pas, rediriger produirait une page introuvable — plus déroutant
 * encore que l'écran vide qu'on cherche à éviter. Le message explique la
 * situation ; la redirection viendra avec l'écran d'accueil.
 */
export function RequireOrganization() {
  const { status } = useCurrentOrganization();

  if (status === 'loading') {
    return <LoadingScreen label="Chargement de votre espace de travail…" />;
  }

  if (status === 'none') {
    return (
      <EmptyState
        icon={Building2}
        title="Aucune entreprise rattachée à votre compte"
        description="Le suivi des missions, des équipes et des interventions s’organise par entreprise. Demandez une invitation à votre responsable, ou créez la vôtre pour commencer."
      />
    );
  }

  return <Outlet />;
}
