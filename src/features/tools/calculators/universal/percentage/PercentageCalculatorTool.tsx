import {
  Minus,
  Percent,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeAddPercent,
  computeEvolution,
  computePartOfTotal,
  computePercentOf,
  computeSubtractPercent,
  type PercentageMode,
} from './compute';

export default function PercentageCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [mode, setMode] = useState<PercentageMode>('percent_of');

  // Champs de saisie
  const [val1, setVal1] = useState<string>('20');
  const [val2, setVal2] = useState<string>('500');

  const num1 = parseFloat(val1.replace(',', '.')) || 0;
  const num2 = parseFloat(val2.replace(',', '.')) || 0;

  const result = useMemo(() => {
    switch (mode) {
      case 'percent_of': {
        const res = computePercentOf(num1, num2);
        return {
          main: res.formatted,
          unit: '',
          subtitle: `${val1} % de ${val2} = ${res.formatted}`,
          copyText: res.formatted,
        };
      }
      case 'evolution': {
        const res = computeEvolution(num1, num2);
        return {
          main: res.formatted,
          unit: '',
          subtitle: `Variation de ${val1} à ${val2} (${res.formattedDiff})`,
          copyText: res.formatted,
        };
      }
      case 'subtract_percent': {
        const res = computeSubtractPercent(num1, num2);
        return {
          main: res.formattedFinal,
          unit: '',
          subtitle: `${val1} - ${val2} % (Remise de ${res.formattedDiscount})`,
          copyText: res.formattedFinal,
        };
      }
      case 'add_percent': {
        const res = computeAddPercent(num1, num2);
        return {
          main: res.formattedFinal,
          unit: '',
          subtitle: `${val1} + ${val2} % (Majoration de ${res.formattedIncrease})`,
          copyText: res.formattedFinal,
        };
      }
      case 'part_of_total': {
        const res = computePartOfTotal(num1, num2);
        return {
          main: res.formatted,
          unit: '',
          subtitle: `${val1} représente ${res.formatted} de ${val2}`,
          copyText: res.formatted,
        };
      }
    }
  }, [mode, num1, num2, val1, val2]);

  const handleCalculate = () => {
    addHistoryEntry({
      toolSlug: 'percentage-calculator',
      toolName: 'Calculateur de Pourcentage',
      summary: result.subtitle,
      inputs: { mode, val1: num1, val2: num2 },
      result: result.main,
    });
  };

  const handleReset = () => {
    setVal1('0');
    setVal2('0');
  };

  return (
    <ToolLayout
      toolSlug="percentage-calculator"
      title="Calculateur de Pourcentage"
      description="Calcul de part, taux d'évolution, remise commerciale, majoration / TVA et proportionnalité."
      icon={Percent}
      onReset={handleReset}
    >
      {/* 1. Onglets de sélection du mode */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('percent_of');
            setVal1('20');
            setVal2('500');
          }}
          className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'percent_of'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Percent className="size-3.5" />
          <span>% d'une valeur</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('evolution');
            setVal1('100');
            setVal2('125');
          }}
          className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'evolution'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="size-3.5" />
          <span>Évolution (+/-%</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('subtract_percent');
            setVal1('500');
            setVal2('20');
          }}
          className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'subtract_percent'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Minus className="size-3.5" />
          <span>Retirer % (Remise)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('add_percent');
            setVal1('500');
            setVal2('20');
          }}
          className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'add_percent'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plus className="size-3.5" />
          <span>Ajouter % (TVA)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('part_of_total');
            setVal1('25');
            setVal2('200');
          }}
          className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center col-span-2 sm:col-span-1 ${
            mode === 'part_of_total'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Percent className="size-3.5" />
          <span>Part sur Total</span>
        </button>
      </div>

      {/* 2. Formulaire */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {mode === 'percent_of' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Pourcentage (%) :</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={val1}
                    onChange={(e) => setVal1(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">De la valeur :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={val2}
                  onChange={(e) => setVal2(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </>
          )}

          {mode === 'evolution' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Valeur Initiale :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  placeholder="Ex: 100"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Valeur Finale :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={val2}
                  onChange={(e) => setVal2(e.target.value)}
                  placeholder="Ex: 125"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </>
          )}

          {mode === 'subtract_percent' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Montant initial :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Pourcentage à déduire :</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={val2}
                    onChange={(e) => setVal2(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>
            </>
          )}

          {mode === 'add_percent' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Montant initial :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Pourcentage à ajouter :</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={val2}
                    onChange={(e) => setVal2(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>
            </>
          )}

          {mode === 'part_of_total' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Valeur partielle :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  placeholder="Ex: 25"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Total de référence :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={val2}
                  onChange={(e) => setVal2(e.target.value)}
                  placeholder="Ex: 200"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleCalculate}
          className="w-full h-11 text-sm font-bold shadow-xs cursor-pointer gap-2"
        >
          <Sparkles className="size-4" />
          <span>Calculer le pourcentage</span>
        </Button>
      </Card>

      {/* 3. Résultat */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-primary">
              Résultat
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                {result.main}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {result.subtitle}
            </p>
          </div>

          <CopyResultButton
            textToCopy={result.copyText}
            label="Copier"
          />
        </div>
      </Card>
    </ToolLayout>
  );
}
