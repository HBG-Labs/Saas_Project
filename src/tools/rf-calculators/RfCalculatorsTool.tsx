import { Radio, Copy, CheckCircle2, Waves, Activity, ShieldAlert, Zap, Compass, Ruler, Flame, ArrowRightLeft } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

import {
  calcWavelength,
  calcFspl,
  calcAttenuator,
  calcLinkBudget,
  calcLcResonance,
  calcSwr,
  calcRhoFromSwr,
  calcReturnLoss,
  calcMismatchLoss,
  calcRadiatedPowerVsSwr,
  calcTransmissionLine,
  calcEirpErp,
  calcFresnelZone,
} from './compute';

type ModuleId =
  | 'wavelength'
  | 'fspl'
  | 'attenuator'
  | 'link_budget'
  | 'resonance'
  | 'swr'
  | 'rho'
  | 'return_loss'
  | 'mismatch'
  | 'radiated_power'
  | 'transmission_line'
  | 'eirp'
  | 'fresnel';

export default function RfCalculatorsTool() {
  const [activeModule, setActiveModule] = useState<ModuleId>('wavelength');
  const [copied, signalerCopied] = useEphemeralFlag();

  // 1. Longueur d'onde
  const [freqMhz, setFreqMhz] = useState(2400);
  const [vf, setVf] = useState(1.0);

  // 2. FSPL
  const [fsplDistKm, setFsplDistKm] = useState(10);
  const [fsplFreqMhz, setFsplFreqMhz] = useState(2400);

  // 3. Atténuateur
  const [attDb, setAttDb] = useState(6);
  const [attZ0, setAttZ0] = useState(50);

  // 4. Budget Lien
  const [lbTxDbm, setLbTxDbm] = useState(20);
  const [lbGtxDbi, setLbGtxDbi] = useState(14);
  const [lbLtxDb, setLbLtxDb] = useState(2);
  const [lbFsplDb, setLbFsplDb] = useState(120);
  const [lbGrxDbi, setLbGrxDbi] = useState(14);
  const [lbLrxDb, setLbLrxDb] = useState(2);
  const [lbSensDbm, setLbSensDbm] = useState(-92);

  // 5. Résonance LC
  const [lMicroH, setLMicroH] = useState(10);
  const [cPicoF, setCPicoF] = useState(100);

  // 6. ROS / SWR
  const [pFwdWatts, setPFwdWatts] = useState(10);
  const [pRevWatts, setPRevWatts] = useState(1);

  // 7. Rho
  const [swrInput, setSwrInput] = useState(1.5);

  // 8. Return Loss
  const [rhoInput, setRhoInput] = useState(0.2);

  // 9. Mismatch Loss
  const [rhoMismatch, setRhoMismatch] = useState(0.2);

  // 10. Puissance rayonnée vs ROS
  const [pRadWatts, setPRadWatts] = useState(50);
  const [radSwr, setRadSwr] = useState(1.5);

  // 11. Ligne de transmission
  const [txDbm, setTxDbm] = useState(30);
  const [lineLenM, setLineLenM] = useState(20);
  const [lineLossDbM, setLineLossDbM] = useState(0.15);

  // 12. EIRP / ERP
  const [eirpTxDbm, setEirpTxDbm] = useState(23);
  const [eirpLossDb, setEirpLossDb] = useState(1.5);
  const [eirpGainDbi, setEirpGainDbi] = useState(12);

  // 13. Zone de Fresnel
  const [fresnelD1Km, setFresnelD1Km] = useState(5);
  const [fresnelD2Km, setFresnelD2Km] = useState(5);
  const [fresnelFreqGhz, setFresnelFreqGhz] = useState(5.8);

  // Calculs
  const resWavelength = calcWavelength(freqMhz * 1e6, vf);
  const resFspl = calcFspl(fsplDistKm, fsplFreqMhz);
  const resAtt = calcAttenuator(attDb, attZ0);
  const resLink = calcLinkBudget(lbTxDbm, lbGtxDbi, lbLtxDb, lbFsplDb, lbGrxDbi, lbLrxDb, lbSensDbm);
  const resLc = calcLcResonance(lMicroH * 1e-6, cPicoF * 1e-12);
  const resSwr = calcSwr(pFwdWatts, pRevWatts);
  const resRho = calcRhoFromSwr(swrInput);
  const resRl = calcReturnLoss(rhoInput);
  const resMismatch = calcMismatchLoss(rhoMismatch);
  const resRadiated = calcRadiatedPowerVsSwr(pRadWatts, radSwr);
  const resLine = calcTransmissionLine(txDbm, lineLenM, lineLossDbM);
  const resEirp = calcEirpErp(eirpTxDbm, eirpLossDb, eirpGainDbi);
  const resFresnel = calcFresnelZone(fresnelD1Km, fresnelD2Km, fresnelFreqGhz);

  const modules = [
    { id: 'wavelength' as ModuleId, title: "Longueur d'onde", sub: '(lambda)', icon: Waves },
    { id: 'fspl' as ModuleId, title: 'Perte de trajet en espace libre', sub: '(perte, distance)', icon: Radio },
    { id: 'attenuator' as ModuleId, title: 'Atténuateurs', sub: '(pi, tee)', icon: ArrowRightLeft },
    { id: 'link_budget' as ModuleId, title: 'Budget lien', sub: '(RSSI, marge de fondu)', icon: Activity },
    { id: 'resonance' as ModuleId, title: 'Résonance', sub: '(f, C, L)', icon: Zap },
    { id: 'swr' as ModuleId, title: 'ROS', sub: "(rapport d'ondes stationnaires)", icon: ShieldAlert },
    { id: 'rho' as ModuleId, title: 'Coefficient de réflexion', sub: '(Rho)', icon: Compass },
    { id: 'return_loss' as ModuleId, title: 'Perte de retour', sub: '(dB)', icon: Activity },
    { id: 'mismatch' as ModuleId, title: 'perte mismatch', sub: '(dB)', icon: ArrowRightLeft },
    { id: 'radiated_power' as ModuleId, title: 'puissance rayonnée', sub: '(vs ROS)', icon: Flame },
    { id: 'transmission_line' as ModuleId, title: 'Ligne de transmission', sub: '(Tx, Att, Pout)', icon: Zap },
    { id: 'eirp' as ModuleId, title: 'EIRP | ERP', sub: '(puissance rayonnée)', icon: Radio },
    { id: 'fresnel' as ModuleId, title: 'Zone de Fresnel', sub: '(1er, au maximum, 60%, Er)', icon: Ruler },
  ];

  const handleCopy = () => {
    let summary = '';
    if (activeModule === 'wavelength') summary = `Longueur d'onde à ${freqMhz} MHz = ${resWavelength.lambdaMeters} m (${resWavelength.lambdaCm} cm)`;
    else if (activeModule === 'fspl') summary = `FSPL à ${fsplDistKm} km @ ${fsplFreqMhz} MHz = ${resFspl.fsplDb} dB`;
    else if (activeModule === 'attenuator') summary = `Atténuateur ${attDb} dB @ ${attZ0}Ω | Pi: R1=${resAtt.piR1}Ω, R2=${resAtt.piR2}Ω | Tee: R1=${resAtt.teeR1}Ω, R2=${resAtt.teeR2}Ω`;
    else if (activeModule === 'link_budget') summary = `Bilan de liaison | RSSI: ${resLink.rssiDbm} dBm | Marge de fondu: ${resLink.fadeMarginDb} dB`;
    else if (activeModule === 'resonance') summary = `Résonance LC (${lMicroH}µH, ${cPicoF}pF) = ${resLc.freqMhz} MHz (X_L = ${resLc.reactanceOhms} Ω)`;
    else if (activeModule === 'swr') summary = `ROS / SWR: ${resSwr.swr}:1 (Rho = ${resSwr.rho}, RL = ${resSwr.returnLossDb} dB)`;
    else if (activeModule === 'rho') summary = `SWR ${swrInput} -> Rho = ${resRho.rho} (${resRho.reflectedPowerPercent}% réfléchi)`;
    else if (activeModule === 'return_loss') summary = `Rho ${rhoInput} -> Return Loss = ${resRl.returnLossDb} dB (SWR = ${resRl.swr}:1)`;
    else if (activeModule === 'mismatch') summary = `Rho ${rhoMismatch} -> Mismatch Loss = ${resMismatch.mismatchLossDb} dB (${resMismatch.transmittedPercent}% transmis)`;
    else if (activeModule === 'radiated_power') summary = `Puissance ${pRadWatts}W @ SWR ${radSwr} -> Puissance rayonnée: ${resRadiated.pRadiatedWatts} W (${resRadiated.efficiencyPercent}%)`;
    else if (activeModule === 'transmission_line') summary = `Ligne ${lineLenM}m -> Pertes: ${resLine.totalCableLossDb} dB | Pout: ${resLine.pOutDbm} dBm (${resLine.pOutMw} mW)`;
    else if (activeModule === 'eirp') summary = `EIRP: ${resEirp.eirpDbm} dBm (${resEirp.eirpWatts} W) | ERP: ${resEirp.erpDbm} dBm (${resEirp.erpWatts} W)`;
    else summary = `Zone de Fresnel @ ${fresnelD1Km}+${fresnelD2Km} km (${fresnelFreqGhz} GHz) -> r1 = ${resFresnel.r1Meters} m (Clairance 60%: ${resFresnel.clearance60PercentMeters} m)`;

    void navigator.clipboard.writeText(summary);
    signalerCopied();
  };

  return (
    <div className="space-y-6">
      {/* 13 Cartes de Sélection Compactes (Style Cartes Réduites) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {modules.map((m) => {
          const Icon = m.icon;
          const isActive = activeModule === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                isActive
                  ? 'border-primary bg-primary/10 shadow-md text-foreground'
                  : 'border-border/70 bg-surface hover:border-border-strong text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`size-4 mb-1 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-bold leading-tight text-foreground line-clamp-1">{m.title}</span>
              <span className="text-xs font-mono text-primary font-semibold mt-0.5 truncate w-full">{m.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Zone Interactive de Saisie et Résultat */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="size-5 text-primary" />
              Saisie des Paramètres — {modules.find((m) => m.id === activeModule)?.title}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 1. Longueur d'onde */}
            {activeModule === 'wavelength' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Fréquence (MHz)" type="number" value={freqMhz} onChange={(e) => setFreqMhz(parseFloat(e.target.value) || 1)} />
                <Input label="Facteur de vélocité (Vf 0.1 - 1.0)" type="number" step="0.01" value={vf} onChange={(e) => setVf(parseFloat(e.target.value) || 1)} />
              </div>
            )}

            {/* 2. FSPL */}
            {activeModule === 'fspl' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Distance (km)" type="number" step="0.1" value={fsplDistKm} onChange={(e) => setFsplDistKm(parseFloat(e.target.value) || 0.1)} />
                <Input label="Fréquence (MHz)" type="number" value={fsplFreqMhz} onChange={(e) => setFsplFreqMhz(parseFloat(e.target.value) || 1)} />
              </div>
            )}

            {/* 3. Atténuateurs */}
            {activeModule === 'attenuator' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Atténuation visée (dB)" type="number" step="0.1" value={attDb} onChange={(e) => setAttDb(parseFloat(e.target.value) || 1)} />
                <Input label="Impédance (Ω)" type="number" value={attZ0} onChange={(e) => setAttZ0(parseFloat(e.target.value) || 50)} />
              </div>
            )}

            {/* 4. Budget Lien */}
            {activeModule === 'link_budget' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Puissance P_tx (dBm)" type="number" value={lbTxDbm} onChange={(e) => setLbTxDbm(parseFloat(e.target.value) || 0)} />
                <Input label="Gain Antenne Tx (dBi)" type="number" value={lbGtxDbi} onChange={(e) => setLbGtxDbi(parseFloat(e.target.value) || 0)} />
                <Input label="Pertes Câble Tx (dB)" type="number" value={lbLtxDb} onChange={(e) => setLbLtxDb(parseFloat(e.target.value) || 0)} />
                <Input label="Perte FSPL (dB)" type="number" value={lbFsplDb} onChange={(e) => setLbFsplDb(parseFloat(e.target.value) || 0)} />
                <Input label="Gain Antenne Rx (dBi)" type="number" value={lbGrxDbi} onChange={(e) => setLbGrxDbi(parseFloat(e.target.value) || 0)} />
                <Input label="Pertes Câble Rx (dB)" type="number" value={lbLrxDb} onChange={(e) => setLbLrxDb(parseFloat(e.target.value) || 0)} />
                <Input label="Sensibilité Rx (dBm)" type="number" value={lbSensDbm} onChange={(e) => setLbSensDbm(parseFloat(e.target.value) || -90)} />
              </div>
            )}

            {/* 5. Résonance LC */}
            {activeModule === 'resonance' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Inductance L (µH)" type="number" step="0.1" value={lMicroH} onChange={(e) => setLMicroH(parseFloat(e.target.value) || 0.1)} />
                <Input label="Capacité C (pF)" type="number" step="1" value={cPicoF} onChange={(e) => setCPicoF(parseFloat(e.target.value) || 1)} />
              </div>
            )}

            {/* 6. ROS / SWR */}
            {activeModule === 'swr' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Puissance directe (Watts)" type="number" value={pFwdWatts} onChange={(e) => setPFwdWatts(parseFloat(e.target.value) || 0)} />
                <Input label="Puissance réfléchie (Watts)" type="number" value={pRevWatts} onChange={(e) => setPRevWatts(parseFloat(e.target.value) || 0)} />
              </div>
            )}

            {/* 7. Rho */}
            {activeModule === 'rho' && (
              <Input label="ROS / SWR mesuré (ex: 1.5)" type="number" step="0.05" value={swrInput} onChange={(e) => setSwrInput(parseFloat(e.target.value) || 1)} />
            )}

            {/* 8. Return Loss */}
            {activeModule === 'return_loss' && (
              <Input label="Coefficient de réflexion Rho (|Γ| 0.0 à 1.0)" type="number" step="0.01" value={rhoInput} onChange={(e) => setRhoInput(parseFloat(e.target.value) || 0)} />
            )}

            {/* 9. Mismatch Loss */}
            {activeModule === 'mismatch' && (
              <Input label="Coefficient de réflexion Rho (|Γ| 0.0 à 1.0)" type="number" step="0.01" value={rhoMismatch} onChange={(e) => setRhoMismatch(parseFloat(e.target.value) || 0)} />
            )}

            {/* 10. Puissance rayonnée vs ROS */}
            {activeModule === 'radiated_power' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Puissance émise P_fwd (Watts)" type="number" value={pRadWatts} onChange={(e) => setPRadWatts(parseFloat(e.target.value) || 0)} />
                <Input label="SWR de l'antenne" type="number" step="0.1" value={radSwr} onChange={(e) => setRadSwr(parseFloat(e.target.value) || 1)} />
              </div>
            )}

            {/* 11. Ligne de transmission */}
            {activeModule === 'transmission_line' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Puissance Tx (dBm)" type="number" value={txDbm} onChange={(e) => setTxDbm(parseFloat(e.target.value) || 0)} />
                <Input label="Longueur câble (mètres)" type="number" value={lineLenM} onChange={(e) => setLineLenM(parseFloat(e.target.value) || 0)} />
                <Input label="Perte linéique (dB/m)" type="number" step="0.01" value={lineLossDbM} onChange={(e) => setLineLossDbM(parseFloat(e.target.value) || 0)} />
              </div>
            )}

            {/* 12. EIRP / ERP */}
            {activeModule === 'eirp' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Puissance Tx (dBm)" type="number" value={eirpTxDbm} onChange={(e) => setEirpTxDbm(parseFloat(e.target.value) || 0)} />
                <Input label="Perte câble (dB)" type="number" value={eirpLossDb} onChange={(e) => setEirpLossDb(parseFloat(e.target.value) || 0)} />
                <Input label="Gain antenne (dBi)" type="number" value={eirpGainDbi} onChange={(e) => setEirpGainDbi(parseFloat(e.target.value) || 0)} />
              </div>
            )}

            {/* 13. Zone de Fresnel */}
            {activeModule === 'fresnel' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Distance Tx - Obstacle d1 (km)" type="number" step="0.1" value={fresnelD1Km} onChange={(e) => setFresnelD1Km(parseFloat(e.target.value) || 0.1)} />
                <Input label="Distance Obstacle - Rx d2 (km)" type="number" step="0.1" value={fresnelD2Km} onChange={(e) => setFresnelD2Km(parseFloat(e.target.value) || 0.1)} />
                <Input label="Fréquence (GHz)" type="number" step="0.1" value={fresnelFreqGhz} onChange={(e) => setFresnelFreqGhz(parseFloat(e.target.value) || 0.1)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Résultat Calculateur */}
        <Card className="bg-surface-sunken/60 border-border/80 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base">Résultats de Calcul</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeModule === 'wavelength' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Longueur d&apos;onde λ :</span>
                  <span className="font-mono font-bold text-primary">{resWavelength.lambdaMeters} m</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Longueur en cm :</span>
                  <span className="font-mono font-bold text-foreground">{resWavelength.lambdaCm} cm</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Demi-onde (λ/2) :</span>
                  <span className="font-mono font-bold text-foreground">{resWavelength.halfLambdaMeters} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quart d&apos;onde (λ/4) :</span>
                  <span className="font-mono font-bold text-foreground">{resWavelength.quarterLambdaMeters} m</span>
                </div>
              </div>
            )}

            {activeModule === 'fspl' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Perte Espace Libre FSPL :</span>
                  <span className="font-mono text-xl font-extrabold text-primary">{resFspl.fsplDb} dB</span>
                </div>
              </div>
            )}

            {activeModule === 'attenuator' && (
              <div className="space-y-3 text-xs">
                <div className="font-bold text-foreground">Atténuateur Schéma Π (Pi) :</div>
                <div className="flex justify-between border-b border-border/40 pb-1.5">
                  <span className="text-muted-foreground">R1 (Parallèle) :</span>
                  <span className="font-mono font-bold text-primary">{resAtt.piR1} Ω</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-1.5">
                  <span className="text-muted-foreground">R2 (Série) :</span>
                  <span className="font-mono font-bold text-foreground">{resAtt.piR2} Ω</span>
                </div>
                <div className="font-bold text-foreground pt-2">Atténuateur Schéma T (Tee) :</div>
                <div className="flex justify-between border-b border-border/40 pb-1.5">
                  <span className="text-muted-foreground">R1 (Série) :</span>
                  <span className="font-mono font-bold text-primary">{resAtt.teeR1} Ω</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">R2 (Parallèle) :</span>
                  <span className="font-mono font-bold text-foreground">{resAtt.teeR2} Ω</span>
                </div>
              </div>
            )}

            {activeModule === 'link_budget' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Puissance Reçue (RSSI) :</span>
                  <span className="font-mono font-bold text-primary">{resLink.rssiDbm} dBm</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Marge de Fondu :</span>
                  <span className="font-mono font-bold text-foreground">{resLink.fadeMarginDb} dB</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold pt-1">
                  <CheckCircle2 className={`size-4 ${resLink.isLinkViable ? 'text-success' : 'text-warning'}`} />
                  <span>{resLink.isLinkViable ? 'Liaison Radio Viable (Marge ≥ 10dB)' : 'Attention : Marge insuffisante'}</span>
                </div>
              </div>
            )}

            {activeModule === 'resonance' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Fréquence de résonance f0 :</span>
                  <span className="font-mono text-lg font-bold text-primary">{resLc.freqMhz} MHz</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Réactance X_L = X_C :</span>
                  <span className="font-mono font-bold text-foreground">{resLc.reactanceOhms} Ω</span>
                </div>
              </div>
            )}

            {activeModule === 'swr' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">ROS / SWR :</span>
                  <span className="font-mono text-xl font-extrabold text-primary">{resSwr.swr} : 1</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Coefficient Rho (|Γ|) :</span>
                  <span className="font-mono font-bold text-foreground">{resSwr.rho}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Perte de Retour (Return Loss) :</span>
                  <span className="font-mono font-bold text-foreground">{resSwr.returnLossDb} dB</span>
                </div>
              </div>
            )}

            {activeModule === 'rho' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Coefficient Rho (|Γ|) :</span>
                  <span className="font-mono text-lg font-bold text-primary">{resRho.rho}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Puissance Réfléchie :</span>
                  <span className="font-mono font-bold text-foreground">{resRho.reflectedPowerPercent} %</span>
                </div>
              </div>
            )}

            {activeModule === 'return_loss' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Perte de retour (Return Loss) :</span>
                  <span className="font-mono text-lg font-bold text-primary">{resRl.returnLossDb} dB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROS / SWR équivalent :</span>
                  <span className="font-mono font-bold text-foreground">{resRl.swr} : 1</span>
                </div>
              </div>
            )}

            {activeModule === 'mismatch' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Perte Mismatch (Désadaptation) :</span>
                  <span className="font-mono text-lg font-bold text-primary">{resMismatch.mismatchLossDb} dB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Puissance transmise :</span>
                  <span className="font-mono font-bold text-foreground">{resMismatch.transmittedPercent} %</span>
                </div>
              </div>
            )}

            {activeModule === 'radiated_power' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Puissance Efficace Rayonnée :</span>
                  <span className="font-mono text-lg font-bold text-primary">{resRadiated.pRadiatedWatts} W</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Puissance Perdue (Réfléchie) :</span>
                  <span className="font-mono font-bold text-foreground">{resRadiated.pLostWatts} W</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rendement de transfert :</span>
                  <span className="font-mono font-bold text-foreground">{resRadiated.efficiencyPercent} %</span>
                </div>
              </div>
            )}

            {activeModule === 'transmission_line' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Pertes totales câble :</span>
                  <span className="font-mono font-bold text-primary">{resLine.totalCableLossDb} dB</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Puissance de sortie (Pout) :</span>
                  <span className="font-mono font-bold text-foreground">{resLine.pOutDbm} dBm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Puissance en mW :</span>
                  <span className="font-mono font-bold text-foreground">{resLine.pOutMw} mW</span>
                </div>
              </div>
            )}

            {activeModule === 'eirp' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">PIRE / EIRP :</span>
                  <span className="font-mono text-base font-bold text-primary">{resEirp.eirpDbm} dBm ({resEirp.eirpWatts} W)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PAR / ERP :</span>
                  <span className="font-mono font-base font-bold text-foreground">{resEirp.erpDbm} dBm ({resEirp.erpWatts} W)</span>
                </div>
              </div>
            )}

            {activeModule === 'fresnel' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Rayon 1ère Zone de Fresnel (r1) :</span>
                  <span className="font-mono text-base font-bold text-primary">{resFresnel.r1Meters} m</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Clairance Minimale (60% r1) :</span>
                  <span className="font-mono font-bold text-foreground">{resFresnel.clearance60PercentMeters} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance Totale du lien :</span>
                  <span className="font-mono font-bold text-foreground">{resFresnel.dTotalKm} km</span>
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full mt-4" onClick={handleCopy}>
              <Copy className="size-3.5 mr-1.5" />
              {copied ? 'Résultat copié !' : 'Copier les résultats'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
