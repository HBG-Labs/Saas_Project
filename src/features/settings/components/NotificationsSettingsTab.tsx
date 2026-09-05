import { Bell } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { useUserPreferences } from '../hooks/useUserPreferences';

export function NotificationsSettingsTab({ onSaved }: { onSaved?: () => void }) {
  const { preferences, updatePreference } = useUserPreferences();

  return (
    <div className="space-y-4 animate-in fade-in">
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Bell className="size-3.5 text-primary" />
            <span>Alertes & Notifications Terrain</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Choisissez les alertes affichées dans votre centre de notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Nouvelles Missions & Affectations</h4>
              <p className="text-3xs text-muted-foreground">
                Recevez une notification instantanée lorsqu'une intervention vous est assignée ou modifiée.
              </p>
            </div>
            <Switch
              label="Nouvelles Missions & Affectations"
              checked={preferences.notify_new_mission}
              onCheckedChange={(val) => {
                updatePreference('notify_new_mission', val);
                onSaved?.();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Échéances de Contrôle Matériel & Étalonnage</h4>
              <p className="text-3xs text-muted-foreground">
                Alerte préventive 30 jours avant l'expiration du contrôle d'une soudeuse ou d'un réflectomètre.
              </p>
            </div>
            <Switch
              label="Échéances de Contrôle Matériel & Étalonnage"
              checked={preferences.notify_maintenance_due}
              onCheckedChange={(val) => {
                updatePreference('notify_maintenance_due', val);
                onSaved?.();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Alertes Seuil Minimal de Stock</h4>
              <p className="text-3xs text-muted-foreground">
                Notification automatique dès qu'une référence de consommable passe sous son stock d'alerte.
              </p>
            </div>
            <Switch
              label="Alertes Seuil Minimal de Stock"
              checked={preferences.notify_stock_low}
              onCheckedChange={(val) => {
                updatePreference('notify_stock_low', val);
                onSaved?.();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Demandes de Congés & Absences</h4>
              <p className="text-3xs text-muted-foreground">
                Notification lors du dépôt ou de la validation d'une demande de congé d'équipe.
              </p>
            </div>
            <Switch
              label="Demandes de Congés & Absences"
              checked={preferences.notify_leave_requests}
              onCheckedChange={(val) => {
                updatePreference('notify_leave_requests', val);
                onSaved?.();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-semibold text-foreground">Alertes SMS d'Urgence</h4>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Bientôt disponible
                </span>
              </div>
              <p className="text-3xs text-muted-foreground">
                Le canal SMS sera activé lorsqu'un fournisseur d'envoi aura été configuré.
              </p>
            </div>
            <Switch
              label="Alertes SMS d'Urgence"
              checked={false}
              disabled
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
