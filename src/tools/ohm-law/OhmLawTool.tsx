import { Check, ChevronDown, Copy, HelpCircle, RefreshCw, RotateCcw, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

import { computeOhmLaw, type OhmLawResult } from './compute';
import type { CurrentUnit, ResistanceUnit, TargetVariable, VoltageUnit } from './schema';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

export default function OhmLawTool() {
  const [target, setTarget] = useState<TargetVariable>('U');

  const [voltage, setVoltage] = useState<string>('');
  const [voltageUnit, setVoltageUnit] = useState<VoltageUnit>('V');

  const [current, setCurrent] = useState<string>('2');
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit>('A');

  const [resistance, setResistance] = useState<string>('50');
  const [resistanceUnit, setResistanceUnit] = useState<ResistanceUnit>('Ω');

  const [copied, signalerCopied] = useEphemeralFlag();
  const [showDoc, setShowDoc] = useState<boolean>(false);

  // Exécution dynamique du calcul
  const result: OhmLawResult = useMemo(() => {
    return computeOhmLaw({
      target,
      voltage,
      voltageUnit,
      current,
      currentUnit,
      resistance,
      resistanceUnit,
    });
  }, [target, voltage, voltageUnit, current, currentUnit, resistance, resistanceUnit]);

  const handleReset = () => {
    setTarget('U');
    setVoltage('');
    setVoltageUnit('V');
    setCurrent('2');
    setCurrentUnit('A');
    setResistance('50');
    setResistanceUnit('Ω');
  };

  const handleClear = () => {
    setVoltage('');
    setCurrent('');
    setResistance('');
  };

  const handleCopy = () => {
    if (!result.success || !result.formattedValue) return;
    const text = `[LOI D'OHM] ${target} = ${result.formattedValue} (${result.formulaUsed}) -> ${result.explanation}`;
    void navigator.clipboard.writeText(text);
    signalerCopied();
  };

  return (
    <div className="space-y-3 max-w-3xl mx-auto text-xs">
      {/* Carte Principale Ultra-Compacte */}
      <Card className="border-border/80 shadow-modal overflow-hidden">
        {/* En-tête Compact */}
        <CardHeader className="p-3 bg-surface border-b border-border/40">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold">
              <Zap className="size-4 text-warning fill-warning/20" />
              Calculateur Loi d&apos;Ohm
            </CardTitle>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!result.success}
                className="h-7 px-2 text-2xs cursor-pointer"
                title="Copier le résultat"
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                <span className="hidden sm:inline ml-1">{copied ? 'Copié' : 'Copier'}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2 text-2xs text-muted-foreground hover:text-foreground cursor-pointer"
                title="Effacer les saisies"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline ml-1">Effacer</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 px-2 text-2xs text-muted-foreground hover:text-foreground cursor-pointer"
                title="Réinitialiser"
              >
                <RefreshCw className="size-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 space-y-3">
          {/* Barre de Sélection de la Cible (Formule) + Triangle Interactif Ultra-Compact */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-surface-sunken p-2 rounded-xl border border-border/60">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-muted-foreground shrink-0">
              Grandeur à calculer :
            </span>

            <div className="grid grid-cols-3 gap-1.5 flex-1">
              <button
                type="button"
                onClick={() => setTarget('U')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-mono ${
                  target === 'U'
                    ? 'bg-primary text-primary-foreground font-extrabold border-primary shadow-xs'
                    : 'bg-surface text-foreground border-border/40 hover:bg-surface-hover'
                }`}
              >
                <span className="text-xs font-bold">U = ? (V)</span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('I')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-mono ${
                  target === 'I'
                    ? 'bg-success text-success-foreground font-extrabold border-success shadow-xs'
                    : 'bg-surface text-foreground border-border/40 hover:bg-surface-hover'
                }`}
              >
                <span className="text-xs font-bold">I = ? (A)</span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('R')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-mono ${
                  target === 'R'
                    ? 'bg-warning text-warning-foreground font-extrabold border-warning shadow-xs'
                    : 'bg-surface text-foreground border-border/40 hover:bg-surface-hover'
                }`}
              >
                <span className="text-xs font-bold">R = ? (Ω)</span>
              </button>
            </div>
          </div>

          {/* Grille des 3 Champs (Tension, Intensité, Résistance) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Field U */}
            <div
              className={`p-2 rounded-xl border transition-all ${
                target === 'U'
                  ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border/60 bg-surface'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="input-u" className="text-2xs font-extrabold uppercase text-foreground">
                  Tension (U)
                </label>
                {target === 'U' && (
                  <Badge variant="primary" className="text-xs px-1 py-0 font-mono">
                    Cible
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  id="input-u"
                  type="text"
                  inputMode="decimal"
                  placeholder={target === 'U' ? 'Calculé' : 'ex: 230'}
                  value={target === 'U' && result.success ? result.formattedValue?.split(' ')[0] : voltage}
                  onChange={(e) => setVoltage(e.target.value)}
                  disabled={target === 'U'}
                  className="font-mono text-sm font-bold h-8 px-2 flex-1"
                />
                <select
                  value={voltageUnit}
                  onChange={(e) => setVoltageUnit(e.target.value as VoltageUnit)}
                  className="bg-surface-sunken border-border/60 text-foreground h-8 rounded-md border px-1.5 text-2xs font-mono font-bold outline-none cursor-pointer"
                >
                  <option value="mV">mV</option>
                  <option value="V">V</option>
                  <option value="kV">kV</option>
                </select>
              </div>
            </div>

            {/* Field I */}
            <div
              className={`p-2 rounded-xl border transition-all ${
                target === 'I'
                  ? 'border-success/60 bg-success/5 ring-1 ring-success/30'
                  : 'border-border/60 bg-surface'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="input-i" className="text-2xs font-extrabold uppercase text-foreground">
                  Intensité (I)
                </label>
                {target === 'I' && (
                  <Badge variant="primary" className="text-xs px-1 py-0 font-mono">
                    Cible
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  id="input-i"
                  type="text"
                  inputMode="decimal"
                  placeholder={target === 'I' ? 'Calculé' : 'ex: 2'}
                  value={target === 'I' && result.success ? result.formattedValue?.split(' ')[0] : current}
                  onChange={(e) => setCurrent(e.target.value)}
                  disabled={target === 'I'}
                  className="font-mono text-sm font-bold h-8 px-2 flex-1"
                />
                <select
                  value={currentUnit}
                  onChange={(e) => setCurrentUnit(e.target.value as CurrentUnit)}
                  className="bg-surface-sunken border-border/60 text-foreground h-8 rounded-md border px-1.5 text-2xs font-mono font-bold outline-none cursor-pointer"
                >
                  <option value="mA">mA</option>
                  <option value="A">A</option>
                  <option value="kA">kA</option>
                </select>
              </div>
            </div>

            {/* Field R */}
            <div
              className={`p-2 rounded-xl border transition-all ${
                target === 'R'
                  ? 'border-warning/60 bg-warning/5 ring-1 ring-warning/30'
                  : 'border-border/60 bg-surface'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="input-r" className="text-2xs font-extrabold uppercase text-foreground">
                  Résistance (R)
                </label>
                {target === 'R' && (
                  <Badge variant="primary" className="text-xs px-1 py-0 font-mono">
                    Cible
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  id="input-r"
                  type="text"
                  inputMode="decimal"
                  placeholder={target === 'R' ? 'Calculé' : 'ex: 50'}
                  value={target === 'R' && result.success ? result.formattedValue?.split(' ')[0] : resistance}
                  onChange={(e) => setResistance(e.target.value)}
                  disabled={target === 'R'}
                  className="font-mono text-sm font-bold h-8 px-2 flex-1"
                />
                <select
                  value={resistanceUnit}
                  onChange={(e) => setResistanceUnit(e.target.value as ResistanceUnit)}
                  className="bg-surface-sunken border-border/60 text-foreground h-8 rounded-md border px-1.5 text-2xs font-mono font-bold outline-none cursor-pointer"
                >
                  <option value="mΩ">mΩ</option>
                  <option value="Ω">Ω</option>
                  <option value="kΩ">kΩ</option>
                  <option value="MΩ">MΩ</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bandeau de Résultat / Message d'Erreur Integré */}
          <div>
            {result.success ? (
              <div className="bg-surface-sunken border border-primary/40 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-2xs text-muted-foreground uppercase font-bold">{result.formulaUsed} :</span>
                  <span className="text-base font-black text-primary">
                    {target} = {result.formattedValue}
                  </span>
                </div>

                <div className="text-2xs text-muted-foreground font-mono hidden md:block truncate">
                  {result.explanation}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 px-2 text-2xs shrink-0 cursor-pointer"
                >
                  {copied ? <Check className="size-3 text-success mr-1" /> : <Copy className="size-3 mr-1" />}
                  {copied ? 'Copié !' : 'Copier'}
                </Button>
              </div>
            ) : (
              <div className="bg-error/10 border border-error/30 rounded-xl p-2 text-2xs font-bold text-error flex items-center gap-2">
                <HelpCircle className="size-3.5 shrink-0" />
                <span>{result.error}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Triangle de la loi d'Ohm & Accordéon Pédagogique repliable */}
      <div className="bg-surface rounded-xl border border-border/70 p-3 space-y-2">
        <button
          type="button"
          onClick={() => setShowDoc((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs font-bold text-foreground cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <HelpCircle className="size-3.5 text-primary" />
            <span>Comprendre la loi d’Ohm &amp; Triangle de calcul</span>
          </div>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showDoc ? 'rotate-180' : ''}`} />
        </button>

        {showDoc && (
          <div className="pt-2 border-t border-border/40 grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in duration-200">
            {/* Triangle Micro Visuel */}
            <div className="bg-surface-sunken border border-border/60 rounded-xl p-2 flex flex-col items-center justify-center font-mono text-center">
              <span className="text-2xs font-bold text-muted-foreground uppercase mb-1">Triangle de la Loi d&apos;Ohm</span>
              <div className="w-28 bg-surface border border-border/80 rounded-lg p-1.5 space-y-1">
                <div className="bg-primary/10 border border-primary/40 text-primary font-black py-0.5 rounded text-xs">
                  U
                </div>
                <div className="h-0.5 bg-border/60" />
                <div className="grid grid-cols-2 gap-1 text-2xs font-bold">
                  <div className="bg-success/10 border border-success/40 text-success py-0.5 rounded">I</div>
                  <div className="bg-warning/10 border border-warning/40 text-warning py-0.5 rounded">R</div>
                </div>
              </div>
            </div>

            {/* Légende Pédagogique */}
            <div className="md:col-span-2 space-y-2 text-2xs text-muted-foreground">
              <div className="grid grid-cols-3 gap-1.5 text-foreground font-medium">
                <div className="bg-surface-sunken p-1.5 rounded border border-border/40">
                  <strong className="text-primary">U — Tension</strong> : Volt (V)
                </div>
                <div className="bg-surface-sunken p-1.5 rounded border border-border/40">
                  <strong className="text-success">I — Intensité</strong> : Ampère (A)
                </div>
                <div className="bg-surface-sunken p-1.5 rounded border border-border/40">
                  <strong className="text-warning">R — Résistance</strong> : Ohm (Ω)
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 font-mono text-2xs text-foreground bg-surface-sunken p-1.5 rounded border border-border/40">
                <span>Formules :</span>
                <span className="font-bold">U = R × I</span>
                <span className="font-bold">I = U / R</span>
                <span className="font-bold">R = U / I</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
