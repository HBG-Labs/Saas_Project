import { Bell } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { useUserPreferences } from '../hooks/useUserPreferences';

export function NotificationsSettingsTab({ onSaved }: { onSaved?: () => void }) {
  const { preferences, updatePreference } = useUserPreferences();

  return (
    <div className="animate-in fade-in space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Bell className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Alertes & notifications terrain</CardTitle>
              <CardDescription>
                Choisissez les alertes affichées dans votre centre de notifications.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 sm:pt-5">
          <Switch
            className="border-border bg-surface-raised flex-row-reverse items-center justify-between rounded-xl border p-3"
            label="Nouvelles missions & affectations"
            description="Recevez une notification lorsqu'une intervention vous est assignée ou modifiée."
            checked={preferences.notify_new_mission}
            onCheckedChange={(val) => {
              updatePreference('notify_new_mission', val);
              onSaved?.();
            }}
          />

          <Switch
            className="border-border bg-surface-raised flex-row-reverse items-center justify-between rounded-xl border p-3"
            label="Échéances de contrôle matériel & étalonnage"
            description="Alerte préventive 30 jours avant l'expiration d'un contrôle matériel."
            checked={preferences.notify_maintenance_due}
            onCheckedChange={(val) => {
              updatePreference('notify_maintenance_due', val);
              onSaved?.();
            }}
          />

          <Switch
            className="border-border bg-surface-raised flex-row-reverse items-center justify-between rounded-xl border p-3"
            label="Seuil minimal de stock"
            description="Notification dès qu'une référence passe sous son stock d'alerte."
            checked={preferences.notify_stock_low}
            onCheckedChange={(val) => {
              updatePreference('notify_stock_low', val);
              onSaved?.();
            }}
          />

          <Switch
            className="border-border bg-surface-raised flex-row-reverse items-center justify-between rounded-xl border p-3"
            label="Demandes de congés & absences"
            description="Notification lors du dépôt ou de la validation d'une demande d'équipe."
            checked={preferences.notify_leave_requests}
            onCheckedChange={(val) => {
              updatePreference('notify_leave_requests', val);
              onSaved?.();
            }}
          />

          <Switch
            className="border-border bg-surface-raised flex-row-reverse items-center justify-between rounded-xl border p-3"
            label="Comptes rendus d'intervention"
            description="E-mail quand un compte rendu est à contrôler, ou vous est renvoyé pour correction."
            checked={preferences.notify_report_review}
            onCheckedChange={(val) => {
              updatePreference('notify_report_review', val);
              onSaved?.();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
