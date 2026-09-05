import { SelectField } from '@/components/ui/SelectField';
import {
  ArrowLeftRight,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  convertUnit,
  UNIT_CATEGORIES,
  type UnitCategory,
} from './compute';

export default function UnitConverterTool() {
  const { addHistoryEntry } = useToolHistory();

  const [category, setCategory] = useState<UnitCategory>('length');
  const [valueStr, setValueStr] = useState<string>('100');

  // Initialiser les unités par défaut selon la catégorie
  const currentUnits = Object.keys(UNIT_CATEGORIES[category].units);
  const [fromUnit, setFromUnit] = useState<string>(currentUnits[0] ?? 'm');
  const [toUnit, setToUnit] = useState<string>(currentUnits[1] ?? 'km');

  const handleCategoryChange = (newCat: UnitCategory) => {
    setCategory(newCat);
    const units = Object.keys(UNIT_CATEGORIES[newCat].units);
    setFromUnit(units[0] ?? '');
    setToUnit(units[1] ?? units[0] ?? '');
  };

  const handleSwapUnits = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
  };

  const numValue = parseFloat(valueStr.replace(',', '.')) || 0;

  const conversion = useMemo(() => {
    try {
      return convertUnit({
        category,
        value: numValue,
        fromUnitId: fromUnit,
        toUnitId: toUnit,
      });
    } catch {
      return null;
    }
  }, [category, numValue, fromUnit, toUnit]);

  const handleCalculate = () => {
    if (conversion) {
      addHistoryEntry({
        toolSlug: 'unit-converter',
        toolName: "Convertisseur d'unités",
        summary: `${valueStr} ${conversion.fromSymbol} → ${conversion.formattedResult} ${conversion.toSymbol}`,
        inputs: {
          category,
          valeur: numValue,
          de: fromUnit,
          vers: toUnit,
        },
        result: `${conversion.formattedResult} ${conversion.toSymbol}`,
      });
    }
  };

  const handleReset = () => {
    setValueStr('0');
  };

  return (
    <ToolLayout
      toolSlug="unit-converter"
      title="Convertisseur d'Unités Universel"
      description="Conversions instantanées et précises pour toutes les unités physiques du terrain."
      icon={ArrowLeftRight}
      onReset={handleReset}
    >
      {/* 1. Sélecteur de catégorie (scroll horizontal sur mobile) */}
      <Card className="border-border bg-surface p-3 sm:p-4 shadow-xs space-y-2">
        {/* Groupe de boutons, pas un champ : voir la note de RecordMovementModal. */}
        <span
          id="convertisseur-grandeur-libelle"
          className="block text-2xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          Grandeur physique :
        </span>
        <div
          role="group"
          aria-labelledby="convertisseur-grandeur-libelle"
          className="flex flex-wrap gap-2"
        >
          {(Object.keys(UNIT_CATEGORIES) as UnitCategory[]).map((catKey) => {
            const cat = UNIT_CATEGORIES[catKey];
            const isSelected = category === catKey;
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => handleCategoryChange(catKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-surface-raised text-muted-foreground hover:text-foreground hover:bg-surface-hover border border-border/50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 2. Formulaire de saisie & sélection des unités */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Valeur & Unité Source */}
          <div className="space-y-1.5">
            <label htmlFor="unitconvertertool-valeur-a-convertir" className="text-xs font-bold text-foreground">
              Valeur à convertir :
            </label>
            <div className="flex gap-2">
              <input id="unitconvertertool-valeur-a-convertir"
                type="number"
                inputMode="decimal"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder="Ex: 1250"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <SelectField
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="h-11 min-w-28 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.values(UNIT_CATEGORIES[category].units).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          {/* Bouton d'inversion & Unité Cible */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="unitconvertertool-convertir-vers" className="text-xs font-bold text-foreground">
                Convertir vers :
              </label>
              <button
                type="button"
                onClick={handleSwapUnits}
                className="text-3xs inline-flex items-center gap-1 text-primary hover:underline font-semibold cursor-pointer"
              >
                <ArrowRightLeft className="size-3" />
                <span>Intervertir</span>
              </button>
            </div>
            <SelectField id="unitconvertertool-convertir-vers"
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.values(UNIT_CATEGORIES[category].units).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {/* Bouton Calculer / Enregistrer */}
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

      {/* 3. Résultat principal */}
      {conversion && (
        <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                Résultat de la conversion
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                  {conversion.formattedResult}
                </span>
                <span className="text-base sm:text-lg font-bold text-primary">
                  {conversion.toSymbol}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Équivalence de {valueStr} {conversion.fromSymbol}
              </p>
            </div>

            <CopyResultButton
              textToCopy={`${conversion.formattedResult} ${conversion.toSymbol}`}
              label="Copier"
            />
          </div>

          {/* Tableau de toutes les équivalences dans la catégorie */}
          <div className="pt-3 border-t border-border/60">
            <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Toutes les équivalences :
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {conversion.allConversions.map((eq) => (
                <div
                  key={eq.unitId}
                  className={`p-2 rounded-lg border text-xs ${
                    eq.unitId === toUnit
                      ? 'border-primary bg-primary/15 font-bold text-primary'
                      : 'border-border bg-surface-raised text-foreground'
                  }`}
                >
                  <p className="text-3xs text-muted-foreground truncate">{eq.name}</p>
                  <p className="font-mono font-bold mt-0.5 truncate">
                    {eq.formatted} <span className="text-3xs font-normal opacity-80">{eq.symbol}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </ToolLayout>
  );
}
