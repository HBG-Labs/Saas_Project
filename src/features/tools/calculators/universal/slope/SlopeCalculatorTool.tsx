import {
  Compass,
  Percent,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeSlopeDirect,
  computeSlopeInverseDegrees,
  computeSlopeInversePercent,
  type SlopeMode,
} from './compute';

export default function SlopeCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [mode, setMode] = useState<SlopeMode>('direct');

  // Champs de saisie
  const [heightDiff, setHeightDiff] = useState<string>('2');
  const [horizDist, setHorizDist] = useState<string>('10');
  const [targetSlope, setTargetSlope] = useState<string>('20');
  const [targetAngle, setTargetAngle] = useState<string>('11.31');

  const numHeight = parseFloat(heightDiff.replace(',', '.')) || 0;
  const numDist = parseFloat(horizDist.replace(',', '.')) || 0;
  const numSlope = parseFloat(targetSlope.replace(',', '.')) || 0;
  const numAngle = parseFloat(targetAngle.replace(',', '.')) || 0;

  const directRes = useMemo(() => {
    return computeSlopeDirect({
      heightDifference: numHeight,
      horizontalDistance: numDist,
    });
  }, [numHeight, numDist]);

  const inversePercentRes = useMemo(() => {
    return computeSlopeInversePercent({
      slopePercent: numSlope,
      horizontalDistance: numDist,
    });
  }, [numSlope, numDist]);

  const inverseDegreesRes = useMemo(() => {
    return computeSlopeInverseDegrees({
      angleDegrees: numAngle,
      horizontalDistance: numDist,
    });
  }, [numAngle, numDist]);

  const handleCalculate = () => {
    if (mode === 'direct') {
      addHistoryEntry({
        toolSlug: 'slope-calculator',
        toolName: 'Calculateur de Pente',
        summary: `Pente : ${directRes.formattedSlopePercent} (${directRes.formattedAngleDegrees}) pour H=${heightDiff}m, D=${horizDist}m`,
        inputs: { denivele: numHeight, distanceHorizontale: numDist },
        result: `${directRes.formattedSlopePercent} (${directRes.formattedAngleDegrees})`,
      });
    } else if (mode === 'inverse_percent') {
      addHistoryEntry({
        toolSlug: 'slope-calculator',
        toolName: 'Calculateur de Pente',
        summary: `Dénivelé calculé : ${inversePercentRes.formattedHeightDifference} pour pente ${targetSlope}% sur ${horizDist}m`,
        inputs: { pentePourcent: numSlope, distanceHorizontale: numDist },
        result: `Dénivelé = ${inversePercentRes.formattedHeightDifference}`,
      });
    } else {
      addHistoryEntry({
        toolSlug: 'slope-calculator',
        toolName: 'Calculateur de Pente',
        summary: `Dénivelé calculé : ${inverseDegreesRes.formattedHeightDifference} pour angle ${targetAngle}° sur ${horizDist}m`,
        inputs: { angleDegres: numAngle, distanceHorizontale: numDist },
        result: `Dénivelé = ${inverseDegreesRes.formattedHeightDifference}`,
      });
    }
  };

  const handleReset = () => {
    setHeightDiff('0');
    setHorizDist('0');
    setTargetSlope('0');
    setTargetAngle('0');
  };

  return (
    <ToolLayout
      toolSlug="slope-calculator"
      title="Calculateur de Pente &amp; Inclinaison"
      description="Calcul simple et direct de pente en %, angle en degrés, dénivelé et longueur de rampe pour le terrassement, voirie, toitures et réseaux."
      icon={TrendingUp}
      onReset={handleReset}
    >
      {/* 1. Sélecteur de mode de calcul */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setMode('direct')}
          className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'direct'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="size-4" />
          <span>Dénivelé → Pente</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('inverse_percent')}
          className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'inverse_percent'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Percent className="size-4" />
          <span>Pente % → Dénivelé</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('inverse_degrees')}
          className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'inverse_degrees'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Compass className="size-4" />
          <span>Angle ° → Dénivelé</span>
        </button>
      </div>

      {/* 2. Formulaire */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        {mode === 'direct' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Dénivelé / Hauteur (H) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={heightDiff}
                  onChange={(e) => setHeightDiff(e.target.value)}
                  placeholder="Ex: 2"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  m
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Distance horizontale (D) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={horizDist}
                  onChange={(e) => setHorizDist(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  m
                </span>
              </div>
            </div>
          </div>
        )}

        {mode === 'inverse_percent' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Pente souhaitée (%) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetSlope}
                  onChange={(e) => setTargetSlope(e.target.value)}
                  placeholder="Ex: 20"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Distance horizontale (D) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={horizDist}
                  onChange={(e) => setHorizDist(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  m
                </span>
              </div>
            </div>
          </div>
        )}

        {mode === 'inverse_degrees' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Angle d'inclinaison (°) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetAngle}
                  onChange={(e) => setTargetAngle(e.target.value)}
                  placeholder="Ex: 11.31"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  °
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Distance horizontale (D) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={horizDist}
                  onChange={(e) => setHorizDist(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-base font-bold text-foreground font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  m
                </span>
              </div>
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="primary"
          onClick={handleCalculate}
          className="w-full h-11 text-sm font-bold shadow-xs cursor-pointer gap-2"
        >
          <Sparkles className="size-4" />
          <span>Calculer la pente</span>
        </Button>
      </Card>

      {/* 3. Résultat */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        {mode === 'direct' ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  Pente calculée
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                    {directRes.formattedSlopePercent}
                  </span>
                  <span className="text-lg font-bold text-muted-foreground">
                    ({directRes.formattedAngleDegrees})
                  </span>
                </div>
              </div>

              <CopyResultButton
                textToCopy={`Pente: ${directRes.formattedSlopePercent} (${directRes.formattedAngleDegrees})`}
                label="Copier"
              />
            </div>

            <div className="pt-3 border-t border-border/60 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-raised border border-border">
                <p className="text-3xs text-muted-foreground">Longueur de rampe réelle</p>
                <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                  {directRes.formattedSlopeLength}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-raised border border-border">
                <p className="text-3xs text-muted-foreground">Rapport de pente</p>
                <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                  {directRes.ratio}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-raised border border-border col-span-2 sm:col-span-1">
                <p className="text-3xs text-muted-foreground">Dénivelé / Distance</p>
                <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                  {heightDiff} m / {horizDist} m
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  Dénivelé vertical requis
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                    {mode === 'inverse_percent'
                      ? inversePercentRes.formattedHeightDifference
                      : inverseDegreesRes.formattedHeightDifference}
                  </span>
                </div>
              </div>

              <CopyResultButton
                textToCopy={
                  mode === 'inverse_percent'
                    ? inversePercentRes.formattedHeightDifference
                    : inverseDegreesRes.formattedHeightDifference
                }
                label="Copier"
              />
            </div>

            <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-raised border border-border">
                <p className="text-3xs text-muted-foreground">Longueur de rampe</p>
                <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                  {mode === 'inverse_percent'
                    ? inversePercentRes.formattedSlopeLength
                    : inverseDegreesRes.formattedSlopeLength}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-raised border border-border">
                <p className="text-3xs text-muted-foreground">Angle / Pente</p>
                <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                  {mode === 'inverse_percent'
                    ? inversePercentRes.formattedAngleDegrees
                    : inverseDegreesRes.formattedSlopePercent}
                </p>
              </div>
            </div>
          </>
        )}
      </Card>
    </ToolLayout>
  );
}
