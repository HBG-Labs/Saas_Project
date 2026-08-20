export type NotificationType =
  | 'leave_request'
  | 'leave_status'
  | 'mission_assigned'
  | 'report_review'
  | 'stock_alert'
  | 'vehicle_alert';

export type NotificationCategory = 'hr' | 'mission' | 'stock' | 'equipment';

export type NotificationSeverity = 'info' | 'warning' | 'success' | 'urgent';

export interface AppNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  description: string;
  timestamp: string; // ISO string or human readable
  read: boolean;
  link: string;
  metadata?: Record<string, unknown>;
}
