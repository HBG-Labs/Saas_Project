import { Cable, CheckCircle2, Copy, AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

import { computeFiberAttenuation } from './compute';
import type { FiberAttenuationInputs } from './schema';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

export default function FiberAttenuationTool() {
  const [wavelength, setWavelength] = useState<'1310' | '1550'>('1310');
  const [distanceKm, setDistanceKm] = useState(12.5);
  const [splicesCount, setSplicesCount] = useState(6);
  const [spliceLossDb, setSpliceLossDb] = useState(0.05);
  const [connectorsCount, setConnectorsCount] = useState(4);
  const [connectorLossDb, setConnectorLossDb] = useState(0.5);
  const [safetyMarginDb, setSafetyMarginDb] = useState(1.5);
  const [copied, signalerCopied] = useEphemeralFlag();

  const result = useMemo(() => {
    const inputs: FiberAttenuationInputs = {
      wavelength,
      distanceKm: Number(distanceKm) || 0,
      splicesCount: Number(splicesCount) || 0,
      spliceLossDb: Number(spliceLossDb) || 0,
      connectorsCount: Number(connectorsCount) || 0,
      connectorLossDb: Number(connectorLossDb) || 0,
      safetyMarginDb: Number(safetyMarginDb) || 0,
    };
    return computeFiberAttenuation(inputs);
  }, [wavelength, distanceKm, splicesCount, spliceLossDb, connectorsCount, connectorLossDb, safetyMarginDb]);

  const handleCopy = () => {
    const summary = `Atténuation totale liaison optique (${wavelength} nm, ${distanceKm} km) : -${result.totalWithMarginDb} dB (${result.statusLabel})`;
    void navigator.clipboard.writeText(summary);
    signalerCopied();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Panneau de Saisie (Formulaire) */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cable className="size-5 text-primary" />
            Paramètres de la liaison optique (FTTH / Monomode)
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span
                id="fiber-attenuation-wavelength-label"
                className="text-foreground text-xs font-semibold block mb-1.5"
              >
                Longueur d&apos;onde (nm)
              </span>
              <div
                role="group"
                aria-labelledby="fiber-attenuation-wavelength-label"
                className="flex gap-2"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={wavelength === '1310' ? 'primary' : 'outline'}
                  onClick={() => setWavelength('1310')}
                  className="w-full"
                >
                  1310 nm (0.35 dB/km)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={wavelength === '1550' ? 'primary' : 'outline'}
                  onClick={() => setWavelength('1550')}
                  className="w-full"
                >
                  1550 nm (0.21 dB/km)
                </Button>
              </div>
            </div>

            <Input
              label="Distance totale (km)"
              type="number"
              step="0.1"
              value={distanceKm}
              onChange={(e) => setDistanceKm(parseFloat(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre d'épissures fusion"
              type="number"
              value={splicesCount}
              onChange={(e) => setSplicesCount(parseInt(e.target.value, 10))}
            />
            <Input
              label="Perte par épissure (dB)"
              type="number"
              step="0.01"
              value={spliceLossDb}
              onChange={(e) => setSpliceLossDb(parseFloat(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre de connecteurs SC/APC"
              type="number"
              value={connectorsCount}
              onChange={(e) => setConnectorsCount(parseInt(e.target.value, 10))}
            />
            <Input
              label="Perte par connecteur (dB)"
              type="number"
              step="0.1"
              value={connectorLossDb}
              onChange={(e) => setConnectorLossDb(parseFloat(e.target.value))}
            />
          </div>

          <Input
            label="Marge de sécurité d'exploitation (dB)"
            type="number"
            step="0.5"
            value={safetyMarginDb}
            onChange={(e) => setSafetyMarginDb(parseFloat(e.target.value))}
          />
        </CardContent>
      </Card>

      {/* Panneau de Résultats Tabulaires */}
      <Card className="bg-surface-sunken/60 border-border/80 flex flex-col justify-between">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bilan d&apos;Atténuation</CardTitle>
            <Badge variant={result.isCompliant ? 'success' : 'error'} className="gap-1 text-2xs">
              {result.isCompliant ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
              {result.isCompliant ? 'Conforme' : 'Non conforme'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-surface rounded-xl p-4 border border-border/60">
            <span className="text-subtle-foreground text-2xs font-semibold uppercase tracking-wider block">
              Atténuation totale mesurée
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-4xl font-extrabold text-foreground tabular-nums">
                −{result.totalWithMarginDb}
              </span>
              <span className="text-muted-foreground text-sm font-semibold">dB</span>
            </div>
            <p className="text-subtle-foreground text-2xs mt-2">
              Dont marge de sécurité : <span className="font-mono text-foreground font-medium">+{safetyMarginDb} dB</span>
            </p>
          </div>

          <div className="space-y-2 text-xs border-t border-border/40 pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perte fibre ({distanceKm} km) :</span>
              <span className="font-mono font-medium text-foreground">−{result.fiberLossDb} dB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perte épissures ({splicesCount}x) :</span>
              <span className="font-mono font-medium text-foreground">−{result.splicesLossDb} dB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perte connecteurs ({connectorsCount}x) :</span>
              <span className="font-mono font-medium text-foreground">−{result.connectorsLossDb} dB</span>
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full mt-4" onClick={handleCopy}>
            <Copy className="size-3.5 mr-1.5" />
            {copied ? 'Résultat copié !' : 'Copier le bilan d’atténuation'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
