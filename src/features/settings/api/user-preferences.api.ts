import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';

export interface UserPreferences {
  user_id: string;
  notify_new_mission: boolean;
  notify_maintenance_due: boolean;
  notify_stock_low: boolean;
  notify_leave_requests: boolean;
  sms_urgent_alerts: boolean;
  traffic_layer: boolean;
  vehicle_type: string;
  gps_refresh_rate: number;
}

export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'user_id'> = {
  notify_new_mission: true,
  notify_maintenance_due: true,
  notify_stock_low: true,
  notify_leave_requests: true,
  sms_urgent_alerts: false,
  traffic_layer: true,
  vehicle_type: 'van',
  gps_refresh_rate: 30,
};

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const row = await unwrapMaybe(
    supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
  );

  if (row === null) {
    return {
      user_id: userId,
      ...DEFAULT_USER_PREFERENCES,
    };
  }

  return {
    user_id: row.user_id,
    notify_new_mission: row.notify_new_mission,
    notify_maintenance_due: row.notify_maintenance_due,
    notify_stock_low: row.notify_stock_low,
    notify_leave_requests: row.notify_leave_requests,
    sms_urgent_alerts: row.sms_urgent_alerts,
    traffic_layer: row.traffic_layer,
    vehicle_type: row.vehicle_type,
    gps_refresh_rate: row.gps_refresh_rate,
  };
}

export async function upsertUserPreferences(
  userId: string,
  patch: Partial<Omit<UserPreferences, 'user_id'>>,
): Promise<UserPreferences> {
  const payload = {
    user_id: userId,
    ...patch,
  };

  const updated = await unwrap(
    supabase.from('user_preferences').upsert(payload, { onConflict: 'user_id' }).select('*').single(),
  );

  return {
    user_id: updated.user_id,
    notify_new_mission: updated.notify_new_mission,
    notify_maintenance_due: updated.notify_maintenance_due,
    notify_stock_low: updated.notify_stock_low,
    notify_leave_requests: updated.notify_leave_requests,
    sms_urgent_alerts: updated.sms_urgent_alerts,
    traffic_layer: updated.traffic_layer,
    vehicle_type: updated.vehicle_type,
    gps_refresh_rate: updated.gps_refresh_rate,
  };
}
