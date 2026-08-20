import {
  Scale,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeTotalWeight,
  WEIGHT_UNITS,
  type WeightUnit,
} from './compute';

export default function WeightCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [quantity, setQuantity] = useState<string>('12');
  const [unitWeight, setUnitWeight] = useState<string>('2.5');
  const [unit, setUnit] = useState<WeightUnit>('kg');

  const numQty = parseFloat(quantity.replace(',', '.')) || 0;
  const numUnitWeight = parseFloat(unitWeight.replace(',', '.')) || 0;

  const result = useMemo(() => {
    return computeTotalWeight(numQty, numUnitWeight, unit);
  }, [numQty, numUnitWeight, unit]);

  const handleCalculate = () => {
    addHistoryEntry({
      toolSlug: 'weight-calculator',
      toolName: 'Calculateur de Poids',
      summary: `Poids total : ${quantity} × ${unitWeight} ${unit} = ${result.formattedTotal} ${unit}`,
      inputs: { quantite: numQty, poidsUnitaire: numUnitWeight, unite: unit },
      result: `${result.formattedTotal} ${unit}`,
    });
  };

  const handleReset = () => {
    setQuantity('1');
    setUnitWeight('0');
  };

  return (
    <ToolLayout
      toolSlug="weight-calculator"
      title="Calculateur de Poids &amp; Masse"
      description="Calcul de charge totale, conversion de masse (kg, tonnes, grammes, livres) et estimation de poids pour le transport et manutention."
      icon={Scale}
      onReset={handleReset}
    >
      {/* Formulaire */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Quantité */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Nombre d'unités (Quantité) :
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 12"
              className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
            />
          </div>

          {/* Poids unitaire */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Poids d'une unité :
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={unitWeight}
                onChange={(e) => setUnitWeight(e.target.value)}
                placeholder="Ex: 2.5"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as WeightUnit)}
                className="h-11 min-w-28 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(WEIGHT_UNITS).map(([k, u]) => (
                  <option key={k} value={k}>
                    {u.symbol} ({u.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleCalculate}
          className="w-full h-11 text-sm font-bold shadow-xs cursor-pointer gap-2"
        >
          <Sparkles className="size-4" />
          <span>Calculer le poids total</span>
        </Button>
      </Card>

      {/* Résultat & Équivalences */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-primary">
              Poids total calculé
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                {result.formattedTotal}
              </span>
              <span className="text-lg sm:text-xl font-bold text-primary">
                {WEIGHT_UNITS[unit].symbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Soit {quantity} articles à {unitWeight} {WEIGHT_UNITS[unit].symbol}
            </p>
          </div>

          <CopyResultButton
            textToCopy={`${result.formattedTotal} ${WEIGHT_UNITS[unit].symbol}`}
            label="Copier"
          />
        </div>

        {/* Grille des conversions */}
        <div className="pt-3 border-t border-border/60">
          <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Équivalences dans les autres unités :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {result.conversions.map((c) => (
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
