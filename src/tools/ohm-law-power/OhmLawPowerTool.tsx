import { Copy, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

import { computeOhmLawPower } from './compute';
import type { OhmLawPowerInputs } from './schema';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

export default function OhmLawPowerTool() {
  const [phaseType, setPhaseType] = useState<'single' | 'three'>('single');
  const [voltageVolts, setVoltageVolts] = useState(230);
  const [currentAmps, setCurrentAmps] = useState(16);
  const [cosPhi, setCosPhi] = useState(0.9);
  const [cableLengthMeters, setCableLengthMeters] = useState(25);
  const [cableSectionMm2, setCableSectionMm2] = useState(2.5);
  const [copied, signalerCopied] = useEphemeralFlag();

  /**
   * L'objet est construit DANS le `useMemo`, pas à côté.
   *
   * Un littéral déclaré à l'extérieur est recréé à chaque rendu : sa référence
   * change toujours, la dépendance n'est jamais satisfaite, et la mémoïsation
   * ne sert à rien tout en donnant l'illusion d'exister. Les valeurs primitives
   * en dépendance, elles, se comparent réellement.
   */
  const result = useMemo(() => {
    const inputs: OhmLawPowerInputs = {
      phaseType,
      voltageVolts: Number(voltageVolts) || 230,
      currentAmps: Number(currentAmps) || 0.1,
      cosPhi: Number(cosPhi) || 0.9,
      cableLengthMeters: Number(cableLengthMeters) || 1,
      cableSectionMm2: Number(cableSectionMm2) || 2.5,
    };

    return computeOhmLawPower(inputs);
  }, [phaseType, voltageVolts, currentAmps, cosPhi, cableLengthMeters, cableSectionMm2]);

  const handleCopy = () => {
    const summary = `Puissance électrique (${phaseType === 'three' ? 'Triphasé 400V' : 'Monophasé 230V'}) : ${result.activePowerKw} kW (${result.apparentPowerKva} kVA) | Courant: ${currentAmps} A | Chute de tension: ${result.voltageDropPercent} %`;
    void navigator.clipboard.writeText(summary);
    signalerCopied();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-5 text-warning" />
            Paramètres électriques & Dimensionnement câble (NF C 15-100 / UTE)
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span
                id="ohm-network-label"
                className="text-foreground text-xs font-semibold block mb-1.5"
              >
                Réseau électrique
              </span>
              <div role="group" aria-labelledby="ohm-network-label" className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={phaseType === 'single' ? 'primary' : 'outline'}
                  onClick={() => {
                    setPhaseType('single');
                    setVoltageVolts(230);
                  }}
                  className="w-full text-xs"
                >
                  Monophasé 230V
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={phaseType === 'three' ? 'primary' : 'outline'}
                  onClick={() => {
                    setPhaseType('three');
                    setVoltageVolts(400);
                  }}
                  className="w-full text-xs"
                >
                  Triphasé 400V
                </Button>
              </div>
            </div>

            <Input
              label="Tension efficace (V)"
              type="number"
              value={voltageVolts}
              onChange={(e) => setVoltageVolts(parseFloat(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Courant d'emploi I (A)"
              type="number"
              step="0.5"
              value={currentAmps}
              onChange={(e) => setCurrentAmps(parseFloat(e.target.value))}
            />
            <Input
              label="Facteur de puissance cos(φ)"
              type="number"
              step="0.05"
              value={cosPhi}
              onChange={(e) => setCosPhi(parseFloat(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Longueur du câble (mètres)"
              type="number"
              value={cableLengthMeters}
              onChange={(e) => setCableLengthMeters(parseFloat(e.target.value))}
            />
            <div>
              <label
                htmlFor="ohm-cable-section"
                className="text-foreground text-xs font-semibold block mb-1.5"
              >
                Section cuivre (mm²)
              </label>
              <select
                id="ohm-cable-section"
                value={cableSectionMm2}
                onChange={(e) => setCableSectionMm2(parseFloat(e.target.value))}
                className="bg-surface border-border/80 text-foreground h-9 w-full rounded-md border px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-ring"
              >
                {[1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300].map((sec) => (
                  <option key={sec} value={sec}>
                    {sec} mm²
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-sunken/60 border-border/80 flex flex-col justify-between">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bilan de Puissance</CardTitle>
            <Badge variant={result.isVoltageDropCompliant ? 'success' : 'warning'} className="gap-1 text-2xs">
              {result.isVoltageDropCompliant ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
              ΔU : {result.voltageDropPercent} %
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-surface rounded-xl p-4 border border-border/60">
            <span className="text-subtle-foreground text-2xs font-semibold uppercase tracking-wider block">
              Puissance active P
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-4xl font-extrabold text-foreground tabular-nums">
                {result.activePowerKw}
              </span>
              <span className="text-muted-foreground text-sm font-semibold">kW</span>
            </div>
          </div>

          <div className="space-y-2 text-xs border-t border-border/40 pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Puissance apparente S :</span>
              <span className="font-mono font-medium text-foreground">{result.apparentPowerKva} kVA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Puissance réactive Q :</span>
              <span className="font-mono font-medium text-foreground">{result.reactivePowerKvar} kvar</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Chute de tension (V) :</span>
              <span className="font-mono font-medium text-foreground">{result.voltageDropVolts} V</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chute de tension (%) :</span>
              <span className={`font-mono font-medium ${result.isVoltageDropCompliant ? 'text-success' : 'text-warning'}`}>
                {result.voltageDropPercent} % ({result.isVoltageDropCompliant ? '< 5% NF C 15-100' : '> 5% limite'})
              </span>
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full mt-4" onClick={handleCopy}>
            <Copy className="size-3.5 mr-1.5" />
            {copied ? 'Résultat copié !' : 'Copier le bilan électrique'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
