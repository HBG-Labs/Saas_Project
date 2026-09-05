import { SelectField } from '@/components/ui/SelectField';
import {
  Circle,
  Hash,
  Sparkles,
  Square,
  Triangle,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeSurface,
  type SurfaceShape,
} from './compute';

export default function SurfaceCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [shape, setShape] = useState<SurfaceShape>('rectangle');
  const [inputUnit, setInputUnit] = useState<'m' | 'cm' | 'mm'>('m');

  // Champs de dimensions
  const [length, setLength] = useState<string>('12');
  const [width, setWidth] = useState<string>('5');
  const [side, setSide] = useState<string>('8');
  const [radius, setRadius] = useState<string>('3');
  const [base, setBase] = useState<string>('6');
  const [height, setHeight] = useState<string>('4');
  const [base2, setBase2] = useState<string>('10');

  const numLength = parseFloat(length.replace(',', '.')) || 0;
  const numWidth = parseFloat(width.replace(',', '.')) || 0;
  const numSide = parseFloat(side.replace(',', '.')) || 0;
  const numRadius = parseFloat(radius.replace(',', '.')) || 0;
  const numBase = parseFloat(base.replace(',', '.')) || 0;
  const numHeight = parseFloat(height.replace(',', '.')) || 0;
  const numBase2 = parseFloat(base2.replace(',', '.')) || 0;

  const result = useMemo(() => {
    return computeSurface({
      shape,
      length: numLength,
      width: numWidth,
      side: numSide,
      radius: numRadius,
      base: numBase,
      height: numHeight,
      base2: numBase2,
      inputUnit,
    });
  }, [shape, numLength, numWidth, numSide, numRadius, numBase, numHeight, numBase2, inputUnit]);

  const handleCalculate = () => {
    addHistoryEntry({
      toolSlug: 'surface-calculator',
      toolName: 'Calculateur de Surface',
      summary: `Surface (${shape}) = ${result.formattedM2} m² (${result.formula})`,
      inputs: {
        forme: shape,
        unite: inputUnit,
        longueur: numLength,
        largeur: numWidth,
        cote: numSide,
        rayon: numRadius,
      },
      result: `${result.formattedM2} m²`,
    });
  };

  const handleReset = () => {
    setLength('0');
    setWidth('0');
    setSide('0');
    setRadius('0');
    setBase('0');
    setHeight('0');
  };

  return (
    <ToolLayout
      toolSlug="surface-calculator"
      title="Calculateur de Surface &amp; Aire"
      description="Calcul précis des surfaces géométriques (rectangle, carré, cercle, triangle, trapèze) avec équivalences d'unités."
      icon={Square}
      onReset={handleReset}
    >
      {/* 1. Sélecteur de forme géométrique */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => setShape('rectangle')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'rectangle'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Square className="size-4" />
          <span>Rectangle</span>
        </button>

        <button
          type="button"
          onClick={() => setShape('square')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'square'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Square className="size-4" />
          <span>Carré</span>
        </button>

        <button
          type="button"
          onClick={() => setShape('circle')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'circle'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Circle className="size-4" />
          <span>Cercle</span>
        </button>

        <button
          type="button"
          onClick={() => setShape('triangle')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'triangle'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Triangle className="size-4" />
          <span>Triangle</span>
        </button>

        <button
          type="button"
          onClick={() => setShape('trapezoid')}
          className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
            shape === 'trapezoid'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Hash className="size-4" />
          <span>Trapèze</span>
        </button>
      </div>

      {/* 2. Formulaire des dimensions */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="surfacecalculatortool-dimensions" className="text-xs font-bold text-foreground uppercase tracking-wider">
            Dimensions ({shape.toUpperCase()}) :
          </label>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-muted-foreground">Unité de saisie :</span>
            <SelectField id="surfacecalculatortool-dimensions"
              value={inputUnit}
              onChange={(e) => setInputUnit(e.target.value as 'm' | 'cm' | 'mm')}
              className="h-8 rounded-lg border border-border bg-surface-raised px-2 text-xs font-bold text-foreground"
            >
              <option value="m">Mètre (m)</option>
              <option value="cm">Centimètre (cm)</option>
              <option value="mm">Millimètre (mm)</option>
            </SelectField>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {shape === 'rectangle' && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="surfacecalculatortool-longueur" className="text-xs font-bold text-foreground">Longueur :</label>
                <input id="surfacecalculatortool-longueur"
                  type="number"
                  inputMode="decimal"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="Ex: 12"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="surfacecalculatortool-largeur" className="text-xs font-bold text-foreground">Largeur :</label>
                <input id="surfacecalculatortool-largeur"
                  type="number"
                  inputMode="decimal"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="Ex: 5"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </>
          )}

          {shape === 'square' && (
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="surfacecalculatortool-longueur-d-un-cote" className="text-xs font-bold text-foreground">Longueur d'un côté :</label>
              <input id="surfacecalculatortool-longueur-d-un-cote"
                type="number"
                inputMode="decimal"
                value={side}
                onChange={(e) => setSide(e.target.value)}
                placeholder="Ex: 8"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
              />
            </div>
          )}

          {shape === 'circle' && (
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="surfacecalculatortool-rayon-r" className="text-xs font-bold text-foreground">Rayon (r) :</label>
              <input id="surfacecalculatortool-rayon-r"
                type="number"
                inputMode="decimal"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="Ex: 3"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
              />
              <p className="text-3xs text-muted-foreground">Astuce : Diamètre / 2 = Rayon</p>
            </div>
          )}

          {shape === 'triangle' && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="surfacecalculatortool-base-b" className="text-xs font-bold text-foreground">Base (b) :</label>
                <input id="surfacecalculatortool-base-b"
                  type="number"
                  inputMode="decimal"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                  placeholder="Ex: 6"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="surfacecalculatortool-hauteur-h" className="text-xs font-bold text-foreground">Hauteur (h) :</label>
                <input id="surfacecalculatortool-hauteur-h"
                  type="number"
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Ex: 4"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </>
          )}

          {shape === 'trapezoid' && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="surfacecalculatortool-petite-base-a" className="text-xs font-bold text-foreground">Petite Base (a) :</label>
                <input id="surfacecalculatortool-petite-base-a"
                  type="number"
                  inputMode="decimal"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                  placeholder="Ex: 4"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="surfacecalculatortool-grande-base-b" className="text-xs font-bold text-foreground">Grande Base (b) :</label>
                <input id="surfacecalculatortool-grande-base-b"
                  type="number"
                  inputMode="decimal"
                  value={base2}
                  onChange={(e) => setBase2(e.target.value)}
                  placeholder="Ex: 8"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="surfacecalculatortool-hauteur-h-2" className="text-xs font-bold text-foreground">Hauteur (h) :</label>
                <input id="surfacecalculatortool-hauteur-h-2"
                  type="number"
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Ex: 3"
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
          <span>Calculer la surface</span>
        </Button>
      </Card>

      {/* 3. Résultat & Équivalences */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-primary">
              Surface calculée
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                {result.formattedM2}
              </span>
              <span className="text-base sm:text-lg font-bold text-primary">m²</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Formule : {result.formula}
            </p>
            {result.perimeterInM > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Périmètre : {result.formattedPerimeterM} m
              </p>
            )}
          </div>

          <CopyResultButton
            textToCopy={`${result.formattedM2} m²`}
            label="Copier"
          />
        </div>

        {/* Grille des conversions */}
        <div className="pt-3 border-t border-border/60">
          <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Équivalences de surface :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {result.conversions.map((c) => (
              <div
                key={c.unit}
                className={`p-2 rounded-lg border text-xs ${
                  c.unit === 'm2'
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
