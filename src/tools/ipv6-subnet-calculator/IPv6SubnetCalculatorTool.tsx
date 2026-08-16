import { Check, Copy, Cpu, Globe, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

function expandIPv6(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Handle IPv4-mapped or basic IPv6
  let ipStr = trimmed;
  if (ipStr.includes('/')) {
    ipStr = ipStr.split('/')[0] ?? '';
  }

  const parts = ipStr.split('::');
  if (parts.length > 2) return null; // Invalid multiple ::

  let firstHextets: string[] = [];
  let lastHextets: string[] = [];

  if (parts[0]) {
    firstHextets = parts[0].split(':').filter(Boolean);
  }
  if (parts[1]) {
    lastHextets = parts[1].split(':').filter(Boolean);
  }

  const missingCount = 8 - (firstHextets.length + lastHextets.length);
  if (missingCount < 0 && parts.length === 2) return null;
  if (parts.length === 1 && firstHextets.length !== 8) return null;

  const middleHextets: string[] = Array.from({ length: Math.max(0, missingCount) }, () => '0000');
  const fullArray: string[] = [...firstHextets, ...middleHextets, ...lastHextets];

  if (fullArray.length !== 8) return null;

  const padded: (string | null)[] = fullArray.map((hex: string): string | null => {
    if (!/^[0-9a-f]{1,4}$/.test(hex)) return null;
    return hex.padStart(4, '0');
  });

  if (padded.includes(null)) return null;

  return (padded as string[]).join(':');
}

function compressIPv6(expanded: string): string {
  const hextets = expanded.split(':').map((h) => parseInt(h, 16).toString(16));

  // Find longest zero run
  let bestStart = -1;
  let bestLen = 0;
  let currentStart = -1;
  let currentLen = 0;

  for (let i = 0; i < hextets.length; i++) {
    if (hextets[i] === '0') {
      if (currentStart === -1) currentStart = i;
      currentLen++;
      if (currentLen > bestLen) {
        bestLen = currentLen;
        bestStart = currentStart;
      }
    } else {
      currentStart = -1;
      currentLen = 0;
    }
  }

  if (bestLen > 1) {
    const before = hextets.slice(0, bestStart).join(':');
    const after = hextets.slice(bestStart + bestLen).join(':');
    return `${before}::${after}`;
  }

  return hextets.join(':');
}

function classifyIPv6(expanded: string): { type: string; description: string; scope: string } {
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') {
    return { type: 'Unspecified (::)', description: 'Adresse non spécifiée (0.0.0.0 equivalent)', scope: 'Système' };
  }
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') {
    return { type: 'Loopback (::1)', description: 'Adresse de bouclage local (127.0.0.1 equivalent)', scope: 'Hôte local' };
  }

  const firstHextet = parseInt(expanded.split(':')[0] ?? '', 16);

  if ((firstHextet & 0xff00) === 0xff00) {
    return { type: 'Multicast (ff00::/8)', description: 'Adresse de diffusion groupe (Multicast)', scope: 'Variable (Site/Global)' };
  }
  if ((firstHextet & 0xfe80) === 0xfe80) {
    return { type: 'Link-Local (fe80::/10)', description: 'Adresse locale au segment réseau (non routable)', scope: 'Lien local (LAN)' };
  }
  if ((firstHextet & 0xfc00) === 0xfc00 || (firstHextet & 0xfd00) === 0xfd00) {
    return { type: 'Unique Local (fc00::/7)', description: 'Adresse privée d’entreprise (RFC 4193)', scope: 'Réseau privé (ULA)' };
  }
  if ((firstHextet & 0x2000) === 0x2000) {
    return { type: 'Global Unicast (2000::/3)', description: 'Adresse publique routable sur Internet', scope: 'Internet / Global' };
  }

  return { type: 'Unicast réservé', description: 'Adresse réservée par l’IANA', scope: 'Spécial' };
}

function macToEUI64(macInput: string): string | null {
  const clean = macInput.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length !== 12) return null;

  const octets = clean.match(/.{1,2}/g);
  if (!octets || octets.length !== 6) return null;

  // Flip 7th bit of 1st octet (universal/local bit)
  const firstByte = parseInt(octets[0] ?? '', 16) ^ 0x02;
  const firstHex = firstByte.toString(16).padStart(2, '0');

  // Insert FF-FE in middle (between octet 3 and 4)
  const eui64Parts = [
    firstHex + (octets[1] ?? ''),
    (octets[2] ?? '') + 'ff',
    'fe' + (octets[3] ?? ''),
    (octets[4] ?? '') + (octets[5] ?? ''),
  ];

  return `fe80::${eui64Parts.join(':')}`;
}

export default function IPv6SubnetCalculatorTool() {
  const [ipv6Input, setIpv6Input] = useState<string>('2001:db8:85a3::8a2e:370:7334');
  const [prefixLength, setPrefixLength] = useState<number>(64);
  const [macInput, setMacInput] = useState<string>('00:1A:2B:3C:4D:5E');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const expanded = useMemo(() => expandIPv6(ipv6Input), [ipv6Input]);
  const compressed = useMemo(() => (expanded ? compressIPv6(expanded) : null), [expanded]);
  const classification = useMemo(() => (expanded ? classifyIPv6(expanded) : null), [expanded]);

  const networkPrefix = useMemo(() => {
    if (!expanded) return null;
    const bits = expanded.split(':').map((h) => parseInt(h, 16));

    const maskBit = prefixLength;
    const resultHextets: string[] = [];

    for (let i = 0; i < 8; i++) {
      const bitStart = i * 16;
      const bitEnd = (i + 1) * 16;

      if (maskBit >= bitEnd) {
        resultHextets.push((bits[i] ?? 0).toString(16).padStart(4, '0'));
      } else if (maskBit <= bitStart) {
        resultHextets.push('0000');
      } else {
        const remainingBits = maskBit - bitStart;
        const mask = (0xffff << (16 - remainingBits)) & 0xffff;
        resultHextets.push(((bits[i] ?? 0) & mask).toString(16).padStart(4, '0'));
      }
    }

    const netExpanded = resultHextets.join(':');
    return compressIPv6(netExpanded);
  }, [expanded, prefixLength]);

  const eui64Result = useMemo(() => macToEUI64(macInput), [macInput]);

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ------------------- FORMULAIRE DE SAISIE */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Globe className="size-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Analyseur IPv6 & Préfixe</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="ipv6-addr-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Adresse IPv6 (Abrégée ou complète)
            </label>
            <input
              id="ipv6-addr-input"
              type="text"
              value={ipv6Input}
              onChange={(e) => setIpv6Input(e.target.value)}
              placeholder="ex: 2001:db8::1 ou fe80::1"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ipv6-prefix-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Longueur du préfixe (CIDR /N)
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-500">/</span>
              <input
                id="ipv6-prefix-input"
                type="number"
                min="0"
                max="128"
                value={prefixLength}
                onChange={(e) => setPrefixLength(Math.min(128, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------- RÉSULTATS IPV6 */}
      {expanded ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Forme Compressée (RFC 5952) */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Forme Canonique Compressée (RFC 5952)</span>
                <button
                  type="button"
                  onClick={() => compressed && copyToClipboard(`${compressed}/${prefixLength}`, 'compressed')}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                >
                  {copiedField === 'compressed' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copier
                </button>
              </div>
              <p className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 break-all">
                {compressed}/{prefixLength}
              </p>
            </div>

            {/* Forme Développement Complète */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Forme Développée (8 Hextets)</span>
                <button
                  type="button"
                  onClick={() => expanded && copyToClipboard(expanded, 'expanded')}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                >
                  {copiedField === 'expanded' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copier
                </button>
              </div>
              <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 break-all">
                {expanded}
              </p>
            </div>
          </div>

          {/* Analyse & Type d'Adresse */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-2">
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Classification & Type d&apos;Adresse
              </span>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {classification?.type}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {classification?.description} · Portée : <strong>{classification?.scope}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-2">
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Adresse Réseau de Sous-réseau
              </span>
              <p className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 break-all">
                {networkPrefix}/{prefixLength}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Espace total : 2<sup>{128 - prefixLength}</sup> adresses d&apos;hôtes.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-50/50 p-4 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          ⚠️ Veuillez saisir une adresse IPv6 valide (ex: 2001:db8::1 ou fe80::1).
        </div>
      )}

      {/* ------------------- MODULE SECONDAIRE : MAC VERS EUI-64 */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Cpu className="size-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Générateur d&apos;Adresse EUI-64 (MAC vers IPv6 Link-Local)
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 items-end">
          <div className="space-y-1.5">
            <label htmlFor="ipv6-eui-mac-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Adresse MAC du matériel (48 bits)
            </label>
            <input
              id="ipv6-eui-mac-input"
              type="text"
              value={macInput}
              onChange={(e) => setMacInput(e.target.value)}
              placeholder="ex: 00:1A:2B:3C:4D:5E"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            {eui64Result ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3 dark:bg-emerald-950/20 space-y-1">
                <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Adresse Link-Local EUI-64 Générée :
                </span>
                <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {eui64Result}
                </p>
              </div>
            ) : (
              <span className="text-xs text-rose-500">Adresse MAC invalide (format 12 caractères hex).</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
