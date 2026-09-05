import { SelectField } from '@/components/ui/SelectField';
import {
  Droplets,
  Hourglass,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyResultButton, ToolLayout } from '../../../components/ToolLayout';
import { useToolHistory } from '../../../hooks/useToolHistory';
import {
  computeFillingTime,
  computeFlowFromVolumeAndTime,
} from './compute';

export default function FlowCalculatorTool() {
  const { addHistoryEntry } = useToolHistory();

  const [mode, setMode] = useState<'calc_flow' | 'calc_time'>('calc_flow');

  // Mode 1: Calcul de débit (Volume + Temps)
  const [volume1, setVolume1] = useState<string>('500');
  const [volumeUnit1, setVolumeUnit1] = useState<'l' | 'm3'>('l');
  const [time1, setTime1] = useState<string>('30');
  const [timeUnit1, setTimeUnit1] = useState<'min' | 'h' | 's'>('min');

  // Mode 2: Calcul de temps (Volume + Débit)
  const [volume2, setVolume2] = useState<string>('1000');
  const [volumeUnit2, setVolumeUnit2] = useState<'l' | 'm3'>('l');
  const [flow2, setFlow2] = useState<string>('20');
  const [flowUnit2, setFlowUnit2] = useState<'lmin' | 'm3h'>('lmin');

  const numVol1 = parseFloat(volume1.replace(',', '.')) || 0;
  const numTime1 = parseFloat(time1.replace(',', '.')) || 0;
  const numVol2 = parseFloat(volume2.replace(',', '.')) || 0;
  const numFlow2 = parseFloat(flow2.replace(',', '.')) || 0;

  // Conversion en litres et minutes
  const volume1Liters = volumeUnit1 === 'm3' ? numVol1 * 1000 : numVol1;
  const time1Minutes = timeUnit1 === 'h' ? numTime1 * 60 : timeUnit1 === 's' ? numTime1 / 60 : numTime1;

  const volume2Liters = volumeUnit2 === 'm3' ? numVol2 * 1000 : numVol2;
  const flow2Lmin = flowUnit2 === 'm3h' ? (numFlow2 * 1000) / 60 : numFlow2;

  const flowResult = useMemo(() => {
    return computeFlowFromVolumeAndTime(volume1Liters, time1Minutes);
  }, [volume1Liters, time1Minutes]);

  const timeResult = useMemo(() => {
    return computeFillingTime(volume2Liters, flow2Lmin);
  }, [volume2Liters, flow2Lmin]);

  const handleCalculate = () => {
    if (mode === 'calc_flow') {
      addHistoryEntry({
        toolSlug: 'flow-calculator',
        toolName: 'Calculateur de Débit',
        summary: `Débit : ${volume1} ${volumeUnit1} en ${time1} ${timeUnit1} = ${flowResult.formattedLmin} (${flowResult.formattedM3h})`,
        inputs: { volume: numVol1, uniteVolume: volumeUnit1, temps: numTime1, uniteTemps: timeUnit1 },
        result: `${flowResult.formattedLmin} (${flowResult.formattedM3h})`,
      });
    } else {
      addHistoryEntry({
        toolSlug: 'flow-calculator',
        toolName: 'Calculateur de Débit',
        summary: `Temps de remplissage : ${volume2} ${volumeUnit2} à ${flow2} ${flowUnit2} = ${timeResult.formattedTime}`,
        inputs: { volume: numVol2, uniteVolume: volumeUnit2, debit: numFlow2, uniteDebit: flowUnit2 },
        result: timeResult.formattedTime,
      });
    }
  };

  const handleReset = () => {
    setVolume1('0');
    setTime1('0');
    setVolume2('0');
    setFlow2('0');
  };

  return (
    <ToolLayout
      toolSlug="flow-calculator"
      title="Calculateur de Débit"
      description="Calcul de débit volumique (L/min, L/h, m³/h), conversion et estimation du temps de remplissage ou de vidange."
      icon={Droplets}
      onReset={handleReset}
    >
      {/* 1. Sélecteur de mode */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('calc_flow')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mode === 'calc_flow'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Droplets className="size-4" />
          <span>Calculer le Débit (V / t)</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('calc_time')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mode === 'calc_time'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Hourglass className="size-4" />
          <span>Temps de Remplissage (V / Q)</span>
        </button>
      </div>

      {/* 2. Formulaire */}
      <Card className="border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        {mode === 'calc_flow' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Volume */}
            <div className="space-y-1.5">
              <label htmlFor="flowcalculatortool-volume-ecoule" className="text-xs font-bold text-foreground">Volume écoulé :</label>
              <div className="flex gap-2">
                <input id="flowcalculatortool-volume-ecoule"
                  type="number"
                  inputMode="decimal"
                  value={volume1}
                  onChange={(e) => setVolume1(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
                <SelectField
                  value={volumeUnit1}
                  onChange={(e) => setVolumeUnit1(e.target.value as 'l' | 'm3')}
                  className="h-11 min-w-28 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground"
                >
                  <option value="l">Litres (L)</option>
                  <option value="m3">Mètre cube (m³)</option>
                </SelectField>
              </div>
            </div>

            {/* Temps */}
            <div className="space-y-1.5">
              <label htmlFor="flowcalculatortool-duree-d-ecoulement" className="text-xs font-bold text-foreground">Durée d'écoulement :</label>
              <div className="flex gap-2">
                <input id="flowcalculatortool-duree-d-ecoulement"
                  type="number"
                  inputMode="decimal"
                  value={time1}
                  onChange={(e) => setTime1(e.target.value)}
                  placeholder="Ex: 30"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
                <SelectField
                  value={timeUnit1}
                  onChange={(e) => setTimeUnit1(e.target.value as 'min' | 'h' | 's')}
                  className="h-11 min-w-28 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground"
                >
                  <option value="min">Minutes</option>
                  <option value="h">Heures</option>
                  <option value="s">Secondes</option>
                </SelectField>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Volume à remplir */}
            <div className="space-y-1.5">
              <label htmlFor="flowcalculatortool-volume-de-la-cuve-conduite" className="text-xs font-bold text-foreground">Volume de la cuve / conduite :</label>
              <div className="flex gap-2">
                <input id="flowcalculatortool-volume-de-la-cuve-conduite"
                  type="number"
                  inputMode="decimal"
                  value={volume2}
                  onChange={(e) => setVolume2(e.target.value)}
                  placeholder="Ex: 1000"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
                <SelectField
                  value={volumeUnit2}
                  onChange={(e) => setVolumeUnit2(e.target.value as 'l' | 'm3')}
                  className="h-11 min-w-28 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground"
                >
                  <option value="l">Litres (L)</option>
                  <option value="m3">Mètre cube (m³)</option>
                </SelectField>
              </div>
            </div>

            {/* Débit de la pompe */}
            <div className="space-y-1.5">
              <label htmlFor="flowcalculatortool-debit-de-la-pompe-arrivee" className="text-xs font-bold text-foreground">Débit de la pompe / arrivée :</label>
              <div className="flex gap-2">
                <input id="flowcalculatortool-debit-de-la-pompe-arrivee"
                  type="number"
                  inputMode="decimal"
                  value={flow2}
                  onChange={(e) => setFlow2(e.target.value)}
                  placeholder="Ex: 20"
                  className="w-full h-11 rounded-xl border border-border bg-surface-raised px-3.5 text-base font-bold text-foreground font-mono"
                />
                <SelectField
                  value={flowUnit2}
                  onChange={(e) => setFlowUnit2(e.target.value as 'lmin' | 'm3h')}
                  className="h-11 min-w-28 rounded-xl border border-border bg-surface-raised px-2.5 text-xs font-semibold text-foreground"
                >
                  <option value="lmin">L / min</option>
                  <option value="m3h">m³ / h</option>
                </SelectField>
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
          <span>Calculer</span>
        </Button>
      </Card>

      {/* 3. Résultat */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm space-y-4">
        {mode === 'calc_flow' ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  Débit calculé
                </p>
                <div className="flex flex-wrap items-baseline gap-3 mt-1">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                    {flowResult.formattedLmin}
                  </span>
                  <span className="text-lg font-bold text-muted-foreground">
                    soit {flowResult.formattedM3h}
                  </span>
                </div>
              </div>

              <CopyResultButton
                textToCopy={`${flowResult.formattedLmin} (${flowResult.formattedM3h})`}
                label="Copier"
              />
            </div>

            <div className="pt-3 border-t border-border/60">
              <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Équivalences de débit :
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {flowResult.conversions.map((c) => (
                  <div
                    key={c.unit}
                    className="p-2 rounded-lg border border-border bg-surface-raised text-xs text-foreground"
                  >
                    <p className="text-3xs text-muted-foreground truncate">{c.name}</p>
                    <p className="font-mono font-bold mt-0.5 truncate">
                      {c.formatted} <span className="text-3xs font-normal opacity-80">{c.symbol}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                Temps estimé de remplissage
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground">
                  {timeResult.formattedTime}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pour remplir {volume2} {volumeUnit2 === 'm3' ? 'm³' : 'L'} à {flow2} {flowUnit2 === 'm3h' ? 'm³/h' : 'L/min'}
              </p>
            </div>

            <CopyResultButton
              textToCopy={timeResult.formattedTime}
              label="Copier"
            />
          </div>
        )}
      </Card>
    </ToolLayout>
  );
}
