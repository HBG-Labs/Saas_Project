import { SelectField } from '@/components/ui/SelectField';
import { Calendar, Globe } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { TERRITORIES, useDefaultTerritory } from '@/config/territories';
import { cn } from '@/lib/cn';
import { useUserPreferences } from '../hooks/useUserPreferences';

export function PlanningMapSettingsTab({ onSaved }: { onSaved?: () => void }) {
  const { territoryCode: defaultTerritory, setTerritoryCode: setDefaultTerritory } =
    useDefaultTerritory();
  const { preferences, updatePreference } = useUserPreferences();

  return (
    <div className="animate-in fade-in space-y-4">
      {/* Territoire de référence */}
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Globe className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Territoire & fuseau d'intervention</CardTitle>
              <CardDescription>
                Adaptez les jours fériés, le calcul des congés et le cadrage GPS.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TERRITORIES.map((t) => {
              const isSelected = defaultTerritory === t.code;

              return (
                <button
                  key={t.code}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setDefaultTerritory(t.code);
                    onSaved?.();
                  }}
                  className={cn(
                    'flex min-h-16 cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow]',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-border bg-surface hover:bg-surface-hover text-muted-foreground',
                  )}
                >
                  <span className="text-xs">
                    {t.flag} {t.label}
                  </span>
                  <span className="text-3xs text-muted-foreground font-normal">{t.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Options Cartographiques & Guidage GPS */}
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Calendar className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Cartographie & planning</CardTitle>
              <CardDescription>
                Paramètres du cockpit cartographique et du calcul des temps de trajet.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 sm:pt-5">
          <Switch
            className="border-border bg-surface-raised flex-row-reverse items-center justify-between rounded-xl border p-3"
            label="Couche trafic en temps réel"
            description="Affiche bouchons, ralentissements et travaux pour anticiper les retards."
            checked={preferences.traffic_layer}
            onCheckedChange={(val) => {
              updatePreference('traffic_layer', val);
              onSaved?.();
            }}
          />

          <div className="border-border bg-surface-raised rounded-xl border p-3">
            <SelectField
              label="Gabarit du véhicule de tournée"
              hint="Optimise les itinéraires selon le véhicule pour éviter les voies restreintes."
              value={preferences.vehicle_type}
              onChange={(e) => {
                updatePreference('vehicle_type', e.target.value);
                onSaved?.();
              }}
            >
              <option value="car">Voiture / Commercial</option>
              <option value="van">Fourgonnette / Utilitaire (L1H1/L2H2)</option>
              <option value="truck">Camion Nacelle / Poids Lourd</option>
            </SelectField>
          </div>

          <div className="border-border bg-surface-raised rounded-xl border p-3">
            <SelectField
              label="Fréquence de rafraîchissement GPS"
              hint="Cadence d'actualisation de la géolocalisation en intervention."
              value={String(preferences.gps_refresh_rate)}
              onChange={(e) => {
                updatePreference('gps_refresh_rate', Number(e.target.value));
                onSaved?.();
              }}
            >
              <option value="10">Haute précision (10 secondes)</option>
              <option value="30">Standard équilibré (30 secondes)</option>
              <option value="60">Économie batterie (1 minute)</option>
              <option value="120">Faible consommation (2 minutes)</option>
            </SelectField>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
