import { useMemo, useState } from 'react';
import { Cable, Check, Copy, Minus, Plus, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

// -----------------------------------------------------------------------------
// SPÉCIFICATION EXACTE DU CODE 28 PAIRES TÉLÉCOM (4 AMORCES DE 7 PAIRES)
// -----------------------------------------------------------------------------
const PTT_28_PATTERN = [
  // Amorce 1 (Paires 1 à 7)
  { amorce: 'Gris', accomp: 'Blanc', amorceHex: '#6b7280', accompHex: '#f9fafb', textDarkA: false, textDarkB: true, amorceGroup: 1 },
  { amorce: 'Incolore', accomp: 'Bleu', amorceHex: '#e5e7eb', accompHex: '#3b82f6', textDarkA: true, textDarkB: true, amorceGroup: 1 },
  { amorce: 'Gris', accomp: 'Jaune', amorceHex: '#6b7280', accompHex: '#facc15', textDarkA: false, textDarkB: true, amorceGroup: 1 },
  { amorce: 'Incolore', accomp: 'Marron', amorceHex: '#e5e7eb', accompHex: '#854d0e', textDarkA: true, textDarkB: false, amorceGroup: 1 },
  { amorce: 'Gris', accomp: 'Noir', amorceHex: '#6b7280', accompHex: '#18181b', textDarkA: false, textDarkB: false, amorceGroup: 1 },
  { amorce: 'Incolore', accomp: 'Rouge', amorceHex: '#e5e7eb', accompHex: '#ef4444', textDarkA: true, textDarkB: true, amorceGroup: 1 },
  { amorce: 'Gris', accomp: 'Vert', amorceHex: '#6b7280', accompHex: '#22c55e', textDarkA: false, textDarkB: true, amorceGroup: 1 },

  // Amorce 2 (Paires 8 à 14)
  { amorce: 'Incolore', accomp: 'Blanc', amorceHex: '#e5e7eb', accompHex: '#f9fafb', textDarkA: true, textDarkB: true, amorceGroup: 2 },
  { amorce: 'Gris', accomp: 'Bleu', amorceHex: '#6b7280', accompHex: '#3b82f6', textDarkA: false, textDarkB: true, amorceGroup: 2 },
  { amorce: 'Incolore', accomp: 'Jaune', amorceHex: '#e5e7eb', accompHex: '#facc15', textDarkA: true, textDarkB: true, amorceGroup: 2 },
  { amorce: 'Gris', accomp: 'Marron', amorceHex: '#6b7280', accompHex: '#854d0e', textDarkA: false, textDarkB: false, amorceGroup: 2 },
  { amorce: 'Incolore', accomp: 'Noir', amorceHex: '#e5e7eb', accompHex: '#18181b', textDarkA: true, textDarkB: false, amorceGroup: 2 },
  { amorce: 'Gris', accomp: 'Rouge', amorceHex: '#6b7280', accompHex: '#ef4444', textDarkA: false, textDarkB: true, amorceGroup: 2 },
  { amorce: 'Incolore', accomp: 'Vert', amorceHex: '#e5e7eb', accompHex: '#22c55e', textDarkA: true, textDarkB: true, amorceGroup: 2 },

  // Amorce 3 (Paires 15 à 21)
  { amorce: 'Orange', accomp: 'Blanc', amorceHex: '#fb923c', accompHex: '#f9fafb', textDarkA: true, textDarkB: true, amorceGroup: 3 },
  { amorce: 'Violet', accomp: 'Bleu', amorceHex: '#a855f7', accompHex: '#3b82f6', textDarkA: false, textDarkB: true, amorceGroup: 3 },
  { amorce: 'Orange', accomp: 'Jaune', amorceHex: '#fb923c', accompHex: '#facc15', textDarkA: true, textDarkB: true, amorceGroup: 3 },
  { amorce: 'Violet', accomp: 'Marron', amorceHex: '#a855f7', accompHex: '#854d0e', textDarkA: false, textDarkB: false, amorceGroup: 3 },
  { amorce: 'Orange', accomp: 'Noir', amorceHex: '#fb923c', accompHex: '#18181b', textDarkA: true, textDarkB: false, amorceGroup: 3 },
  { amorce: 'Violet', accomp: 'Rouge', amorceHex: '#a855f7', accompHex: '#ef4444', textDarkA: false, textDarkB: true, amorceGroup: 3 },
  { amorce: 'Orange', accomp: 'Vert', amorceHex: '#fb923c', accompHex: '#22c55e', textDarkA: true, textDarkB: true, amorceGroup: 3 },

  // Amorce 4 (Paires 22 à 28)
  { amorce: 'Violet', accomp: 'Blanc', amorceHex: '#a855f7', accompHex: '#f9fafb', textDarkA: false, textDarkB: true, amorceGroup: 4 },
  { amorce: 'Orange', accomp: 'Bleu', amorceHex: '#fb923c', accompHex: '#3b82f6', textDarkA: true, textDarkB: true, amorceGroup: 4 },
  { amorce: 'Violet', accomp: 'Jaune', amorceHex: '#a855f7', accompHex: '#facc15', textDarkA: false, textDarkB: true, amorceGroup: 4 },
  { amorce: 'Orange', accomp: 'Marron', amorceHex: '#fb923c', accompHex: '#854d0e', textDarkA: true, textDarkB: false, amorceGroup: 4 },
  { amorce: 'Violet', accomp: 'Noir', amorceHex: '#a855f7', accompHex: '#18181b', textDarkA: false, textDarkB: false, amorceGroup: 4 },
  { amorce: 'Orange', accomp: 'Rouge', amorceHex: '#fb923c', accompHex: '#ef4444', textDarkA: true, textDarkB: true, amorceGroup: 4 },
  { amorce: 'Violet', accomp: 'Vert', amorceHex: '#a855f7', accompHex: '#22c55e', textDarkA: false, textDarkB: true, amorceGroup: 4 },
];

const CABLE_CAPACITIES = [
  { pairs: 8, label: '8 Paires' },
  { pairs: 14, label: '14 Paires' },
  { pairs: 28, label: '28 Paires' },
  { pairs: 56, label: '56 Paires' },
  { pairs: 112, label: '112 Paires' },
  { pairs: 224, label: '224 Paires' },
  { pairs: 448, label: '448 Paires' },
  { pairs: 720, label: '720 Paires' },
] as const;

function getPttPairDetails(pairNumber: number) {
  const index = (pairNumber - 1) % PTT_28_PATTERN.length;
  // `PTT_28_PATTERN` est un tuple littéral non vide : l'index modulo sa longueur
  // y tombe toujours. Le repli rend cette garantie lisible par le typeur.
  const patternItem = PTT_28_PATTERN[index] ?? PTT_28_PATTERN[0]!;

  return {
    amorce: { name: patternItem.amorce, hex: patternItem.amorceHex, textDark: patternItem.textDarkA },
    accomp: { name: patternItem.accomp, hex: patternItem.accompHex, textDark: patternItem.textDarkB },
    amorceGroupNumber: patternItem.amorceGroup,
  };
}

export default function CopperColorCodeTool() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'ptt'>('matrix');

  // Mode PTT / Capacité
  const [selectedCapacity, setSelectedCapacity] = useState<number>(28);
  const [pttPairNumber, setPttPairNumber] = useState<number>(1);
  const [copied, signalerCopied] = useEphemeralFlag();

  const pttResult = getPttPairDetails(pttPairNumber);

  // Génération de la matrice complète des paires selon la capacité du câble
  const fullCableMatrix = useMemo(() => {
    const list = [];
    for (let i = 1; i <= selectedCapacity; i++) {
      list.push({ pairNumber: i, ...getPttPairDetails(i) });
    }
    return list;
  }, [selectedCapacity]);

  const handleCopyRepérage = () => {
    const summary = `Repérage Câble Cuivre Télécom ${selectedCapacity} paires — Paire #${pttPairNumber} : Fil A = ${pttResult.amorce.name} | Fil B = ${pttResult.accomp.name} (Amorce #${pttResult.amorceGroupNumber})`;
    void navigator.clipboard.writeText(summary);
    signalerCopied();
  };

  const handlePairChange = (val: number) => {
    const clamped = Math.max(1, Math.min(selectedCapacity, val));
    setPttPairNumber(clamped);
  };

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {/* ----------------------------------------------------------------- BARRE SUPÉRIEURE DE NAVIGATION ET CAPACITÉ */}
      <div className="bg-surface rounded-xl p-2 border border-border/70 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Onglets de vue */}
          <div className="flex bg-surface-sunken p-1 rounded-lg gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-md py-1.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>📋 Tableau Complet ({selectedCapacity} Paires)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ptt')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-md py-1.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ptt'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Cable className="size-3.5" />
              <span>🔍 Repérage d&apos;une Paire</span>
            </button>
          </div>

          <span className="text-2xs font-extrabold text-muted-foreground uppercase tracking-wider hidden md:inline">
            Taille du câble télécom (Paires) :
          </span>
        </div>

        {/* Grille de sélection des 8 Capacités du Câble */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1 border-t border-border/40">
          {CABLE_CAPACITIES.map((cap) => (
            <button
              key={cap.pairs}
              type="button"
              onClick={() => {
                setSelectedCapacity(cap.pairs);
                if (pttPairNumber > cap.pairs) setPttPairNumber(1);
              }}
              className={`rounded-md py-1.5 px-2 text-xs font-extrabold transition-all cursor-pointer text-center ${
                selectedCapacity === cap.pairs
                  ? 'bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/40'
                  : 'bg-surface-sunken text-foreground hover:bg-surface-hover border border-border/40'
              }`}
            >
              {cap.pairs}P
            </button>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------------- VUE 1 : TABLEAU COMPLET (MATRICE) */}
      {activeTab === 'matrix' && (
        <div className="bg-surface rounded-xl border border-border/80 shadow-xs p-3 space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
              <ShieldCheck className="size-4 text-success" />
              Matrice des {selectedCapacity} Paires
            </h3>
            <span className="text-2xs text-muted-foreground">
              Cliquez sur une ligne pour l&apos;inspecter dans le repérage
            </span>
          </div>

          <div className="border-border/60 scroll-x max-h-[580px] overflow-y-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-sunken sticky top-0 border-b border-border/60 text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 px-3">Paire</th>
                  <th className="py-2 px-3">Séquence Amorce</th>
                  <th className="py-2 px-3">Fil 1 (Amorce)</th>
                  <th className="py-2 px-3">Fil 2 (Accompagnant)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {fullCableMatrix.map((item) => (
                  <tr
                    key={item.pairNumber}
                    onClick={() => {
                      setPttPairNumber(item.pairNumber);
                      setActiveTab('ptt');
                    }}
                    className="hover:bg-primary/10 cursor-pointer transition-colors"
                  >
                    <td className="py-1.5 px-3 font-bold text-foreground">
                      Paire n°{item.pairNumber}
                    </td>
                    <td className="py-1.5 px-3 text-muted-foreground text-2xs font-semibold">
                      Amorce #{item.amorceGroupNumber}
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full border border-border/80 shrink-0"
                          style={{ backgroundColor: item.amorce.hex }}
                        />
                        <span className="text-foreground font-semibold">{item.amorce.name}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full border border-border/80 shrink-0"
                          style={{ backgroundColor: item.accomp.hex }}
                        />
                        <span className="text-foreground font-semibold">{item.accomp.name}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- VUE 2 : COCKPIT REPÉRAGE 1 PAIRE COMPACT */}
      {activeTab === 'ptt' && (
        <div className="bg-surface rounded-xl border border-border/80 shadow-xs p-4 space-y-3">
          {/* Ligne 1 : Navigation Paire */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-sunken p-3 rounded-xl border border-border/60">
            {/* Contrôles -1 / Input / +1 */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-2xs font-bold text-muted-foreground mr-1">Paire :</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-lg shrink-0 cursor-pointer"
                onClick={() => handlePairChange(pttPairNumber - 1)}
                disabled={pttPairNumber <= 1}
              >
                <Minus className="size-4" />
              </Button>

              <input
                type="number"
                min={1}
                max={selectedCapacity}
                value={pttPairNumber}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (Number.isNaN(val)) return;
                  handlePairChange(val);
                }}
                onBlur={() => {
                  handlePairChange(pttPairNumber);
                }}
                className="w-20 text-center font-mono font-black text-lg bg-surface border border-primary/60 rounded-lg py-1 px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-lg shrink-0 cursor-pointer"
                onClick={() => handlePairChange(pttPairNumber + 1)}
                disabled={pttPairNumber >= selectedCapacity}
              >
                <Plus className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-mono">/ {selectedCapacity}</span>
            </div>

            {/* Slider direct */}
            <div className="flex-1 max-w-md">
              <input
                type="range"
                min="1"
                max={selectedCapacity}
                step="1"
                value={pttPairNumber}
                onChange={(e) => handlePairChange(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface accent-blue-600"
              />
            </div>
          </div>

          {/* Ligne 2 : Affichage Compact des 2 Fils & Résultat */}
          <div className="bg-surface rounded-xl p-3 border-2 border-primary/30 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="primary" className="font-mono text-xs px-2.5 py-0.5">
                Paire n°{pttPairNumber} / {selectedCapacity}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Fil A */}
              <div className="bg-surface-sunken p-3 rounded-xl border border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="size-8 rounded-full border-2 border-border/80 flex items-center justify-center font-black text-xs shrink-0 shadow-xs"
                    style={{
                      backgroundColor: pttResult.amorce.hex,
                      color: pttResult.amorce.textDark ? '#000' : '#fff',
                    }}
                  >
                    A
                  </div>
                  <div>
                    <span className="text-3xs font-extrabold uppercase text-muted-foreground block">
                      Fil 1
                    </span>
                    <span className="text-foreground font-black text-sm">
                      {pttResult.amorce.name}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-3xs text-muted-foreground bg-surface px-1.5 py-0.5 rounded border border-border/40">
                  Cond. A
                </span>
              </div>

              {/* Fil B */}
              <div className="bg-surface-sunken p-3 rounded-xl border border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="size-8 rounded-full border-2 border-border/80 flex items-center justify-center font-black text-xs shrink-0 shadow-xs"
                    style={{
                      backgroundColor: pttResult.accomp.hex,
                      color: pttResult.accomp.textDark ? '#000' : '#fff',
                    }}
                  >
                    B
                  </div>
                  <div>
                    <span className="text-3xs font-extrabold uppercase text-muted-foreground block">
                      Fil 2
                    </span>
                    <span className="text-foreground font-black text-sm">
                      {pttResult.accomp.name}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-3xs text-muted-foreground bg-surface px-1.5 py-0.5 rounded border border-border/40">
                  Cond. B
                </span>
              </div>
            </div>

            {/* Bouton de copie compact */}
            <Button
              variant="outline"
              size="sm"
              className="w-full font-bold text-xs py-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={handleCopyRepérage}
            >
              {copied ? <Check className="size-4 mr-1.5 text-success" /> : <Copy className="size-4 mr-1.5" />}
              {copied ? 'Repérage copié dans le presse-papier !' : 'Copier le repérage télécom'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
