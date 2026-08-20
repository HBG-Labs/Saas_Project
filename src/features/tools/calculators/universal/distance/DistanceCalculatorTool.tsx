import {
  Compass,
  Ruler,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  compute2DDistance,
  computeDistanceConversions,
  DISTANCE_UNITS,
  type DistanceUnit,
} from './compute';

export default function DistanceCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [mode, setMode] = useState<'simple' | 'points'>('simple');
  const [distanceStr, setDistanceStr] = useState<string>('1250');
  const [unit, setUnit] = useState<DistanceUnit>('m');

  // Coordonnées 2D
  const [x1, setX1] = useState<string>('0');
  const [y1, setY1] = useState<string>('0');
  const [x2, setX2] = useState<string>('30');
  const [y2, setY2] = useState<string>('40');

  const numDist = parseFloat(distanceStr.replace(',', '.')) || 0;
  const numX1 = parseFloat(x1.replace(',', '.')) || 0;
  const numY1 = parseFloat(y1.replace(',', '.')) || 0;
  const numX2 = parseFloat(x2.replace(',', '.')) || 0;
  const numY2 = parseFloat(y2.replace(',', '.')) || 0;

  const simpleResult = useMemo(() => {
    return computeDistanceConversions(numDist, unit);
  }, [numDist, unit]);

  const pointsResult = useMemo(() => {
    return compute2DDistance(numX1, numY1, numX2, numY2, unit);
  }, [numX1, numY1, numX2, numY2, unit]);

  const handleCalculate = () => {
    if (mode === 'simple') {
      const targetKm = simpleResult.conversions.find((c) => c.unit === 'km')?.formatted ?? '';
      addHistoryEntry({
        toolSlug: 'distance-calculator',
        toolName: 'Calculateur de Distance',
        summary: `Distance : ${distanceStr} ${unit} (${targetKm} km)`,
        inputs: { distance: numDist, unite: unit },
        result: `${distanceStr} ${unit}`,
      });
    } else {
      addHistoryEntry({
        toolSlug: 'distance-calculator',
        toolName: 'Calculateur de Distance',
        summary: `Distance entre (${x1}, ${y1}) et (${x2}, ${y2}) = ${pointsResult.formattedDistance} ${unit}`,
        inputs: { x1: numX1, y1: numY1, x2: numX2, y2: numY2, unite: unit },
        result: `${pointsResult.formattedDistance} ${unit}`,
      });
    }
  };

  const handleReset = () => {
    setDistanceStr('0');
    setX1('0');
    setY1('0');
    setX2('0');
    setY2('0');
  };

  return (
    <ToolLayout
      toolSlug="distance-calculator"
      title="Calculateur de Distance"
      description="Conversion immédiate de distances et calcul géométrique entre deux coordonnées."
      icon={Ruler}
      onReset={handleReset}
    >
      {/* Sélecteur de mode */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('simple')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mode === 'simple'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Ruler className="size-4" />
          <span>Distance Simple</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('points')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mode === 'points'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Compass className="size-4" />
          <span>Entre 2 Points (2D)</span>
        </button>
      </div>

      {mode === 'simple' ? (
        /* Formulaire Distance Simple */
        <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Distance à convertir :
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={distanceStr}
                onChange={(e) => setDistanceStr(e.target.value)}
                placeholder="Ex: 1250"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as DistanceUnit)}
                className="h-11 min-w-32 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(DISTANCE_UNITS).map(([k, u]) => (
                  <option key={k} value={k}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleCalculate}
            className="w-full h-11 text-sm font-bold shadow-xs cursor-pointer gap-2"
          >
            <Sparkles className="size-4" />
            <span>Calculer &amp; Enregistrer</span>
          </Button>
        </Card>
      ) : (
        /* Formulaire Distance 2D */
        <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Point A */}
            <div className="space-y-2 p-3 rounded-xl bg-surface-raised border border-border">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                Point A (Départ)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-3xs text-muted-foreground">X1 :</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={x1}
                    onChange={(e) => setX1(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-xs font-mono font-bold text-foreground"
                  />
                </div>
                <div>
                  <label className="text-3xs text-muted-foreground">Y1 :</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={y1}
                    onChange={(e) => setY1(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-xs font-mono font-bold text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Point B */}
            <div className="space-y-2 p-3 rounded-xl bg-surface-raised border border-border">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                Point B (Arrivée)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-3xs text-muted-foreground">X2 :</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={x2}
                    onChange={(e) => setX2(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-xs font-mono font-bold text-foreground"
                  />
                </div>
                <div>
                  <label className="text-3xs text-muted-foreground">Y2 :</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={y2}
                    onChange={(e) => setY2(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-xs font-mono font-bold text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-foreground">Unité des coordonnées :</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as DistanceUnit)}
              className="h-9 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground"
            >
              {Object.entries(DISTANCE_UNITS).map(([k, u]) => (
                <option key={k} value={k}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleCalculate}
            className="w-full h-11 text-sm font-bold shadow-xs cursor-pointer gap-2"
          >
            <Sparkles className="size-4" />
            <span>Calculer la distance</span>
          </Button>
        </Card>
      )}

      {/* Résultat et Équivalences */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-primary">
              {mode === 'simple' ? 'Tableau des équivalences' : 'Distance calculée'}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                {mode === 'simple' ? distanceStr : pointsResult.formattedDistance}
              </span>
              <span className="text-base sm:text-lg font-bold text-primary">
                {DISTANCE_UNITS[unit].symbol}
              </span>
            </div>
          </div>

          <CopyResultButton
            textToCopy={
              mode === 'simple'
                ? `${distanceStr} ${DISTANCE_UNITS[unit].symbol}`
                : `${pointsResult.formattedDistance} ${DISTANCE_UNITS[unit].symbol}`
            }
            label="Copier"
          />
        </div>

        {/* Grille des conversions */}
        <div className="pt-3 border-t border-border/60">
          <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Équivalences dans toutes les unités :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(mode === 'simple' ? simpleResult.conversions : pointsResult.conversions).map((c) => (
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
      </Card>
    </ToolLayout>
  );
}
