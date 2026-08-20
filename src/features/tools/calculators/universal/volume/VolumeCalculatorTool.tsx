import {
  Box,
  CircleDot,
  Cylinder,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeVolume,
  type VolumeShape,
} from './compute';

export default function VolumeCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [shape, setShape] = useState<VolumeShape>('cuboid');
  const [inputUnit, setInputUnit] = useState<'m' | 'cm' | 'mm'>('m');

  // Champs de dimensions
  const [length, setLength] = useState<string>('3');
  const [width, setWidth] = useState<string>('2');
  const [height, setHeight] = useState<string>('1.5');
  const [radius, setRadius] = useState<string>('1');

  const numLength = parseFloat(length.replace(',', '.')) || 0;
  const numWidth = parseFloat(width.replace(',', '.')) || 0;
  const numHeight = parseFloat(height.replace(',', '.')) || 0;
  const numRadius = parseFloat(radius.replace(',', '.')) || 0;

  const result = useMemo(() => {
    return computeVolume({
      shape,
      length: numLength,
      width: numWidth,
      height: numHeight,
      radius: numRadius,
      inputUnit,
    });
  }, [shape, numLength, numWidth, numHeight, numRadius, inputUnit]);

  const handleCalculate = () => {
    addHistoryEntry({
      toolSlug: 'volume-calculator',
      toolName: 'Calculateur de Volume',
      summary: `Volume (${shape}) = ${result.formattedM3} m³ (${result.formattedLiters} L)`,
      inputs: {
        forme: shape,
        unite: inputUnit,
        longueur: numLength,
        largeur: numWidth,
        hauteur: numHeight,
        rayon: numRadius,
      },
      result: `${result.formattedM3} m³ (${result.formattedLiters} L)`,
    });
  };

  const handleReset = () => {
    setLength('0');
    setWidth('0');
    setHeight('0');
    setRadius('0');
  };

  return (
    <ToolLayout
      toolSlug="volume-calculator"
      title="Calculateur de Volume &amp; Capacité"
      description="Calcul de volumes géométriques (parallélépipède, cylindre, cuve, sphère) avec équivalence en litres et m³."
      icon={Box}
      onReset={handleReset}
    >
      {/* 1. Sélecteur de forme géométrique */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setShape('cuboid')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'cuboid'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Box className="size-4" />
          <span>Parallélépipède</span>
        </button>

        <button
          type="button"
          onClick={() => setShape('cylinder')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'cylinder'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cylinder className="size-4" />
          <span>Cylindre / Cuve</span>
        </button>

        <button
          type="button"
          onClick={() => setShape('sphere')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'sphere'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <CircleDot className="size-4" />
          <span>Sphère</span>
        </button>

        <button
          type="button"
          onClick={() => setShape('cone')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'cone'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Box className="size-4" />
          <span>Cône / Trémie</span>
        </button>
      </div>

      {/* 2. Formulaire des dimensions */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground uppercase tracking-wider">
            Dimensions ({shape.toUpperCase()}) :
          </label>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-muted-foreground">Unité :</span>
            <select
              value={inputUnit}
              onChange={(e) => setInputUnit(e.target.value as 'm' | 'cm' | 'mm')}
              className="h-8 rounded-lg border border-border bg-surface-raised px-2 text-xs font-bold text-foreground"
            >
              <option value="m">Mètre (m)</option>
              <option value="cm">Centimètre (cm)</option>
              <option value="mm">Millimètre (mm)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {shape === 'cuboid' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Longueur :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="Ex: 3"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Largeur :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="Ex: 2"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Hauteur :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Ex: 1.5"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </>
          )}

          {(shape === 'cylinder' || shape === 'cone') && (
            <>
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-xs font-bold text-foreground">Rayon (r) :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  placeholder="Ex: 1"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
                <p className="text-3xs text-muted-foreground">Rayon = Diamètre / 2</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-foreground">Hauteur (h) :</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Ex: 2.5"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </>
          )}

          {shape === 'sphere' && (
            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-xs font-bold text-foreground">Rayon de la sphère :</label>
              <input
                type="number"
                inputMode="decimal"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="Ex: 1"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
              />
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
          <span>Calculer le volume</span>
        </Button>
      </Card>

      {/* 3. Résultat & Équivalences */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-primary">
              Volume &amp; Capacité calculés
            </p>
            <div className="flex flex-wrap items-baseline gap-3 mt-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                  {result.formattedM3}
                </span>
                <span className="text-base sm:text-lg font-bold text-primary">m³</span>
              </div>
              <span className="text-muted-foreground font-bold text-sm">soit</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {result.formattedLiters}
                </span>
                <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">Litres</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Formule : {result.formula}
            </p>
          </div>

          <CopyResultButton
            textToCopy={`${result.formattedM3} m³ (${result.formattedLiters} L)`}
            label="Copier"
          />
        </div>

        {/* Grille des conversions */}
        <div className="pt-3 border-t border-border/60">
          <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Équivalences de volume :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {result.conversions.map((c) => (
              <div
                key={c.unit}
                className={`p-2 rounded-lg border text-xs ${
                  c.unit === 'm3' || c.unit === 'l'
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
