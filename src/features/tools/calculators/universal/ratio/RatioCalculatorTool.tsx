import {
  Calculator,
  PieChart,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeProportionalSplit,
  computeRuleOfThree,
  simplifyRatio,
  type RatioMode,
} from './compute';

export default function RatioCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [mode, setMode] = useState<RatioMode>('rule_of_three');

  // Mode 1: Règle de 3
  const [valA, setValA] = useState<string>('2');
  const [valB, setValB] = useState<string>('10');
  const [valC, setValC] = useState<string>('5');

  // Mode 2: Simplification
  const [ratioA, setRatioA] = useState<string>('1920');
  const [ratioB, setRatioB] = useState<string>('1080');

  // Mode 3: Répartition proportionnelle
  const [totalAmount, setTotalAmount] = useState<string>('1000');
  const [partsStr, setPartsStr] = useState<string>('2, 3, 5');

  const numA = parseFloat(valA.replace(',', '.')) || 0;
  const numB = parseFloat(valB.replace(',', '.')) || 0;
  const numC = parseFloat(valC.replace(',', '.')) || 0;

  const numRatioA = parseFloat(ratioA.replace(',', '.')) || 0;
  const numRatioB = parseFloat(ratioB.replace(',', '.')) || 0;

  const numTotal = parseFloat(totalAmount.replace(',', '.')) || 0;
  const partsArray = partsStr
    .split(/[,;\s]+/)
    .map((s) => parseFloat(s.replace(',', '.')))
    .filter((n) => !isNaN(n) && n > 0);

  const ruleResult = useMemo(() => {
    return computeRuleOfThree(numA, numB, numC);
  }, [numA, numB, numC]);

  const simplifyResult = useMemo(() => {
    return simplifyRatio(numRatioA, numRatioB);
  }, [numRatioA, numRatioB]);

  const splitResult = useMemo(() => {
    return computeProportionalSplit(numTotal, partsArray);
  }, [numTotal, partsArray]);

  const handleCalculate = () => {
    if (mode === 'rule_of_three') {
      addHistoryEntry({
        toolSlug: 'ratio-calculator',
        toolName: 'Calculateur de Rapport & Ratio',
        summary: `Règle de 3 : Si ${valA} → ${valB}, alors ${valC} → ${ruleResult.formattedD}`,
        inputs: { a: numA, b: numB, c: numC },
        result: `Résultat = ${ruleResult.formattedD}`,
      });
    } else if (mode === 'simplify_ratio') {
      addHistoryEntry({
        toolSlug: 'ratio-calculator',
        toolName: 'Calculateur de Rapport & Ratio',
        summary: `Ratio ${ratioA} : ${ratioB} = ${simplifyResult.formatted}`,
        inputs: { ratioA: numRatioA, ratioB: numRatioB },
        result: simplifyResult.formatted,
      });
    } else {
      addHistoryEntry({
        toolSlug: 'ratio-calculator',
        toolName: 'Calculateur de Rapport & Ratio',
        summary: `Répartition de ${totalAmount} selon ${partsStr} = [${splitResult.formattedShares.join(', ')}]`,
        inputs: { total: numTotal, parts: partsStr },
        result: splitResult.formattedShares.join(' / '),
      });
    }
  };

  const handleReset = () => {
    setValA('1');
    setValB('1');
    setValC('1');
    setRatioA('1');
    setRatioB('1');
    setTotalAmount('0');
  };

  return (
    <ToolLayout
      toolSlug="ratio-calculator"
      title="Calculateur de Rapport, Ratio &amp; Règle de 3"
      description="Résolution rapide de règles de trois directes, simplification de ratios d'aspect et répartition proportionnelle de charges."
      icon={Scale}
      onReset={handleReset}
    >
      {/* 1. Onglets */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setMode('rule_of_three')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'rule_of_three'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calculator className="size-4" />
          <span>Règle de 3 directe</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('simplify_ratio')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'simplify_ratio'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Scale className="size-4" />
          <span>Simplifier un ratio</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('proportional_split')}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 text-center ${
            mode === 'proportional_split'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <PieChart className="size-4" />
          <span>Partage proportionnel</span>
        </button>
      </div>

      {/* 2. Formulaire */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        {mode === 'rule_of_three' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Formule : <strong className="text-foreground">Si A donne B, alors C donne D</strong> (D = B × C / A)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="ratiocalculatortool-si-valeur-a" className="text-xs font-bold text-foreground">Si Valeur A :</label>
                <input id="ratiocalculatortool-si-valeur-a"
                  type="number"
                  inputMode="decimal"
                  value={valA}
                  onChange={(e) => setValA(e.target.value)}
                  placeholder="Ex: 2"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ratiocalculatortool-donne-valeur-b" className="text-xs font-bold text-foreground">Donne Valeur B :</label>
                <input id="ratiocalculatortool-donne-valeur-b"
                  type="number"
                  inputMode="decimal"
                  value={valB}
                  onChange={(e) => setValB(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ratiocalculatortool-alors-valeur-c" className="text-xs font-bold text-foreground">Alors Valeur C :</label>
                <input id="ratiocalculatortool-alors-valeur-c"
                  type="number"
                  inputMode="decimal"
                  value={valC}
                  onChange={(e) => setValC(e.target.value)}
                  placeholder="Ex: 5"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {mode === 'simplify_ratio' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="ratiocalculatortool-valeur-a-largeur-part-1" className="text-xs font-bold text-foreground">Valeur A (Largeur / Part 1) :</label>
              <input id="ratiocalculatortool-valeur-a-largeur-part-1"
                type="number"
                inputMode="decimal"
                value={ratioA}
                onChange={(e) => setRatioA(e.target.value)}
                placeholder="Ex: 1920"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ratiocalculatortool-valeur-b-hauteur-part-2" className="text-xs font-bold text-foreground">Valeur B (Hauteur / Part 2) :</label>
              <input id="ratiocalculatortool-valeur-b-hauteur-part-2"
                type="number"
                inputMode="decimal"
                value={ratioB}
                onChange={(e) => setRatioB(e.target.value)}
                placeholder="Ex: 1080"
                className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
              />
            </div>
          </div>
        )}

        {mode === 'proportional_split' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label htmlFor="ratiocalculatortool-total-a-repartir" className="text-xs font-bold text-foreground">Total à répartir :</label>
                <input id="ratiocalculatortool-total-a-repartir"
                  type="number"
                  inputMode="decimal"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="Ex: 1000"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ratiocalculatortool-cle-de-repartition-ratios-separes-par-vi" className="text-xs font-bold text-foreground">Clé de répartition (ratios séparés par virgules) :</label>
                <input id="ratiocalculatortool-cle-de-repartition-ratios-separes-par-vi"
                  type="text"
                  value={partsStr}
                  onChange={(e) => setPartsStr(e.target.value)}
                  placeholder="Ex: 2, 3, 5"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
              </div>
            </div>
            <p className="text-3xs text-muted-foreground">
              Exemple : Répartir 1000 selon 2, 3 et 5 donnera 200, 300 et 500.
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
          <span>Calculer</span>
        </Button>
      </Card>

      {/* 3. Résultat */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        {mode === 'rule_of_three' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                Valeur D calculée (Résultat)
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                  {ruleResult.formattedD}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Soit ({valB} × {valC}) / {valA}
              </p>
            </div>

            <CopyResultButton
              textToCopy={ruleResult.formattedD}
              label="Copier"
            />
          </div>
        )}

        {mode === 'simplify_ratio' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                Ratio simplifié
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                  {simplifyResult.formatted}
                </span>
                <span className="text-sm font-bold text-muted-foreground">
                  (Décimal : {simplifyResult.formattedDecimal})
                </span>
              </div>
            </div>

            <CopyResultButton
              textToCopy={simplifyResult.formatted}
              label="Copier"
            />
          </div>
        )}

        {mode === 'proportional_split' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  Répartition des parts
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total : {totalAmount} (Somme des coefficients = {splitResult.sumOfParts})
                </p>
              </div>

              <CopyResultButton
                textToCopy={splitResult.formattedShares.join(' | ')}
                label="Copier les parts"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {splitResult.formattedShares.map((share, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-border bg-surface-raised"
                >
                  <p className="text-3xs text-muted-foreground font-bold">
                    Part #{idx + 1} (Coeff {partsArray[idx]})
                  </p>
                  <p className="text-lg font-extrabold font-mono text-foreground mt-0.5">
                    {share}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </ToolLayout>
  );
}
