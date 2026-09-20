import { useCallback, useMemo } from 'react';

import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { useClientConversations, useClientPortalAccess } from '@/features/client-portal';
import { calibrationState, useEquipmentList } from '@/features/equipment';
import { useReportsPendingReview } from '@/features/interventions';
import { useMissions } from '@/features/missions';
import {
  memberDisplayName,
  PERMISSIONS,
  useCurrentOrganization,
  useMembers,
  usePermission,
} from '@/features/organizations';
import { useLeaveRequests } from '@/features/planning';
import { useQuotes } from '@/features/quotes';
import { useUserPreferences } from '@/features/settings';
import { useStock } from '@/features/stock';

import type { AppNotification } from '../types/notifications.types';

import { useNotificationStates } from './useNotificationStates';

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { can, role } = usePermission();
  const { preferences } = useUserPreferences();

  const isManagerOrOwner =
    can(PERMISSIONS.leaveApprove) || role === 'owner' || role === 'admin' || role === 'manager';

  /*
    L'état lu / écarté vient de la base — et suit la personne d'un appareil à
    l'autre. Le changement de compte n'a plus rien à remettre à niveau ici :
    la clé de requête porte l'utilisateur et l'organisation, React Query
    change de cache tout seul.
  */
  const etats = useNotificationStates(userId, organizationId);
  const { readIds, dismissedIds } = etats;

  // Queries
  const membersQuery = useMembers(organizationId);
  const currentMember = useMemo(
    () => membersQuery.data?.find((m) => m.user_id === userId),
    [membersQuery.data, userId],
  );

  const leavesQuery = useLeaveRequests(organizationId);
  const pendingReportsQuery = useReportsPendingReview(isManagerOrOwner ? organizationId : null);
  const { lowStockArticles } = useStock(organizationId);
  const missionsQuery = useMissions(organizationId, { limit: 20 });
  const equipmentQuery = useEquipmentList(can(PERMISSIONS.equipmentView) ? organizationId : null);
  // Messages clients non lus : la requête ne part que si la formule et la
  // permission le permettent — sinon elle ne renverrait rien de toute façon.
  const portal = useClientPortalAccess();
  const conversationsQuery = useClientConversations(organizationId, undefined, portal.canView);
  // Réponses aux devis depuis le portail : la date `client_responded_at` n'est
  // posée que par `portal_respond_quote`, jamais par l'entreprise.
  const quotesQuery = useQuotes(
    portal.canView && can(PERMISSIONS.quoteView) ? organizationId : null,
  );

  // Génération des notifications d'activité
  const notifications = useMemo(() => {
    const list: AppNotification[] = [];

    // 1. Demandes de congés
    const leaves = leavesQuery.data ?? [];
    for (const leave of preferences.notify_leave_requests ? leaves : []) {
      const isMyLeave = Boolean(
        (leave.member?.user_id && leave.member.user_id === userId) ||
        (currentMember?.id && leave.member_id === currentMember.id),
      );

      // Pour les managers/dirigeants : congés en attente des équipes
      if (isManagerOrOwner && leave.status === 'pending' && !isMyLeave) {
        const applicantName = leave.member ? memberDisplayName(leave.member) : 'Un collaborateur';
        list.push({
          id: `leave_pending_${leave.id}`,
          type: 'leave_request',
          category: 'hr',
          severity: 'warning',
          title: 'Demande de congé en attente',
          description: `${applicantName} a déposé une demande de congé (${leave.start_date} au ${leave.end_date}).`,
          timestamp: leave.requested_at,
          read: readIds.has(`leave_pending_${leave.id}`),
          link: ROUTES.planning,
        });
      }

      // Pour l'utilisateur : retour sur ses propres congés (validé ou refusé)
      if (isMyLeave && (leave.status === 'approved' || leave.status === 'rejected')) {
        const statusLabel = leave.status === 'approved' ? 'validée' : 'refusée';
        list.push({
          id: `leave_status_${leave.id}_${leave.status}`,
          type: 'leave_status',
          category: 'hr',
          severity: leave.status === 'approved' ? 'success' : 'urgent',
          title: `Demande de congé ${statusLabel}`,
          description: `Votre demande du ${leave.start_date} au ${leave.end_date} a été ${statusLabel}.`,
          timestamp: leave.reviewed_at || leave.requested_at,
          read: readIds.has(`leave_status_${leave.id}_${leave.status}`),
          link: ROUTES.planning,
        });
      }
    }

    // 2. Rapports d'intervention à contrôler (pour les managers)
    if (isManagerOrOwner) {
      const pendingReports = pendingReportsQuery.data ?? [];
      for (const report of pendingReports) {
        const missionTitle = report.intervention?.mission?.title ?? 'Intervention';
        list.push({
          id: `report_review_${report.id}`,
          type: 'report_review',
          category: 'mission',
          severity: 'warning',
          title: 'Compte rendu à valider',
          description: `Rapport pour la mission "${missionTitle}" en attente de contrôle.`,
          timestamp: report.submitted_at || new Date().toISOString(),
          read: readIds.has(`report_review_${report.id}`),
          link: ROUTES.review,
        });
      }
    }

    // 3. Alertes de stock bas
    if (isManagerOrOwner) {
      for (const item of preferences.notify_stock_low ? lowStockArticles : []) {
        list.push({
          id: `stock_low_${item.id}_${item.quantityInStock}`,
          type: 'stock_alert',
          category: 'stock',
          severity: item.quantityInStock === 0 ? 'urgent' : 'warning',
          title: item.quantityInStock === 0 ? 'Rupture de stock' : 'Stock bas',
          description: `Le consommable "${item.name}" a atteint son seuil d'alerte (${item.quantityInStock} ${item.unit ?? 'unités'} restantes).`,
          timestamp: item.updatedAt || new Date().toISOString(),
          read: readIds.has(`stock_low_${item.id}_${item.quantityInStock}`),
          link: ROUTES.stock,
        });
      }
    }

    // 4. Nouvelles missions attribuées récemment (pour les techniciens)
    if (preferences.notify_new_mission && role === 'technician' && currentMember) {
      const myMissions = (missionsQuery.data ?? []).filter(
        (m) => m.assigned_member?.id === currentMember.id,
      );
      for (const mission of myMissions.slice(0, 5)) {
        if (mission.status === 'assigned' || mission.status === 'in_progress') {
          list.push({
            id: `mission_assigned_${mission.id}`,
            type: 'mission_assigned',
            category: 'mission',
            severity: 'info',
            title: 'Mission attribuée',
            description: `Vous avez été affecté à la mission "${mission.title}" (${mission.reference}).`,
            timestamp: mission.updated_at || mission.created_at,
            read: readIds.has(`mission_assigned_${mission.id}`),
            link: ROUTES.mission(mission.id),
          });
        }
      }
    }

    // 5. Étalonnages et contrôles du matériel à moins de 30 jours
    if (preferences.notify_maintenance_due) {
      for (const equipment of equipmentQuery.data ?? []) {
        const state = calibrationState(equipment.next_calibration);
        if (state !== 'due_soon' && state !== 'expired') continue;

        const id = `equipment_calibration_${equipment.id}_${equipment.next_calibration ?? 'unknown'}`;
        list.push({
          id,
          type: 'equipment_alert',
          category: 'equipment',
          severity: state === 'expired' ? 'urgent' : 'warning',
          title: state === 'expired' ? 'Étalonnage expiré' : 'Étalonnage à prévoir',
          description:
            state === 'expired'
              ? `Le contrôle de « ${equipment.name} » est arrivé à échéance.`
              : `Le contrôle de « ${equipment.name} » est prévu le ${equipment.next_calibration}.`,
          timestamp: equipment.updated_at,
          read: readIds.has(id),
          link: ROUTES.equipment,
        });
      }
    }

    // 6. Réponses de clients non lues (portail client)
    for (const conversation of conversationsQuery.data ?? []) {
      if (conversation.unread_count === 0) continue;
      const id = `client_message_${conversation.id}_${conversation.last_message_at ?? ''}`;
      const contact = conversation.contact;
      const contactName =
        contact === null
          ? 'Un client'
          : [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
            contact.email ||
            'Un client';
      list.push({
        id,
        type: 'client_message',
        category: 'client',
        severity: 'info',
        title:
          conversation.unread_count === 1
            ? 'Nouveau message client'
            : `${conversation.unread_count} nouveaux messages client`,
        description: `${contactName}${conversation.customer ? ` (${conversation.customer.name})` : ''} a répondu dans « ${conversation.subject} ».`,
        timestamp: conversation.last_message_at ?? conversation.created_at,
        read: readIds.has(id),
        link: ROUTES.customer(conversation.customer_id),
      });
    }

    // 7. Devis acceptés ou refusés par le client depuis le portail. Pas de
    // fenêtre temporelle : une réponse se lit puis s'écarte, comme les autres.
    for (const quote of quotesQuery.data ?? []) {
      if (quote.client_responded_at === null) continue;
      if (quote.status !== 'accepted' && quote.status !== 'refused') continue;
      const id = `quote_response_${quote.id}_${quote.client_responded_at}`;
      const accepte = quote.status === 'accepted';
      list.push({
        id,
        type: 'client_message',
        category: 'client',
        severity: accepte ? 'success' : 'warning',
        title: accepte ? 'Devis accepté par le client' : 'Devis refusé par le client',
        description: `${quote.customer_name ?? 'Le client'} a ${accepte ? 'accepté' : 'refusé'} le devis ${quote.reference} depuis son espace client.`,
        timestamp: quote.client_responded_at,
        read: readIds.has(id),
        link: ROUTES.quoteDetail(quote.id),
      });
    }

    // Filtrer les notifications supprimées / masquées
    const filtered = list.filter((n) => !dismissedIds.has(n.id));

    // Trier par date décroissante
    return filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [
    leavesQuery.data,
    pendingReportsQuery.data,
    lowStockArticles,
    missionsQuery.data,
    equipmentQuery.data,
    conversationsQuery.data,
    quotesQuery.data,
    userId,
    currentMember,
    isManagerOrOwner,
    role,
    readIds,
    dismissedIds,
    preferences.notify_leave_requests,
    preferences.notify_stock_low,
    preferences.notify_new_mission,
    preferences.notify_maintenance_due,
  ]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = useCallback(
    (id: string) => {
      etats.marquerLues([id]);
    },
    [etats],
  );

  const markAllAsRead = useCallback(() => {
    etats.marquerLues(notifications.filter((n) => !n.read).map((n) => n.id));
  }, [etats, notifications]);

  const dismissNotification = useCallback(
    (id: string) => {
      etats.ecarter(id);
    },
    [etats],
  );

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  };
}
