import { SelectField } from '@/components/ui/SelectField';
import { Calendar, Globe } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { TERRITORIES, useDefaultTerritory } from '@/config/territories';
import { cn } from '@/lib/cn';
import { useUserPreferences } from '../hooks/useUserPreferences';

export function PlanningMapSettingsTab({ onSaved }: { onSaved?: () => void }) {
  const { territoryCode: defaultTerritory, setTerritoryCode: setDefaultTerritory } = useDefaultTerritory();
  const { preferences, updatePreference } = useUserPreferences();

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Territoire de référence */}
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Globe className="size-3.5 text-primary" />
            <span>Territoire & Fuseau d'intervention</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Sélectionnez la zone géographique pour adapter les jours fériés, le calcul des congés et le cadrage GPS.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TERRITORIES.map((t) => {
              const isSelected = defaultTerritory === t.code;

              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => {
                    setDefaultTerritory(t.code);
                    onSaved?.();
                  }}
                  className={cn(
                    'flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left cursor-pointer transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-border bg-surface hover:bg-surface-hover text-muted-foreground',
                  )}
                >
                  <span className="text-xs">{t.flag} {t.label}</span>
                  <span className="text-3xs text-muted-foreground font-normal">{t.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Options Cartographiques & Guidage GPS */}
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Calendar className="size-3.5 text-primary" />
            <span>Options Cartographiques & Planning</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Paramètres du cockpit cartographique et du calcul des temps de trajet.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Couche Trafic en Temps Réel</h4>
              <p className="text-3xs text-muted-foreground">
                Affiche les bouchons, ralentissements et travaux sur la carte pour anticiper les retards de tournée.
              </p>
            </div>
            <Switch
              label="Couche Trafic en Temps Réel"
              checked={preferences.traffic_layer}
              onCheckedChange={(val) => {
                updatePreference('traffic_layer', val);
                onSaved?.();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Gabarit Véhicule de Tournée</h4>
              <p className="text-3xs text-muted-foreground">
                Optimise les itinéraires selon le type de véhicule pour éviter les voies restreintes.
              </p>
            </div>
            <SelectField
              value={preferences.vehicle_type}
              onChange={(e) => {
                updatePreference('vehicle_type', e.target.value);
                onSaved?.();
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="car">Voiture / Commercial</option>
              <option value="van">Fourgonnette / Utilitaire (L1H1/L2H2)</option>
              <option value="truck">Camion Nacelle / Poids Lourd</option>
            </SelectField>
          </div>

          <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Fréquence de Rafraîchissement GPS</h4>
              <p className="text-3xs text-muted-foreground">
                Cadence d'actualisation de la géolocalisation des techniciens en intervention.
              </p>
            </div>
            <SelectField
              value={String(preferences.gps_refresh_rate)}
              onChange={(e) => {
                updatePreference('gps_refresh_rate', Number(e.target.value));
                onSaved?.();
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
