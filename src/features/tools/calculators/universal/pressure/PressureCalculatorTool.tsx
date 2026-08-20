import {
  Gauge,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computePressureConversions,
  PRESSURE_UNITS,
  type PressureUnit,
} from './compute';

export default function PressureCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [valueStr, setValueStr] = useState<string>('6');
  const [unit, setUnit] = useState<PressureUnit>('bar');

  const numVal = parseFloat(valueStr.replace(',', '.')) || 0;

  const result = useMemo(() => {
    return computePressureConversions(numVal, unit);
  }, [numVal, unit]);

  const handleCalculate = () => {
    const psiVal = result.conversions.find((c) => c.unit === 'psi')?.formatted ?? '';
    addHistoryEntry({
      toolSlug: 'pressure-calculator',
      toolName: 'Calculateur de Pression',
      summary: `Pression : ${valueStr} ${PRESSURE_UNITS[unit].symbol} (${psiVal} PSI)`,
      inputs: { valeur: numVal, unite: unit },
      result: `${valueStr} ${PRESSURE_UNITS[unit].symbol}`,
    });
  };

  const handleReset = () => {
    setValueStr('0');
  };

  return (
    <ToolLayout
      toolSlug="pressure-calculator"
      title="Calculateur de Pression"
      description="Conversion instantanée de pressions pour les réseaux hydrauliques, pneumatiques, gaz, CVC et compresseurs."
      icon={Gauge}
      onReset={handleReset}
    >
      {/* Formulaire */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">
            Valeur de pression à convertir :
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              placeholder="Ex: 6"
              className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as PressureUnit)}
              className="h-11 min-w-36 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.entries(PRESSURE_UNITS).map(([k, u]) => (
                <option key={k} value={k}>
                  {u.symbol} ({u.name})
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

      {/* Résultat & Équivalences */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-primary">
              Pression équivalente
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                {valueStr}
              </span>
              <span className="text-lg sm:text-xl font-bold text-primary">
                {PRESSURE_UNITS[unit].symbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {PRESSURE_UNITS[unit].name}
            </p>
          </div>

          <CopyResultButton
            textToCopy={`${valueStr} ${PRESSURE_UNITS[unit].symbol}`}
            label="Copier"
          />
        </div>

        {/* Grille des conversions */}
        <div className="pt-3 border-t border-border/60">
          <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Équivalences dans toutes les unités :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {result.conversions.map((c) => (
              <div
                key={c.unit}
                className={`p-2.5 rounded-xl border text-xs ${
                  c.unit === unit
                    ? 'border-primary bg-primary/15 font-bold text-primary'
                    : 'border-border bg-surface-raised text-foreground'
                }`}
              >
                <p className="text-3xs text-muted-foreground truncate">{c.name}</p>
                <p className="font-mono font-bold mt-0.5 truncate text-sm">
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
