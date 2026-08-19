import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { syncSubscriptionSeats } from '@/features/billing';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/services/supabase';
import type { OrgRole } from '@/types/database';

import {
  acceptInvitation,
  acceptInvitationWithSignup,
  getInvitationPreview,
  inviteMember,
  listInvitations,
  revokeInvitation,
  sendInvitationEmail,
} from '../api/organizations.api';

import { useCurrentOrganization } from './useCurrentOrganization';

export function useInvitations(organizationId: string | null) {
  return useQuery({
    queryKey: qk.organizations.invitations(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listInvitations(organizationId)),
    enabled: organizationId !== null,
  });
}

/**
 * Crée l'invitation, puis tente d'en envoyer le courriel.
 *
 * Les deux étapes sont volontairement dissociées : l'invitation est un FAIT
 * enregistré en base, l'envoi n'est qu'un acheminement. Lier leur sort ferait
 * disparaître une invitation valide parce qu'un serveur de messagerie a
 * répondu de travers.
 *
 * Le résultat porte donc `emailSent`, que l'écran traduit : « envoyée à … »
 * quand c'est parti, « à transmettre vous-même » sinon — avec le lien dans les
 * deux cas.
 */
export function useInviteMember(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; role: OrgRole }) => {
      const invitation = await inviteMember({
        organizationId,
        email: input.email,
        role: input.role,
      });

      const email = await sendInvitationEmail(invitation.id);

      return { invitation, emailSent: email.sent, emailReason: email.reason };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.organizations.invitations(organizationId),
      });
    },
  });
}

/** Réémet le courriel d'une invitation déjà créée, sans en créer une seconde. */
export function useResendInvitationEmail() {
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await sendInvitationEmail(invitationId);
      if (!result.sent) {
        throw new Error(
          result.reason ??
            "Le courriel n'a pas pu être envoyé. Transmettez le lien ci-dessous à votre collaborateur.",
        );
      }
      return result;
    },
  });
}

export function useRevokeInvitation(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.organizations.invitations(organizationId),
      });
    },
  });
}

/**
 * Aperçu d'une invitation avant acceptation.
 *
 * `retry: false` : un jeton invalide le restera. Réessayer trois fois ne ferait
 * qu'allonger l'attente avant d'afficher le message qui explique la situation.
 */
export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: qk.organizations.invitationPreview(token ?? 'none'),
    queryFn: () => (token === undefined ? null : getInvitationPreview(token)),
    enabled: token !== undefined,
    retry: false,
  });
}

/**
 * Accepte une invitation et bascule sur l'organisation rejointe.
 *
 * L'ordre compte : on sélectionne AVANT d'invalider, puis on attend le
 * rechargement de la liste. L'inverse afficherait brièvement l'écran « aucune
 * entreprise » à quelqu'un qui vient précisément d'en rejoindre une.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const { select } = useCurrentOrganization();

  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: async (organizationId) => {
      select(organizationId);
      await queryClient.invalidateQueries({ queryKey: qk.organizations.all });
      await queryClient.invalidateQueries({ queryKey: qk.billing.all });

      // C'est ICI qu'un siège devient payant : `accept_organization_invitation`
      // fait passer la ligne de `invited` à `active`, et seuls les membres
      // actifs sont facturés. Sans cet appel, l'organisation grandirait sans
      // que Stripe en sache rien.
      //
      // L'échec est absorbé : refuser l'entrée dans l'entreprise parce que la
      // facturation n'a pas suivi serait absurde.
      await syncSubscriptionSeats(organizationId);
    },
  });
}

/**
 * Crée le compte de l'invité, puis ouvre sa session.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI LA CONNEXION SUIT IMMÉDIATEMENT
 *
 * Le compte est créé déjà confirmé, et la personne vient de choisir son mot de
 * passe : lui demander de le ressaisir sur un écran de connexion serait lui
 * faire refaire ce qu'elle vient de faire. On enchaîne donc, et elle arrive
 * dans l'entreprise.
 *
 * `signInWithPassword` plutôt qu'une session renvoyée par la fonction : la
 * bibliothèque doit poser elle-même le jeton et son rafraîchissement.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useAcceptInvitationWithSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { token: string; password: string; displayName?: string }) => {
      const { email } = await acceptInvitationWithSignup(input);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: input.password,
      });

      // Le compte EXISTE et a rejoint l'entreprise : un échec de connexion ici
      // n'annule rien, il demande seulement de se connecter à la main.
      if (error) {
        throw new Error(
          'Votre compte est créé et rattaché à l’entreprise, mais la connexion automatique a échoué. Connectez-vous avec l’adresse invitée.',
        );
      }

      return email;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.organizations.all });
    },
  });
}
