import { useCallback, useEffect, useMemo, useState } from 'react';

import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
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
import { useStock } from '@/features/stock';

import type { AppNotification } from '../types/notifications.types';

function getReadStorageKey(userId: string | null | undefined): string {
  if (!userId) return 'rezo360_read_notifications_anonymous';
  return `rezo360_read_notifications_${userId}`;
}

function getDismissedStorageKey(userId: string | null | undefined): string {
  if (!userId) return 'rezo360_dismissed_notifications_anonymous';
  return `rezo360_dismissed_notifications_${userId}`;
}

function readStoredSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistSet(key: string, set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore localStorage errors
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { can, role } = usePermission();

  const isManagerOrOwner =
    can(PERMISSIONS.leaveApprove) || role === 'owner' || role === 'admin' || role === 'manager';

  const readKey = getReadStorageKey(userId);
  const dismissedKey = getDismissedStorageKey(userId);

  const [readIds, setReadIds] = useState<Set<string>>(() => readStoredSet(readKey));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readStoredSet(dismissedKey));

  useEffect(() => {
    setReadIds(readStoredSet(readKey));
    setDismissedIds(readStoredSet(dismissedKey));
  }, [readKey, dismissedKey]);

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

  // Génération des notifications d'activité
  const notifications = useMemo(() => {
    const list: AppNotification[] = [];

    // 1. Demandes de congés
    const leaves = leavesQuery.data ?? [];
    for (const leave of leaves) {
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
      for (const item of lowStockArticles) {
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
    if (role === 'technician' && currentMember) {
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
    userId,
    currentMember,
    isManagerOrOwner,
    role,
    readIds,
    dismissedIds,
  ]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        persistSet(readKey, next);
        return next;
      });
    },
    [readKey],
  );

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) {
        next.add(n.id);
      }
      persistSet(readKey, next);
      return next;
    });
  }, [notifications, readKey]);

  const dismissNotification = useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        persistSet(dismissedKey, next);
        return next;
      });
    },
    [dismissedKey],
  );

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  };
}
