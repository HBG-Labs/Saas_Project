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
        <div className="space-y-4 rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken">
          <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-border">
            <Zap className="size-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground dark:text-white">Paramètres de Liaison</h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="tcp-bdp-speed-input" className="block text-xs font-semibold text-muted-foreground">
                Bande passante disponible (Capacité réseau)
              </label>
              <div className="flex gap-2">
                <input
                  id="tcp-bdp-speed-input"
                  type="number"
                  min="0.1"
                  step="any"
                  value={speedValue}
                  onChange={(e) => setSpeedValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2 text-sm font-semibold text-foreground focus:border-primary focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
                />
                <select
                  aria-label="Unité de débit"
                  value={speedUnit}
                  onChange={(e) => setSpeedUnit(e.target.value as SpeedUnit)}
                  className="rounded-xl border border-border bg-surface-sunken px-3.5 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
                >
                  <option value="Mbps">Mbps</option>
                  <option value="Gbps">Gbps</option>
                  <option value="10GbE">10 GbE</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <label htmlFor="tcp-bdp-rtt-input" className="block text-xs font-semibold text-muted-foreground">
                Temps d&apos;aller-retour RTT (Latence en ms)
              </label>
              <input
                id="tcp-bdp-rtt-input"
                type="number"
                min="0.1"
                step="any"
                value={rttMs}
                onChange={(e) => setRttMs(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2 text-sm font-semibold text-foreground focus:border-primary focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
              />
            </div>

            {/* Presets latence */}
            <div className="space-y-1.5 pt-2">
              <span className="text-xs font-semibold text-muted-foreground">Préréglages de latence :</span>
              <div className="flex flex-wrap gap-1.5">
                {LATENCY_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setRttMs(p.rtt)}
                    className="rounded-lg border border-border bg-surface-sunken/70 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary dark:border-border dark:bg-surface-sunken dark:text-muted-foreground dark:hover:text-white cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fenêtre TCP Actuelle */}
        <div className="space-y-4 rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken">
          <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-border">
            <Sliders className="size-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground dark:text-white">Configuration TCP Window</h3>
          </div>

          <div className="space-y-3">
            <label htmlFor="tcp-bdp-window-input" className="block text-xs font-semibold text-muted-foreground">
              Taille actuelle de la fenêtre TCP (Socket Buffer)
            </label>
            <div className="flex gap-2 items-center">
              <input
                id="tcp-bdp-window-input"
                type="number"
                min="8"
                step="8"
                value={currentWindowKB}
                onChange={(e) => setCurrentWindowKB(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2 text-sm font-semibold text-foreground focus:border-primary focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
              />
              <span className="font-mono text-xs font-bold text-muted-foreground">KB</span>
            </div>

            <div className="space-y-1 pt-2">
              <span className="text-xs font-semibold text-muted-foreground">Tailles courantes :</span>
              <div className="flex flex-wrap gap-1.5">
                {[64, 128, 256, 512, 1024, 4096].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setCurrentWindowKB(size)}
                    className="rounded-lg border border-border bg-surface-sunken/70 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary dark:border-border dark:bg-surface-sunken dark:text-muted-foreground dark:hover:text-white cursor-pointer"
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
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5 shadow-xs dark:bg-primary/20">
          <div className="flex items-center justify-between text-xs text-primary">
            <span className="font-semibold">BDP (Buffer TCP Requis)</span>
            <Layers className="size-4" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-foreground dark:text-white">
            {formatBytes(calculations.bdpBytes)}
          </p>
          <span className="mt-1 block text-xs text-muted-foreground">
            Taille de tampon nécessaire pour 100% d&apos;efficacité
          </span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold">Débit Max avec Fenêtre Actuelle</span>
            <Gauge className="size-4 text-success" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-success">
            {calculations.maxThroughputMbps >= 1000
              ? `${(calculations.maxThroughputMbps / 1000).toFixed(2)} Gbps`
              : `${calculations.maxThroughputMbps.toFixed(2)} Mbps`}
          </p>
          <span className="mt-1 block text-xs text-muted-foreground">
            Plafonné par la fenêtre TCP de {currentWindowKB} KB
          </span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold">Efficacité Réseau Utilisée</span>
            <Activity className="size-4 text-warning" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-foreground dark:text-white">
            {calculations.efficiency.toFixed(1)}%
          </p>
          <span className="mt-1 block text-xs text-muted-foreground">
            {calculations.efficiency < 90
              ? '⚠️ Fenêtre TCP sous-dimensionnée (Goulot d’étranglement)'
              : '✅ Fenêtre TCP optimale pour cette latence'}
          </span>
        </div>
      </div>

      {/* ------------------- TABLEAU IMPACT LATENCE SUR BDP */}
      <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-bold text-foreground dark:text-white">
          <Info className="size-4 text-primary" />
          Impact de la Latence sur la Fenêtre TCP et le Débit Utile
        </h4>

        <div className="scroll-x rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-sunken text-muted-foreground dark:bg-surface-sunken dark:text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-bold">Liaison / Scénario</th>
                <th className="px-4 py-2.5 font-bold text-center">Latence RTT</th>
                <th className="px-4 py-2.5 font-bold text-center">BDP Requis (Buffer 100%)</th>
                <th className="px-4 py-2.5 font-bold text-right">Débit Max (Fenêtre {currentWindowKB} KB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {latencyComparisons.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-sunken/50 dark:hover:bg-surface-sunken">
                  <td className="px-4 py-2.5 font-medium text-foreground dark:text-white">
                    {row.label}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-center text-muted-foreground">
                    {row.rtt} ms
                  </td>
                  <td className="px-4 py-2.5 font-mono text-center font-bold text-primary">
                    {row.bdpFormatted}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-right font-bold text-primary">
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
