import { Calendar, Check, Copy, FileCode, Globe, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

const TIME_UNIT_SECONDS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs} sec`;
  if (secs < 3600) return `${(secs / 60).toFixed(0)} min (${secs} s)`;
  if (secs < 86400) return `${(secs / 3600).toFixed(1)} heures (${secs} s)`;
  return `${(secs / 86400).toFixed(1)} jours (${secs} s)`;
}

export default function DnsTtlCalculatorTool() {
  const [currentTtlValue, setCurrentTtlValue] = useState<number>(86400); // 24h default
  const [currentTtlUnit, setCurrentTtlUnit] = useState<TimeUnit>('seconds');
  const [reducedTtlValue, setReducedTtlValue] = useState<number>(300); // 5 min
  const [reducedTtlUnit, setReducedTtlUnit] = useState<TimeUnit>('seconds');

  const [domainName, setDomainName] = useState<string>('example.com');
  const [recordType, setRecordType] = useState<'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SPF'>('A');
  const [recordValue, setRecordValue] = useState<string>('192.0.2.1');

  const [copied, setCopied] = useState<boolean>(false);

  const ttlAnalysis = useMemo(() => {
    const currentSeconds = currentTtlValue * TIME_UNIT_SECONDS[currentTtlUnit];
    const reducedSeconds = reducedTtlValue * TIME_UNIT_SECONDS[reducedTtlUnit];

    const minAdvanceNoticeSec = currentSeconds;
    const maxPropagationSec = reducedSeconds;
    const safeDecommissionSec = reducedSeconds * 2;

    return {
      currentSeconds,
      reducedSeconds,
      minAdvanceNoticeSec,
      maxPropagationSec,
      safeDecommissionSec,
    };
  }, [currentTtlValue, currentTtlUnit, reducedTtlValue, reducedTtlUnit]);

  const generatedRecord = useMemo(() => {
    const cleanDomain = domainName.trim() || 'example.com';
    const cleanVal = recordValue.trim() || '192.0.2.1';
    const ttl = ttlAnalysis.reducedSeconds;

    switch (recordType) {
      case 'A':
        return `${cleanDomain}.  ${ttl}  IN  A  ${cleanVal}`;
      case 'AAAA':
        return `${cleanDomain}.  ${ttl}  IN  AAAA  ${cleanVal}`;
      case 'CNAME':
        return `${cleanDomain}.  ${ttl}  IN  CNAME  ${cleanVal}.`;
      case 'MX':
        return `${cleanDomain}.  ${ttl}  IN  MX  10 ${cleanVal}.`;
      case 'TXT':
        return `${cleanDomain}.  ${ttl}  IN  TXT  "${cleanVal}"`;
      case 'SPF':
        return `${cleanDomain}.  ${ttl}  IN  TXT  "v=spf1 mx a ip4:${cleanVal} ~all"`;
      default:
        return `${cleanDomain}.  ${ttl}  IN  A  ${cleanVal}`;
    }
  }, [domainName, recordValue, recordType, ttlAnalysis.reducedSeconds]);

  const copyRecord = () => {
    void navigator.clipboard.writeText(generatedRecord);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ------------------- FORMULAIRE TTL */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Globe className="size-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">TTL Actuel en Production</h3>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Durée de mise en cache actuelle (Current TTL)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={currentTtlValue}
                onChange={(e) => setCurrentTtlValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <select
                value={currentTtlUnit}
                onChange={(e) => setCurrentTtlUnit(e.target.value as TimeUnit)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="seconds">Secondes</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Heures</option>
                <option value="days">Jours</option>
              </select>
            </div>

            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-semibold text-muted-foreground">Raccourcis TTL classiques :</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '300s (5 min)', val: 300 },
                  { label: '3600s (1h)', val: 3600 },
                  { label: '43200s (12h)', val: 43200 },
                  { label: '86400s (24h)', val: 86400 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setCurrentTtlValue(item.val);
                      setCurrentTtlUnit('seconds');
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-500 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TTL Réduit Souhaité pour Migration */}
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Calendar className="size-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">TTL Transitoire (Migration)</h3>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              TTL réduit à appliquer avant la bascule
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={reducedTtlValue}
                onChange={(e) => setReducedTtlValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <select
                value={reducedTtlUnit}
                onChange={(e) => setReducedTtlUnit(e.target.value as TimeUnit)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value="seconds">Secondes</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Heures</option>
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Un TTL bas (ex: 300s = 5 min) permet d&apos;annuler la bascule quasi-instantanément en cas de problème.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------- ÉTAPES DE MIGRATION CHRONOLOGIQUES */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
          <ShieldCheck className="size-5 text-emerald-500" />
          Calendrier d&apos;Exécution & Propagation DNS Zéro-Downtime
        </h4>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-50/50 p-3.5 dark:bg-blue-950/20">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 font-mono text-xs font-bold text-white">
              1
            </span>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Étape 1 : Abaisser le TTL dans la zone DNS
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                Appliquer le TTL réduit ({formatSeconds(ttlAnalysis.reducedSeconds)}) au moins{' '}
                <strong className="text-blue-600 dark:text-blue-400">
                  {formatSeconds(ttlAnalysis.minAdvanceNoticeSec)} AVANT
                </strong>{' '}
                l&apos;heure prévue de la bascule.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-50/50 p-3.5 dark:bg-indigo-950/20">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-mono text-xs font-bold text-white">
              2
            </span>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Étape 2 : Modifier l&apos;adresse IP de l&apos;enregistrement (Bascule)
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                À l&apos;heure H de la migration, modifier l&apos;IP du serveur cible dans la zone DNS.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3.5 dark:bg-emerald-950/20">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-mono text-xs font-bold text-white">
              3
            </span>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Étape 3 : Propagation Mondiale Complète
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                100% des résolveurs et clients mondiaux interrogeront le nouveau serveur après un délai maximal de{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {formatSeconds(ttlAnalysis.maxPropagationSec)}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-50/50 p-3.5 dark:bg-amber-950/20">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-600 font-mono text-xs font-bold text-white">
              4
            </span>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Étape 4 : Décommissionnement de l&apos;Ancien Serveur
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                Attendre au moins{' '}
                <strong className="text-amber-600 dark:text-amber-400">
                  {formatSeconds(ttlAnalysis.safeDecommissionSec)}
                </strong>{' '}
                après la bascule avant d&apos;éteindre l&apos;ancien serveur pour absorber le reliquat de requêtes en cache.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------- GÉNÉRATEUR D'ENREGISTREMENT DNS BIND */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <FileCode className="size-4 text-blue-500" />
            Générateur de Fichier de Zone BIND / RFC 1035
          </h4>
          <button
            type="button"
            onClick={copyRecord}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors cursor-pointer"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copié !' : 'Copier l’enregistrement'}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Nom de domaine / Hôte
            </label>
            <input
              type="text"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-900 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Type d&apos;enregistrement
            </label>
            <select
              value={recordType}
              onChange={(e) => setRecordType(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="A">A (IPv4)</option>
              <option value="AAAA">AAAA (IPv6)</option>
              <option value="CNAME">CNAME (Alias)</option>
              <option value="MX">MX (Mail Server)</option>
              <option value="TXT">TXT (Texte)</option>
              <option value="SPF">SPF (Sécurité Mail)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Cible / Valeur
            </label>
            <input
              type="text"
              value={recordValue}
              onChange={(e) => setRecordValue(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-900 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-blue-400 font-bold overflow-x-auto">
          {generatedRecord}
        </div>
      </div>
    </div>
  );
}
