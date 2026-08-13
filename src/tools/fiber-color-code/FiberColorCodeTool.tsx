import { Cable, Copy, Layers, Palette, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

import {
  computeFiberMapping,
  computeFiberNumberFromTube,
  getPaletteByStandard,
  getStandardName,
} from './compute';
import { CAPACITIES_MODULO_6, CAPACITIES_MODULO_12 } from './schema';
import type { CableCapacity, ColorStandard, ModuleType } from './schema';

export default function FiberColorCodeTool() {
  const [standard, setStandard] = useState<ColorStandard>('orange_ft');
  const [moduleType, setModuleType] = useState<ModuleType>(12);
  const [capacity, setCapacity] = useState<CableCapacity>(144);
  const [fiberNumber, setFiberNumber] = useState(47);
  const [searchMode, setSearchMode] = useState<'number' | 'reverse'>('number');

  // État pour recherche inverse
  const [reverseTube, setReverseTube] = useState(4);
  const [reverseFiber, setReverseFiber] = useState(11);

  const [copied, setCopied] = useState(false);

  // Capacités selon le modulo sélectionné
  const availableCapacities = useMemo(() => {
    return moduleType === 6 ? CAPACITIES_MODULO_6 : CAPACITIES_MODULO_12;
  }, [moduleType]);

  // Calcul dynamique du repérage
  const mapping = useMemo(() => {
    let targetNum = fiberNumber;
    if (searchMode === 'reverse') {
      targetNum = computeFiberNumberFromTube(reverseTube, reverseFiber, moduleType);
    }
    const clampedNum = Math.max(1, Math.min(targetNum, capacity));
    return computeFiberMapping({
      fiberNumber: clampedNum,
      standard,
      capacity,
      moduleType,
    });
  }, [fiberNumber, standard, capacity, moduleType, searchMode, reverseTube, reverseFiber]);

  const palette = useMemo(() => getPaletteByStandard(standard), [standard]);

  const handleCopyFiche = () => {
    const text = `[FICHE DE CÂBLAGE FIBRE]
Fibre N°${mapping.fiberNumber} / ${mapping.capacity} FO (Norme: ${mapping.standardName} - Modulo ${mapping.moduleType})
----------------------------------------
- Tube N°${mapping.tubeNumber} : ${mapping.tubeColor.name} (${mapping.tubeColor.code}) ${mapping.ringAnnotation ? `[${mapping.ringAnnotation}]` : ''}
- Position dans le tube : N°${mapping.fiberIndexInTube} / ${mapping.fibersPerTube}
- Couleur Fibre : ${mapping.fiberColor.name} (${mapping.fiberColor.code})
----------------------------------------`;

    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectColorInTube = (positionIndex: number) => {
    const newNum = (mapping.tubeNumber - 1) * moduleType + positionIndex;
    const clamped = Math.max(1, Math.min(newNum, capacity));
    setFiberNumber(clamped);
    if (searchMode === 'reverse') {
      setReverseFiber(positionIndex);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barre Supérieure de Configuration */}
      <Card className="border-border/80 shadow-modal">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="size-5 text-primary" />
              Identification &amp; Codes Couleurs Fibre Optique
            </CardTitle>

            <div className="flex items-center gap-2">
              <Badge variant="neutral" className="font-mono text-2xs">
                Modulo {moduleType} FO
              </Badge>
              <Badge variant="primary" className="font-mono text-2xs">
                Câble {capacity} FO
              </Badge>
              <Badge variant="neutral" className="text-2xs">
                {mapping.totalTubesInCable} Tubes
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 1. Choix de la Norme */}
            <div>
              <div className="flex items-center h-6 mb-1.5">
                <span
                  id="fiber-color-standard-label"
                  className="text-foreground text-xs font-semibold"
                >
                  Norme de repérage des couleurs
                </span>
              </div>
              <div
                role="group"
                aria-labelledby="fiber-color-standard-label"
                className="grid grid-cols-2 gap-2"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={standard === 'orange_ft' ? 'primary' : 'outline'}
                  onClick={() => setStandard('orange_ft')}
                  className="h-9 text-xs px-2 font-extrabold cursor-pointer justify-center"
                >
                  France Télécom / Orange
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={standard === 'fotag' ? 'primary' : 'outline'}
                  onClick={() => setStandard('fotag')}
                  className="h-9 text-xs px-2 font-extrabold cursor-pointer justify-center"
                >
                  Code FOTAG (IEEE 802.8)
                </Button>
              </div>
            </div>

            {/* 2. Choix de la Capacité Câble + Modulo au-dessus */}
            <div>
              <div className="flex items-center justify-between h-6 mb-1.5">
                <label
                  htmlFor="fiber-color-capacity"
                  className="text-foreground text-xs font-semibold"
                >
                  Capacité totale du câble (FO)
                </label>

                {/* Boutons Modulo 6 / Modulo 12 cliquables */}
                <div className="flex items-center gap-1">
                  <span className="text-2xs font-extrabold text-muted-foreground mr-0.5">Modulo :</span>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleType(6);
                      if (reverseFiber > 6) setReverseFiber(6);
                      if (!CAPACITIES_MODULO_6.includes(capacity as any)) {
                        setCapacity(144);
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-2xs font-mono font-extrabold transition-all cursor-pointer ${
                      moduleType === 6
                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/40'
                        : 'bg-surface-sunken text-foreground border border-border/60 hover:bg-surface-hover'
                    }`}
                  >
                    6 FO
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModuleType(12);
                      if (!CAPACITIES_MODULO_12.includes(capacity as any)) {
                        setCapacity(144);
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-2xs font-mono font-extrabold transition-all cursor-pointer ${
                      moduleType === 12
                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/40'
                        : 'bg-surface-sunken text-foreground border border-border/60 hover:bg-surface-hover'
                    }`}
                  >
                    12 FO
                  </button>
                </div>
              </div>

              <select
                id="fiber-color-capacity"
                value={capacity}
                onChange={(e) => {
                  const cap = parseInt(e.target.value, 10) as CableCapacity;
                  setCapacity(cap);
                  if (fiberNumber > cap) setFiberNumber(cap);
                }}
                className="bg-surface border-border/80 text-foreground h-9 w-full rounded-md border px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                {availableCapacities.map((cap) => (
                  <option key={cap} value={cap}>
                    {cap} FO ({Math.ceil(cap / moduleType)} {Math.ceil(cap / moduleType) > 1 ? 'tubes' : 'tube'} x {moduleType} FO)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode de Recherche (Par N° de Fibre vs Recherche Inverse) */}
          <div className="pt-2 border-t border-border/40 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={searchMode === 'number' ? 'secondary' : 'ghost'}
                onClick={() => setSearchMode('number')}
                className="text-xs cursor-pointer"
              >
                <Search className="size-3.5 mr-1.5" />
                Par N° de Fibre (1 à {capacity})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={searchMode === 'reverse' ? 'secondary' : 'ghost'}
                onClick={() => setSearchMode('reverse')}
                className="text-xs cursor-pointer"
              >
                <Layers className="size-3.5 mr-1.5" />
                Recherche Inverse (Tube + Pos)
              </Button>
            </div>

            {searchMode === 'number' ? (
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <input
                  type="range"
                  min="1"
                  max={capacity}
                  value={Math.min(fiberNumber, capacity)}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10) || 1;
                    setFiberNumber(Math.max(1, Math.min(capacity, parsed)));
                  }}
                  className="w-full accent-primary cursor-pointer h-2 bg-surface-sunken rounded-lg"
                />
                <Input
                  type="number"
                  min="1"
                  max={capacity}
                  value={fiberNumber}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (Number.isNaN(parsed)) return;
                    setFiberNumber(Math.max(1, Math.min(capacity, parsed)));
                  }}
                  onBlur={() => {
                    setFiberNumber((prev) => Math.max(1, Math.min(capacity, prev)));
                  }}
                  className="w-20 font-mono text-center"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Input
                  label="Tube N°"
                  type="number"
                  min="1"
                  max={mapping.totalTubesInCable}
                  value={reverseTube}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (Number.isNaN(parsed)) return;
                    setReverseTube(Math.max(1, Math.min(mapping.totalTubesInCable, parsed)));
                  }}
                  onBlur={() => {
                    setReverseTube((prev) => Math.max(1, Math.min(mapping.totalTubesInCable, prev)));
                  }}
                  className="w-24 font-mono"
                />
                <Input
                  label={`Fibre (1 à ${moduleType})`}
                  type="number"
                  min="1"
                  max={moduleType}
                  value={reverseFiber}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (Number.isNaN(parsed)) return;
                    setReverseFiber(Math.max(1, Math.min(moduleType, parsed)));
                  }}
                  onBlur={() => {
                    setReverseFiber((prev) => Math.max(1, Math.min(moduleType, prev)));
                  }}
                  className="w-28 font-mono"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rendu Héro Visuel — Fiche de Repérage d'Exception */}
      <Card className="bg-surface-sunken/60 border-border/80 overflow-hidden shadow-modal">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Cable className="size-5 text-accent" />
              Fiche d&apos;Intervention — Fibre N°{mapping.fiberNumber} / {mapping.capacity} (Modulo {moduleType})
            </CardTitle>

            <Button variant="outline" size="sm" onClick={handleCopyFiche} className="cursor-pointer">
              <Copy className="size-3.5 mr-1.5" />
              {copied ? 'Fiche copiée !' : 'Copier la fiche de câblage'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* Grille Principale Tube vs Fibre */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Carte du Tube */}
            <div className="bg-surface border-border/80 rounded-xl border p-3.5 space-y-3 shadow-raised relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-subtle-foreground text-2xs font-bold uppercase tracking-wider">
                  Tube N°{mapping.tubeNumber} sur {mapping.totalTubesInCable}
                </span>
                {mapping.ringAnnotation && (
                  <Badge variant="warning" className="text-2xs font-mono">
                    {mapping.ringAnnotation}
                  </Badge>
                )}
              </div>

              {/* Pastille de Couleur du Tube */}
              <div className="flex items-center gap-3">
                <div
                  className="size-11 rounded-xl flex items-center justify-center font-mono font-bold text-sm shadow-raised shrink-0 border"
                  style={{
                    backgroundColor: mapping.tubeColor.hex,
                    color: mapping.tubeColor.textColor === 'white' ? '#FFFFFF' : '#000000',
                    borderColor: mapping.tubeColor.borderColor || 'transparent',
                  }}
                >
                  {mapping.tubeColor.code}
                </div>

                <div>
                  <div className="text-base font-bold text-foreground tracking-tight">
                    {mapping.tubeColor.name}
                  </div>
                  <p className="text-muted-foreground text-2xs mt-0.5 font-mono">
                    {mapping.tubeColor.hex}
                  </p>
                </div>
              </div>
            </div>

            {/* Carte de la Fibre */}
            <div className="bg-surface border-border/80 rounded-xl border p-3.5 space-y-3 shadow-raised relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-subtle-foreground text-2xs font-bold uppercase tracking-wider">
                  Fibre N°{mapping.fiberIndexInTube} dans le Tube (Mod. {moduleType})
                </span>
                <Badge variant="primary" className="font-mono text-2xs">
                  Position {mapping.fiberIndexInTube} / {mapping.fibersPerTube}
                </Badge>
              </div>

              {/* Pastille de Couleur de la Fibre */}
              <div className="flex items-center gap-3">
                <div
                  className="size-11 rounded-full flex items-center justify-center font-mono font-bold text-sm shadow-raised shrink-0 border"
                  style={{
                    backgroundColor: mapping.fiberColor.hex,
                    color: mapping.fiberColor.textColor === 'white' ? '#FFFFFF' : '#000000',
                    borderColor: mapping.fiberColor.borderColor || 'transparent',
                  }}
                >
                  {mapping.fiberColor.code}
                </div>

                <div>
                  <div className="text-base font-bold text-foreground tracking-tight">
                    {mapping.fiberColor.name}
                  </div>
                  <p className="text-muted-foreground text-2xs mt-0.5 font-mono">
                    {mapping.fiberColor.hex}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Résumé Synthétique de Câblage */}
          <div className="bg-surface rounded-xl p-4 border border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full bg-primary animate-pulse" />
              <p className="text-xs text-foreground font-medium">
                Pour raccorder la <strong className="text-primary font-mono font-bold">Fibre N°{mapping.fiberNumber}</strong> en <strong className="text-foreground">Modulo {moduleType}</strong> : Ouvrir le <strong className="text-foreground">Tube N°{mapping.tubeNumber} ({mapping.tubeColor.name})</strong> et prélever la <strong className="text-foreground">Fibre {mapping.fiberColor.name} (Position {mapping.fiberIndexInTube})</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nuancier Interactif des Couleurs de la Norme Active (Cliquable !) */}
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Nuancier des Couleurs — {getStandardName(standard)} (Modulo {moduleType})</span>
            <span className="text-xs text-muted-foreground font-normal">Cliquez sur une couleur pour sélectionner la fibre dans le tube</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
            {palette.slice(0, moduleType).map((color, index) => {
              const posInSequence = index + 1;
              const isSelectedFiber = mapping.fiberColor.code === color.code;

              return (
                <button
                  type="button"
                  key={color.code}
                  onClick={() => handleSelectColorInTube(posInSequence)}
                  className={`rounded-lg border p-2 flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                    isSelectedFiber
                      ? 'border-blue-500 shadow-modal ring-2 ring-blue-500/40 bg-surface'
                      : 'border-border/60 bg-surface-sunken/40 hover:border-blue-400 hover:bg-surface'
                  }`}
                >
                  <div
                    className="size-7 rounded-md flex items-center justify-center font-mono text-2xs font-bold shrink-0 border"
                    style={{
                      backgroundColor: color.hex,
                      color: color.textColor === 'white' ? '#FFFFFF' : '#000000',
                      borderColor: color.borderColor || 'transparent',
                    }}
                  >
                    {posInSequence}
                  </div>

                  <div className="overflow-hidden w-full">
                    <div className="font-semibold text-2xs text-foreground truncate">{color.name}</div>
                    <div className="text-subtle-foreground text-[10px] font-mono">{color.code}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
