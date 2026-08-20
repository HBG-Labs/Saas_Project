import {
  BatteryCharging,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeEnergyConsumption,
  computePowerConversions,
  POWER_UNITS,
  type PowerUnit,
} from './compute';

export default function PowerCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [mode, setMode] = useState<'conversion' | 'energy'>('conversion');

  // Conversion
  const [powerStr, setPowerStr] = useState<string>('5');
  const [unit, setUnit] = useState<PowerUnit>('kw');

  // Énergie
  const [durationStr, setDurationStr] = useState<string>('3.5');

  const numPower = parseFloat(powerStr.replace(',', '.')) || 0;
  const numDuration = parseFloat(durationStr.replace(',', '.')) || 0;

  const convResult = useMemo(() => {
    return computePowerConversions(numPower, unit);
  }, [numPower, unit]);

  const energyResult = useMemo(() => {
    return computeEnergyConsumption(numPower, unit, numDuration);
  }, [numPower, unit, numDuration]);

  const handleCalculate = () => {
    if (mode === 'conversion') {
      addHistoryEntry({
        toolSlug: 'power-calculator',
        toolName: 'Calculateur de Puissance',
        summary: `Puissance : ${powerStr} ${POWER_UNITS[unit].symbol}`,
        inputs: { puissance: numPower, unite: unit },
        result: `${powerStr} ${POWER_UNITS[unit].symbol}`,
      });
    } else {
      addHistoryEntry({
        toolSlug: 'power-calculator',
        toolName: 'Calculateur de Puissance & Énergie',
        summary: `Énergie consommée : ${powerStr} ${POWER_UNITS[unit].symbol} pendant ${durationStr}h = ${energyResult.formattedKwh}`,
        inputs: { puissance: numPower, unite: unit, dureeHeures: numDuration },
        result: energyResult.formattedKwh,
      });
    }
  };

  const handleReset = () => {
    setPowerStr('0');
    setDurationStr('1');
  };

  return (
    <ToolLayout
      toolSlug="power-calculator"
      title="Calculateur de Puissance &amp; Énergie"
      description="Conversions de puissance universelle (W, kW, MW, VA, kVA, chevaux) et calcul d'énergie consommée en kWh."
      icon={Zap}
      onReset={handleReset}
    >
      {/* 1. Sélecteur de mode */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('conversion')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mode === 'conversion'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className="size-4" />
          <span>Conversion de Puissance</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('energy')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mode === 'energy'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <BatteryCharging className="size-4" />
          <span>Énergie Consommée (kWh)</span>
        </button>
      </div>

      {/* 2. Formulaire */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Puissance */}
          <div className="space-y-1.5">
            <label htmlFor="powercalculatortool-puissance-de-l-equipement" className="text-xs font-bold text-foreground">Puissance de l'équipement :</label>
            <div className="flex gap-2">
              <input id="powercalculatortool-puissance-de-l-equipement"
                type="number"
                inputMode="decimal"
                value={powerStr}
                onChange={(e) => setPowerStr(e.target.value)}
                placeholder="Ex: 5"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as PowerUnit)}
                className="h-11 min-w-28 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(POWER_UNITS).map(([k, u]) => (
                  <option key={k} value={k}>
                    {u.symbol} ({u.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Durée (si mode énergie) */}
          {mode === 'energy' && (
            <div className="space-y-1.5">
              <label htmlFor="powercalculatortool-duree-de-fonctionnement" className="text-xs font-bold text-foreground">Durée de fonctionnement :</label>
              <div className="relative">
                <input id="powercalculatortool-duree-de-fonctionnement"
                  type="number"
                  inputMode="decimal"
                  value={durationStr}
                  onChange={(e) => setDurationStr(e.target.value)}
                  placeholder="Ex: 3.5"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-12 text-base font-bold text-foreground font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  heures
                </span>
              </div>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleCalculate}
          className="w-full h-11 text-sm font-bold shadow-xs cursor-pointer gap-2"
        >
          <Sparkles className="size-4" />
          <span>Calculer</span>
        </Button>
      </Card>

      {/* 3. Résultat */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        {mode === 'conversion' ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  Puissance équivalente
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                    {powerStr}
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-primary">
                    {POWER_UNITS[unit].symbol}
                  </span>
                </div>
              </div>

              <CopyResultButton
                textToCopy={`${powerStr} ${POWER_UNITS[unit].symbol}`}
                label="Copier"
              />
            </div>

            <div className="pt-3 border-t border-border/60">
              <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Équivalences dans toutes les unités :
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {convResult.conversions.map((c) => (
                  <div
                    key={c.unit}
                    className={`p-2 rounded-lg border text-xs ${
                      c.unit === unit
                        ? 'border-primary bg-primary/15 font-bold text-primary'
                        : 'border-border bg-surface-raised text-foreground'
                    }`}
                  >
                    <p className="text-3xs text-muted-foreground truncate">{c.name}</p>
                    <p className="font-mono font-bold mt-0.5 truncate">
                      {c.formatted} <span className="text-3xs font-normal opacity-80">{c.symbol}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  Énergie totale consommée
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                    {energyResult.formattedKwh}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pour {powerStr} {POWER_UNITS[unit].symbol} pendant {durationStr} h de fonctionnement
                </p>
              </div>

              <CopyResultButton
                textToCopy={energyResult.formattedKwh}
                label="Copier"
              />
            </div>

            <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-raised border border-border">
                <p className="text-3xs text-muted-foreground">Watt-heures (Wh)</p>
                <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                  {energyResult.formattedWh}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-raised border border-border">
                <p className="text-3xs text-muted-foreground">Joules (J)</p>
                <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                  {energyResult.formattedJoules}
                </p>
              </div>
            </div>
          </>
        )}
      </Card>
    </ToolLayout>
  );
}
