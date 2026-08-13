import { Activity, Gauge, Info, Layers, Sliders, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

type SpeedUnit = 'Mbps' | 'Gbps' | '10GbE';

const SPEED_FACTORS: Record<SpeedUnit, number> = {
  Mbps: 1e6,
  Gbps: 1e9,
  '10GbE': 10e9,
};

const LATENCY_PRESETS = [
  { label: 'LAN / DataCenter (1 ms)', rtt: 1 },
  { label: 'Fibre Nationale (15 ms)', rtt: 15 },
  { label: 'Transatlantique Paris-NY (80 ms)', rtt: 80 },
  { label: 'Satellite LEO Starlink (40 ms)', rtt: 40 },
  { label: 'Satellite GÉO (600 ms)', rtt: 600 },
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Octet';
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function TcpBdpCalculatorTool() {
  const [speedValue, setSpeedValue] = useState<number>(1);
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('Gbps');
  const [rttMs, setRttMs] = useState<number>(80); // 80 ms RTT
  const [currentWindowKB, setCurrentWindowKB] = useState<number>(64); // 64 KB default TCP window

  const calculations = useMemo(() => {
    const bandwidthBps = speedValue * (SPEED_FACTORS[speedUnit] ?? 1e9);
    const rttSec = rttMs / 1000;

    // BDP in Bytes
    const bdpBytes = (bandwidthBps * rttSec) / 8;

    // Max theoretical throughput with current window size (in bps)
    const currentWindowBits = currentWindowKB * 1024 * 8;
    const maxThroughputBps = rttSec > 0 ? currentWindowBits / rttSec : 0;
    const maxThroughputMbps = maxThroughputBps / 1e6;

    // Efficiency percentage
    const efficiency = Math.min(100, (maxThroughputBps / bandwidthBps) * 100);

    return {
      bdpBytes,
      maxThroughputMbps,
      efficiency,
      bandwidthBps,
    };
  }, [speedValue, speedUnit, rttMs, currentWindowKB]);

  const latencyComparisons = useMemo(() => {
    const bandwidthBps = speedValue * (SPEED_FACTORS[speedUnit] ?? 1e9);

    return LATENCY_PRESETS.map((preset) => {
      const rttSec = preset.rtt / 1000;
      const bdp = (bandwidthBps * rttSec) / 8;
      const currentWinBits = currentWindowKB * 1024 * 8;
      const maxMbps = rttSec > 0 ? (currentWinBits / rttSec) / 1e6 : 0;

      return {
        label: preset.label,
        rtt: preset.rtt,
        bdpFormatted: formatBytes(bdp),
        maxMbps: Math.min(maxMbps, bandwidthBps / 1e6),
      };
    });
  }, [speedValue, speedUnit, currentWindowKB]);

  return (
    <div className="space-y-6">
      {/* ------------------- FORMULAIRE BDP */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Zap className="size-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Paramètres de Liaison</h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bande passante disponible (Capacité réseau)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={speedValue}
                  onChange={(e) => setSpeedValue(Math.max(0, parseFloat(e.target.value) || 0))}
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
                </select>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Temps d&apos;aller-retour RTT (Latence en ms)
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={rttMs}
                onChange={(e) => setRttMs(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            {/* Presets latence */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Préréglages de latence :</span>
              <div className="flex flex-wrap gap-1.5">
                {LATENCY_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setRttMs(p.rtt)}
                    className="rounded-lg border border-slate-200 bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-500 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fenêtre TCP Actuelle */}
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Sliders className="size-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Configuration TCP Window</h3>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Taille actuelle de la fenêtre TCP (Socket Buffer)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="8"
                step="8"
                value={currentWindowKB}
                onChange={(e) => setCurrentWindowKB(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <span className="font-mono text-xs font-bold text-slate-500">KB</span>
            </div>

            <div className="space-y-1 pt-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Tailles courantes :</span>
              <div className="flex flex-wrap gap-1.5">
                {[64, 128, 256, 512, 1024, 4096].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setCurrentWindowKB(size)}
                    className="rounded-lg border border-slate-200 bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-500 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                  >
                    {size >= 1024 ? `${size / 1024} MB` : `${size} KB`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------- RÉSULTATS PRINCIPAUX */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-50/50 p-5 shadow-xs dark:bg-blue-950/20">
          <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
            <span className="font-semibold">BDP (Buffer TCP Requis)</span>
            <Layers className="size-4" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {formatBytes(calculations.bdpBytes)}
          </p>
          <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">
            Taille de tampon nécessaire pour 100% d&apos;efficacité
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Débit Max avec Fenêtre Actuelle</span>
            <Gauge className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {calculations.maxThroughputMbps >= 1000
              ? `${(calculations.maxThroughputMbps / 1000).toFixed(2)} Gbps`
              : `${calculations.maxThroughputMbps.toFixed(2)} Mbps`}
          </p>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Plafonné par la fenêtre TCP de {currentWindowKB} KB
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Efficacité Réseau Utilisée</span>
            <Activity className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {calculations.efficiency.toFixed(1)}%
          </p>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            {calculations.efficiency < 90
              ? '⚠️ Fenêtre TCP sous-dimensionnée (Goulot d’étranglement)'
              : '✅ Fenêtre TCP optimale pour cette latence'}
          </span>
        </div>
      </div>

      {/* ------------------- TABLEAU IMPACT LATENCE SUR BDP */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Info className="size-4 text-blue-500" />
          Impact de la Latence sur la Fenêtre TCP et le Débit Utile
        </h4>

        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2.5 font-bold">Liaison / Scénario</th>
                <th className="px-4 py-2.5 font-bold text-center">Latence RTT</th>
                <th className="px-4 py-2.5 font-bold text-center">BDP Requis (Buffer 100%)</th>
                <th className="px-4 py-2.5 font-bold text-right">Débit Max (Fenêtre {currentWindowKB} KB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {latencyComparisons.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                    {row.label}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-center text-slate-600 dark:text-slate-400">
                    {row.rtt} ms
                  </td>
                  <td className="px-4 py-2.5 font-mono text-center font-bold text-indigo-600 dark:text-indigo-400">
                    {row.bdpFormatted}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-right font-bold text-blue-600 dark:text-blue-400">
                    {row.maxMbps >= 1000 ? `${(row.maxMbps / 1000).toFixed(2)} Gbps` : `${row.maxMbps.toFixed(1)} Mbps`}
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
