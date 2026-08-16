import { Clock, HardDrive, Info, Layers, RefreshCw, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

type DataUnit = 'MB' | 'GB' | 'TB' | 'PB';
type SpeedUnit = 'Mbps' | 'Gbps' | '10GbE' | '100GbE';

const DATA_UNIT_FACTORS: Record<DataUnit, number> = {
  MB: 1024 * 1024 * 8, // bits
  GB: 1024 * 1024 * 1024 * 8,
  TB: 1024 * 1024 * 1024 * 1024 * 8,
  PB: 1024 * 1024 * 1024 * 1024 * 1024 * 8,
};

const SPEED_UNIT_FACTORS: Record<SpeedUnit, number> = {
  Mbps: 1e6, // bits per sec
  Gbps: 1e9,
  '10GbE': 10e9,
  '100GbE': 100e9,
};

const PRESETS = [
  { label: 'Image ISO / OS (5 GB)', size: 5, unit: 'GB' as DataUnit },
  { label: 'Base de données DB (50 GB)', size: 50, unit: 'GB' as DataUnit },
  { label: 'Sauvegarde VM (500 GB)', size: 500, unit: 'GB' as DataUnit },
  { label: 'Archive SAN / Cloud (10 TB)', size: 10, unit: 'TB' as DataUnit },
];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 seconde';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} j`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} s`);

  return parts.join(' ');
}

export default function BandwidthTransferCalculatorTool() {
  const [dataSize, setDataSize] = useState<number>(50);
  const [dataUnit, setDataUnit] = useState<DataUnit>('GB');
  const [networkSpeed, setNetworkSpeed] = useState<number>(1);
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('Gbps');
  const [overheadPercent, setOverheadPercent] = useState<number>(5); // 5% TCP/IP overhead

  const results = useMemo(() => {
    const totalBits = dataSize * (DATA_UNIT_FACTORS[dataUnit] ?? DATA_UNIT_FACTORS.GB);
    const nominalSpeedBps = networkSpeed * (SPEED_UNIT_FACTORS[speedUnit] ?? SPEED_UNIT_FACTORS.Gbps);

    // Speed reduced by overhead
    const effectiveSpeedBps = nominalSpeedBps * (1 - Math.min(Math.max(overheadPercent, 0), 50) / 100);

    const secondsTotal = effectiveSpeedBps > 0 ? totalBits / effectiveSpeedBps : 0;
    const nominalSecondsTotal = nominalSpeedBps > 0 ? totalBits / nominalSpeedBps : 0;

    // Effective throughput in Bytes/sec
    const effectiveBytesPerSec = effectiveSpeedBps / 8;
    const effectiveMBps = effectiveBytesPerSec / (1024 * 1024);

    return {
      secondsTotal,
      nominalSecondsTotal,
      effectiveMBps,
      totalBits,
      effectiveSpeedBps,
    };
  }, [dataSize, dataUnit, networkSpeed, speedUnit, overheadPercent]);

  const networkComparisons = useMemo(() => {
    const totalBits = dataSize * (DATA_UNIT_FACTORS[dataUnit] ?? DATA_UNIT_FACTORS.GB);
    const overheadFactor = 1 - Math.min(Math.max(overheadPercent, 0), 50) / 100;

    const networks = [
      { name: '4G LTE (50 Mbps)', speedBps: 50e6 * overheadFactor },
      { name: 'Fibre FTTH Pro (1 Gbps)', speedBps: 1e9 * overheadFactor },
      { name: '5G / Fibre Symmetrical (2.5 Gbps)', speedBps: 2.5e9 * overheadFactor },
      { name: 'LAN DataCenter (10 Gbps)', speedBps: 10e9 * overheadFactor },
      { name: 'Backbone Optique (100 Gbps)', speedBps: 100e9 * overheadFactor },
    ];

    return networks.map((net) => ({
      name: net.name,
      duration: net.speedBps > 0 ? formatDuration(totalBits / net.speedBps) : '-',
    }));
  }, [dataSize, dataUnit, overheadPercent]);

  return (
    <div className="space-y-6">
      {/* ------------------- FORMULAIRE DE CALCUL */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Colonne 1 : Taille des données */}
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <HardDrive className="size-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Volume de Données</h3>
          </div>

          <div className="space-y-3">
            <label htmlFor="bw-data-size-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Taille totale du fichier / archive
            </label>
            <div className="flex gap-2">
              <input
                id="bw-data-size-input"
                type="number"
                min="0.1"
                step="any"
                value={dataSize}
                onChange={(e) => setDataSize(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <select
                aria-label="Unité de données"
                value={dataUnit}
                onChange={(e) => setDataUnit(e.target.value as DataUnit)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="MB">MB (Mo)</option>
                <option value="GB">GB (Go)</option>
                <option value="TB">TB (To)</option>
                <option value="PB">PB (Po)</option>
              </select>
            </div>

            {/* Presets rapides */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Préréglages fréquents :</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setDataSize(p.size);
                      setDataUnit(p.unit);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-500 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Colonne 2 : Vitesse Réseau & Overhead */}
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Zap className="size-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Débit & Protocole</h3>
          </div>

          <div className="space-y-3">
            <label htmlFor="bw-network-speed-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Vitesse nominale de la ligne
            </label>
            <div className="flex gap-2">
              <input
                id="bw-network-speed-input"
                type="number"
                min="0.1"
                step="any"
                value={networkSpeed}
                onChange={(e) => setNetworkSpeed(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <select
                value={speedUnit}
                onChange={(e) => setSpeedUnit(e.target.value as SpeedUnit)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="Mbps">Mbps</option>
                <option value="Gbps">Gbps</option>
                <option value="10GbE">10 GbE</option>
                <option value="100GbE">100 GbE</option>
              </select>
            </div>

            {/* Slider d'Overhead */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Surcharge protocolaire (Overhead TCP/IP, Ethernet) :
                </span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {overheadPercent}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="1"
                value={overheadPercent}
                onChange={(e) => setOverheadPercent(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">
                Compense les en-têtes de paquets TCP/IP, réémissions et encadrement Ethernet (~5% typique).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------- RÉSULTATS PRINCIPAUX */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-50/50 p-5 shadow-xs dark:bg-blue-950/20">
          <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
            <span className="font-semibold">Temps de Transfert Estimé</span>
            <Clock className="size-4" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {formatDuration(results.secondsTotal)}
          </p>
          <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">
            Prend en compte les {overheadPercent}% de perte d&apos;overhead
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Débit Utile Réel (Mo/s)</span>
            <Layers className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {results.effectiveMBps >= 1000
              ? `${(results.effectiveMBps / 1024).toFixed(2)} Go/s`
              : `${results.effectiveMBps.toFixed(2)} Mo/s`}
          </p>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Vitesse de copie réelle perçue par le système
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Temps Théorique Brut</span>
            <RefreshCw className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {formatDuration(results.nominalSecondsTotal)}
          </p>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Sans aucune perte ou surcharge de paquet
          </span>
        </div>
      </div>

      {/* ------------------- TABLEAU COMPARATIF DES LIGNES RÉSEAUX */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Info className="size-4 text-blue-500" />
          Comparatif de durée pour {dataSize} {dataUnit} selon le type de liaison
        </h4>

        <div className="scroll-x rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2.5 font-bold">Type de Connexion Réseau</th>
                <th className="px-4 py-2.5 font-bold text-right">Durée Estimée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {networkComparisons.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                    {row.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 text-right">
                    {row.duration}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
