import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserPreferences } from './useUserPreferences';
import * as api from '../api/user-preferences.api';

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123', email: 'test@rezo360.com' },
  }),
}));

vi.mock('../api/user-preferences.api', () => ({
  DEFAULT_USER_PREFERENCES: {
    notify_new_mission: true,
    notify_maintenance_due: true,
    notify_stock_low: true,
    notify_leave_requests: true,
    sms_urgent_alerts: false,
    traffic_layer: true,
    vehicle_type: 'van',
    gps_refresh_rate: 30,
  },
  getUserPreferences: vi.fn(),
  upsertUserPreferences: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useUserPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les préférences de l’utilisateur depuis l’API', async () => {
    vi.mocked(api.getUserPreferences).mockResolvedValue({
      user_id: 'test-user-123',
      notify_new_mission: false,
      notify_maintenance_due: true,
      notify_stock_low: true,
      notify_leave_requests: true,
      sms_urgent_alerts: true,
      traffic_layer: false,
      vehicle_type: 'truck',
      gps_refresh_rate: 60,
    });

    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.preferences.vehicle_type).toBe('truck');
    });

    expect(result.current.preferences.notify_new_mission).toBe(false);
    expect(result.current.preferences.sms_urgent_alerts).toBe(true);
    expect(result.current.preferences.gps_refresh_rate).toBe(60);
  });

  it('permet de mettre à jour une préférence avec mutation optimiste', async () => {
    vi.mocked(api.getUserPreferences).mockResolvedValue({
      user_id: 'test-user-123',
      ...api.DEFAULT_USER_PREFERENCES,
    });

    vi.mocked(api.upsertUserPreferences).mockResolvedValue({
      user_id: 'test-user-123',
      ...api.DEFAULT_USER_PREFERENCES,
      vehicle_type: 'car',
    });

    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updatePreference('vehicle_type', 'car');
    });

    await waitFor(() => {
      expect(api.upsertUserPreferences).toHaveBeenCalledWith('test-user-123', {
        vehicle_type: 'car',
      });
    });
  });
});
