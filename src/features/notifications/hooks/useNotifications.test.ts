import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotifications } from './useNotifications';

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 'user_123', email: 'test@example.com' },
  }),
}));

vi.mock('@/features/organizations', () => ({
  useCurrentOrganization: () => ({
    organization: { id: 'org_123', name: 'Test Org' },
  }),
  usePermission: () => ({
    can: () => true,
    role: 'owner',
  }),
  useMembers: () => ({
    data: [{ id: 'member_123', user_id: 'user_123', full_name: 'Test Owner' }],
  }),
  memberDisplayName: (m: { full_name?: string; email?: string } | null | undefined) =>
    m?.full_name || m?.email || 'Membre',
  PERMISSIONS: {
    leaveApprove: 'leave.approve',
    equipmentView: 'equipment.view',
  },
}));

vi.mock('@/features/planning', () => ({
  useLeaveRequests: () => ({
    data: [
      {
        id: 'leave_1',
        member_id: 'member_456',
        member: { id: 'member_456', user_id: 'user_456', full_name: 'Alexandre Tech' },
        status: 'pending',
        start_date: '2026-08-25',
        end_date: '2026-08-30',
        requested_at: '2026-08-20T10:00:00Z',
      },
    ],
  }),
}));

vi.mock('@/features/interventions', () => ({
  useReportsPendingReview: () => ({
    data: [
      {
        id: 'report_1',
        intervention: {
          id: 'int_1',
          mission: { id: 'm_1', reference: 'M-001', title: 'Raccordement Immeuble A' },
          technician: null,
        },
        submitted_at: '2026-08-20T11:00:00Z',
      },
    ],
  }),
}));

vi.mock('@/features/settings', () => ({
  useUserPreferences: () => ({
    preferences: {
      notify_new_mission: true,
      notify_maintenance_due: true,
      notify_stock_low: true,
      notify_leave_requests: true,
      sms_urgent_alerts: false,
      traffic_layer: true,
      vehicle_type: 'van',
      gps_refresh_rate: 30,
    },
  }),
}));

vi.mock('@/features/equipment', () => ({
  calibrationState: () => 'due_soon',
  useEquipmentList: () => ({
    data: [
      {
        id: 'equipment_1',
        name: 'Réflectomètre OTDR',
        next_calibration: '2026-09-15',
        updated_at: '2026-08-20T13:00:00Z',
      },
    ],
  }),
}));

vi.mock('@/features/stock', () => ({
  useStock: () => ({
    lowStockArticles: [
      {
        id: 'stock_1',
        name: 'Connecteurs SC/APC',
        quantityInStock: 3,
        minThreshold: 10,
        unit: 'pièces',
        updatedAt: '2026-08-20T12:00:00Z',
      },
    ],
  }),
}));

vi.mock('@/features/missions', () => ({
  useMissions: () => ({
    data: [],
  }),
}));

describe('useNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('agrège correctement les notifications pour un Dirigeant/Manager', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications.length).toBe(4);
    expect(result.current.unreadCount).toBe(4);

    // Vérifie la présence de la demande de congé
    const leaveNotif = result.current.notifications.find((n) => n.type === 'leave_request');
    expect(leaveNotif).toBeDefined();
    expect(leaveNotif?.description).toContain('Alexandre Tech');

    // Vérifie la présence du rapport à valider
    const reportNotif = result.current.notifications.find((n) => n.type === 'report_review');
    expect(reportNotif).toBeDefined();

    // Vérifie la présence du stock bas
    const stockNotif = result.current.notifications.find((n) => n.type === 'stock_alert');
    expect(stockNotif).toBeDefined();

    const equipmentNotif = result.current.notifications.find((n) => n.type === 'equipment_alert');
    expect(equipmentNotif?.description).toContain('Réflectomètre OTDR');
  });

  it('permet de marquer une notification comme lue et de tout marquer comme lu', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.unreadCount).toBe(4);

    const firstId = result.current.notifications[0]!.id;

    act(() => {
      result.current.markAsRead(firstId);
    });

    expect(result.current.unreadCount).toBe(3);

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('permet de supprimer une notification', () => {
    const { result } = renderHook(() => useNotifications());

    const initialLength = result.current.notifications.length;
    const firstId = result.current.notifications[0]!.id;

    act(() => {
      result.current.dismissNotification(firstId);
    });

    expect(result.current.notifications.length).toBe(initialLength - 1);
  });
});
