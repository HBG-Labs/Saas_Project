import { Calculator, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

import { computeDbmMwConversion } from './compute';

export default function DbmMwConverterTool() {
  const [mode, setMode] = useState<'dbm_to_mw' | 'mw_to_dbm'>('dbm_to_mw');
  const [value, setValue] = useState(10);
  const [impedanceOhms, setImpedanceOhms] = useState(50);
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      computeDbmMwConversion({
        mode,
        value: Number(value) || 0,
        impedanceOhms: Number(impedanceOhms) || 50,
      }),
    [mode, value, impedanceOhms],
  );

  const handleCopy = () => {
    const summary = `Conversion Puissance : ${result.powerDbm} dBm = ${result.powerMw} mW (${result.powerWatts} W) | Vrms: ${result.vrmsVolts} V @ ${impedanceOhms} Ω`;
    void navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-5 text-primary" />
            Conversion de Puissance RF & Optique
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <label className="text-foreground text-xs font-semibold block mb-1.5">
              Sens de conversion
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === 'dbm_to_mw' ? 'primary' : 'outline'}
                onClick={() => {
                  setMode('dbm_to_mw');
                  setValue(10);
                }}
                className="w-full text-xs"
              >
                dBm → Milliwatts (mW)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'mw_to_dbm' ? 'primary' : 'outline'}
                onClick={() => {
                  setMode('mw_to_dbm');
                  setValue(10);
                }}
                className="w-full text-xs"
              >
                Milliwatts (mW) → dBm
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={mode === 'dbm_to_mw' ? 'Puissance (dBm)' : 'Puissance (mW)'}
              type="number"
              step="0.1"
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value))}
            />
            <Input
              label="Impédance de ligne (Ω)"
              type="number"
              value={impedanceOhms}
              onChange={(e) => setImpedanceOhms(parseFloat(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-sunken/60 border-border/80 flex flex-col justify-between">
        <CardHeader>
          <CardTitle className="text-base">Résultat de Conversion</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-surface rounded-xl p-4 border border-border/60">
            <span className="text-subtle-foreground text-2xs font-semibold uppercase tracking-wider block">
              {mode === 'dbm_to_mw' ? 'Puissance en Milliwatts' : 'Puissance en dBm'}
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-4xl font-extrabold text-foreground tabular-nums">
                {mode === 'dbm_to_mw' ? result.powerMw : result.powerDbm}
              </span>
              <span className="text-muted-foreground text-sm font-semibold">
                {mode === 'dbm_to_mw' ? 'mW' : 'dBm'}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs border-t border-border/40 pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Puissance (dBm) :</span>
              <span className="font-mono font-medium text-foreground">{result.powerDbm} dBm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Puissance (mW) :</span>
              <span className="font-mono font-medium text-foreground">{result.powerMw} mW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Puissance (Watts) :</span>
              <span className="font-mono font-medium text-foreground">{result.powerWatts} W</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Tension RMS @ {impedanceOhms}Ω :</span>
              <span className="font-mono font-medium text-primary">{result.vrmsVolts} Vrms</span>
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full mt-4" onClick={handleCopy}>
            <Copy className="size-3.5 mr-1.5" />
            {copied ? 'Résultat copié !' : 'Copier la conversion'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
