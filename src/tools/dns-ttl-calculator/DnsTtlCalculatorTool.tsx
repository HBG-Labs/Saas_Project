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
        <div className="space-y-4 rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken">
          <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-border">
            <Globe className="size-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground dark:text-white">TTL Actuel en Production</h3>
          </div>

          <div className="space-y-3">
            <label htmlFor="current-ttl-input" className="block text-xs font-semibold text-muted-foreground">
              Durée de mise en cache actuelle (Current TTL)
            </label>
            <div className="flex gap-2">
              <input
                id="current-ttl-input"
                type="number"
                min="1"
                value={currentTtlValue}
                onChange={(e) => setCurrentTtlValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2 text-sm font-semibold text-foreground focus:border-primary focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
              />
              <select
                aria-label="Unité TTL actuel"
                value={currentTtlUnit}
                onChange={(e) => setCurrentTtlUnit(e.target.value as TimeUnit)}
                className="rounded-xl border border-border bg-surface-sunken px-3.5 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
              >
                <option value="seconds">Secondes</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Heures</option>
                <option value="days">Jours</option>
              </select>
            </div>

            <div className="space-y-1 pt-1">
              <span className="text-xs font-semibold text-muted-foreground">Raccourcis TTL classiques :</span>
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
                    className="min-h-touch sm:min-h-0 inline-flex items-center rounded-lg border border-border bg-surface-sunken/70 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary dark:border-border dark:bg-surface-sunken dark:text-muted-foreground dark:hover:text-white cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TTL Réduit Souhaité pour Migration */}
        <div className="space-y-4 rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken">
          <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-border">
            <Calendar className="size-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground dark:text-white">TTL Transitoire (Migration)</h3>
          </div>

          <div className="space-y-3">
            <label htmlFor="reduced-ttl-input" className="block text-xs font-semibold text-muted-foreground">
              TTL réduit à appliquer avant la bascule
            </label>
            <div className="flex gap-2">
              <input
                id="reduced-ttl-input"
                type="number"
                min="1"
                value={reducedTtlValue}
                onChange={(e) => setReducedTtlValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2 text-sm font-semibold text-foreground focus:border-primary focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
              />
              <select
                aria-label="Unité TTL transitoire"
                value={reducedTtlUnit}
                onChange={(e) => setReducedTtlUnit(e.target.value as TimeUnit)}
                className="rounded-xl border border-border bg-surface-sunken px-3.5 py-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
              >
                <option value="seconds">Secondes</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Heures</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Un TTL bas (ex: 300s = 5 min) permet d&apos;annuler la bascule quasi-instantanément en cas de problème.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------- ÉTAPES DE MIGRATION CHRONOLOGIQUES */}
      <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-bold text-foreground dark:text-white border-b border-border pb-3 dark:border-border">
          <ShieldCheck className="size-5 text-success" />
          Calendrier d&apos;Exécution & Propagation DNS Zéro-Downtime
        </h4>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3.5 dark:bg-primary/20">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
              1
            </span>
            <div>
              <p className="font-bold text-foreground dark:text-white">
                Étape 1 : Abaisser le TTL dans la zone DNS
              </p>
              <p className="text-muted-foreground mt-0.5">
                Appliquer le TTL réduit ({formatSeconds(ttlAnalysis.reducedSeconds)}) au moins{' '}
                <strong className="text-primary">
                  {formatSeconds(ttlAnalysis.minAdvanceNoticeSec)} AVANT
                </strong>{' '}
                l&apos;heure prévue de la bascule.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3.5 dark:bg-primary/20">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
              2
            </span>
            <div>
              <p className="font-bold text-foreground dark:text-white">
                Étape 2 : Modifier l&apos;adresse IP de l&apos;enregistrement (Bascule)
              </p>
              <p className="text-muted-foreground mt-0.5">
                À l&apos;heure H de la migration, modifier l&apos;IP du serveur cible dans la zone DNS.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-success/20 bg-success/10 p-3.5 dark:bg-success/20">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success font-mono text-xs font-bold text-success-foreground">
              3
            </span>
            <div>
              <p className="font-bold text-foreground dark:text-white">
                Étape 3 : Propagation Mondiale Complète
              </p>
              <p className="text-muted-foreground mt-0.5">
                100% des résolveurs et clients mondiaux interrogeront le nouveau serveur après un délai maximal de{' '}
                <strong className="text-success">
                  {formatSeconds(ttlAnalysis.maxPropagationSec)}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/10 p-3.5 dark:bg-warning/20">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-warning font-mono text-xs font-bold text-warning-foreground">
              4
            </span>
            <div>
              <p className="font-bold text-foreground dark:text-white">
                Étape 4 : Décommissionnement de l&apos;Ancien Serveur
              </p>
              <p className="text-muted-foreground mt-0.5">
                Attendre au moins{' '}
                <strong className="text-warning">
                  {formatSeconds(ttlAnalysis.safeDecommissionSec)}
                </strong>{' '}
                après la bascule avant d&apos;éteindre l&apos;ancien serveur pour absorber le reliquat de requêtes en cache.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------- GÉNÉRATEUR D'ENREGISTREMENT DNS BIND */}
      <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-xs dark:border-border/80 dark:bg-surface-sunken space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3 dark:border-border">
          <h4 className="flex items-center gap-2 text-sm font-bold text-foreground dark:text-white">
            <FileCode className="size-4 text-primary" />
            Générateur de Fichier de Zone BIND / RFC 1035
          </h4>
          <button
            type="button"
            onClick={copyRecord}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary transition-colors cursor-pointer"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copié !' : 'Copier l’enregistrement'}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="dns-domain-input" className="block text-xs font-semibold text-muted-foreground">
              Nom de domaine / Hôte
            </label>
            <input
              id="dns-domain-input"
              type="text"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-1.5 font-mono text-xs font-semibold text-foreground focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="dns-record-type-select" className="block text-xs font-semibold text-muted-foreground">
              Type d&apos;enregistrement
            </label>
            <select
              id="dns-record-type-select"
              value={recordType}
              onChange={(e) => setRecordType(e.target.value as 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SPF')}
              className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
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
            <label htmlFor="dns-record-value-input" className="block text-xs font-semibold text-muted-foreground">
              Cible / Valeur
            </label>
            <input
              id="dns-record-value-input"
              type="text"
              value={recordValue}
              onChange={(e) => setRecordValue(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-1.5 font-mono text-xs font-semibold text-foreground focus:outline-none dark:border-border dark:bg-surface-sunken dark:text-white"
            />
          </div>
        </div>

        <div className="rounded-xl bg-surface-sunken p-4 font-mono text-xs text-primary font-bold overflow-x-auto">
          {generatedRecord}
        </div>
      </div>
    </div>
  );
}
