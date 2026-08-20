import {
  Calculator,
  Clock,
  Hourglass,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeAddSubtractDuration,
  computeBetweenTimes,
  convertDecimalHours,
  type TimeMode,
} from './compute';

export default function TimeCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [mode, setMode] = useState<TimeMode>('between_times');

  // Mode 1: Entre deux heures
  const [startTime, setStartTime] = useState<string>('07:30');
  const [endTime, setEndTime] = useState<string>('15:45');
  const [breakMin, setBreakMin] = useState<string>('0');

  // Mode 2: Addition / Soustraction
  const [h1, setH1] = useState<string>('3');
  const [m1, setM1] = useState<string>('45');
  const [h2, setH2] = useState<string>('2');
  const [m2, setM2] = useState<string>('30');
  const [operation, setOperation] = useState<'add' | 'subtract'>('add');

  // Mode 3: Décimales
  const [decimalHours, setDecimalHours] = useState<string>('8.25');

  const numBreak = parseInt(breakMin, 10) || 0;
  const numH1 = parseInt(h1, 10) || 0;
  const numM1 = parseInt(m1, 10) || 0;
  const numH2 = parseInt(h2, 10) || 0;
  const numM2 = parseInt(m2, 10) || 0;
  const numDecimal = parseFloat(decimalHours.replace(',', '.')) || 0;

  const betweenResult = useMemo(() => {
    return computeBetweenTimes(startTime, endTime, numBreak);
  }, [startTime, endTime, numBreak]);

  const addSubResult = useMemo(() => {
    return computeAddSubtractDuration(numH1, numM1, 0, numH2, numM2, 0, operation);
  }, [numH1, numM1, numH2, numM2, operation]);

  const decimalResult = useMemo(() => {
    return convertDecimalHours(numDecimal, 'decimal_to_hms');
  }, [numDecimal]);

  const handleCalculate = () => {
    if (mode === 'between_times') {
      addHistoryEntry({
        toolSlug: 'time-calculator',
        toolName: 'Calculateur de Temps',
        summary: `${startTime} → ${endTime} = ${betweenResult.formattedDuration} (${betweenResult.formattedDecimal})`,
        inputs: { debut: startTime, fin: endTime, pauseMin: numBreak },
        result: `${betweenResult.formattedDuration} (${betweenResult.formattedDecimal})`,
      });
    } else if (mode === 'add_subtract') {
      addHistoryEntry({
        toolSlug: 'time-calculator',
        toolName: 'Calculateur de Temps',
        summary: `${h1}h${m1} ${operation === 'add' ? '+' : '-'} ${h2}h${m2} = ${addSubResult.formatted}`,
        inputs: { h1: numH1, m1: numM1, h2: numH2, m2: numM2, operation },
        result: addSubResult.formatted,
      });
    } else {
      addHistoryEntry({
        toolSlug: 'time-calculator',
        toolName: 'Calculateur de Temps',
        summary: `${decimalHours} h = ${decimalResult.formatted}`,
        inputs: { heuresDecimales: numDecimal },
        result: decimalResult.formatted,
      });
    }
  };

  const handleReset = () => {
    setStartTime('08:00');
    setEndTime('17:00');
    setBreakMin('0');
    setH1('0');
    setM1('0');
    setH2('0');
    setM2('0');
    setDecimalHours('0');
  };

  return (
    <ToolLayout
      toolSlug="time-calculator"
      title="Calculateur de Temps &amp; Heures"
      description="Calcul de durée de travail, intervalle horaire, pointage, conversion en heures décimales et cumul de durées."
      icon={Clock}
      onReset={handleReset}
    >
      {/* 1. Onglets */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setMode('between_times')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'between_times'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="size-4" />
          <span>Entre 2 heures</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('add_subtract')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'add_subtract'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calculator className="size-4" />
          <span>Addition / Soustr.</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('decimal_conversion')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'decimal_conversion'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Hourglass className="size-4" />
          <span>Heures Décimales</span>
        </button>
      </div>

      {/* 2. Formulaire */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        {mode === 'between_times' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Heure de début :</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Heure de fin :</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Pause à déduire (minutes) :
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={breakMin}
                onChange={(e) => setBreakMin(e.target.value)}
                placeholder="Ex: 45"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
              />
            </div>
          </div>
        )}

        {mode === 'add_subtract' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setOperation('add')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  operation === 'add' ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-muted-foreground'
                }`}
              >
                + Additionner
              </button>
              <button
                type="button"
                onClick={() => setOperation('subtract')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  operation === 'subtract' ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-muted-foreground'
                }`}
              >
                - Soustraire
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Durée 1 */}
              <div className="p-3 rounded-xl bg-surface-raised border border-border space-y-2">
                <p className="text-xs font-bold text-foreground">Durée 1 :</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-3xs text-muted-foreground">Heures :</label>
                    <input
                      type="number"
                      value={h1}
                      onChange={(e) => setH1(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-xs font-mono font-bold text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-3xs text-muted-foreground">Minutes :</label>
                    <input
                      type="number"
                      value={m1}
                      onChange={(e) => setM1(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-xs font-mono font-bold text-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Durée 2 */}
              <div className="p-3 rounded-xl bg-surface-raised border border-border space-y-2">
                <p className="text-xs font-bold text-foreground">Durée 2 :</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-3xs text-muted-foreground">Heures :</label>
                    <input
                      type="number"
                      value={h2}
                      onChange={(e) => setH2(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-xs font-mono font-bold text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-3xs text-muted-foreground">Minutes :</label>
                    <input
                      type="number"
                      value={m2}
                      onChange={(e) => setM2(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-surface px-2 text-xs font-mono font-bold text-foreground"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'decimal_conversion' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Heures en format décimal :
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={decimalHours}
                onChange={(e) => setDecimalHours(e.target.value)}
                placeholder="Ex: 8.25"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                h
              </span>
            </div>
            <p className="text-3xs text-muted-foreground">
              Ex: 8,25 h = 8 h 15 min | 8,50 h = 8 h 30 min | 8,75 h = 8 h 45 min
            </p>
          </div>
        )}

        <Button
          type="button"
          variant="primary"
          onClick={handleCalculate}
          className="w-full h-11 text-sm font-bold shadow-xs cursor-pointer gap-2"
        >
          <Sparkles className="size-4" />
          <span>Calculer la durée</span>
        </Button>
      </Card>

      {/* 3. Résultat */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-primary">
              Durée calculée
            </p>
            <div className="flex flex-wrap items-baseline gap-3 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                {mode === 'between_times'
                  ? betweenResult.formattedDuration
                  : mode === 'add_subtract'
                    ? addSubResult.formatted
                    : decimalResult.formatted}
              </span>
              {mode === 'between_times' && (
                <span className="text-lg sm:text-xl font-bold text-muted-foreground">
                  ({betweenResult.formattedDecimal})
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === 'between_times'
                ? `De ${startTime} à ${endTime} ${numBreak > 0 ? `(-${numBreak} min pause)` : ''}`
                : mode === 'add_subtract'
                  ? `Soit ${addSubResult.formattedDecimal}`
                  : `Équivalence de ${decimalHours} h`}
            </p>
          </div>

          <CopyResultButton
            textToCopy={
              mode === 'between_times'
                ? `${betweenResult.formattedDuration} (${betweenResult.formattedDecimal})`
                : mode === 'add_subtract'
                  ? addSubResult.formatted
                  : decimalResult.formatted
            }
            label="Copier"
          />
        </div>
      </Card>
    </ToolLayout>
  );
}
