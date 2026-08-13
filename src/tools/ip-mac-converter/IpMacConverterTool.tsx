import { Check, Copy, Cpu, Network, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';

function ipToLong(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const n = parseInt(parts[i] ?? '', 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    num = (num << 8) + n;
  }
  return num >>> 0;
}

function longToIp(long: number): string {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255,
  ].join('.');
}

function cidrToSubnetMask(cidr: number): string {
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return longToIp(mask);
}

function formatBinaryIp(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const bin = parts.map((p) => {
    const n = parseInt(p, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    return n.toString(2).padStart(8, '0');
  });
  if (bin.includes(null)) return null;
  return bin.join('.');
}

function formatHexIp(ip: string): string | null {
  const long = ipToLong(ip);
  if (long === null) return null;
  return `0x${long.toString(16).toUpperCase().padStart(8, '0')}`;
}

function normalizeMac(mac: string): {
  colon: string;
  hyphen: string;
  cisco: string;
  raw: string;
} | null {
  const clean = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (clean.length !== 12) return null;

  const pairs = clean.match(/.{1,2}/g)!;
  const quads = clean.match(/.{1,4}/g)!;

  return {
    colon: pairs.join(':'),
    hyphen: pairs.join('-'),
    cisco: quads.join('.').toLowerCase(),
    raw: clean,
  };
}

function multicastIpToMac(ip: string): string | null {
  const long = ipToLong(ip);
  if (long === null) return null;

  // Check if Multicast IP (224.0.0.0 to 239.255.255.255 -> 0xE0000000 to 0xEFFFFFFF)
  const firstOctet = (long >>> 24) & 255;
  if (firstOctet < 224 || firstOctet > 239) return null;

  // Low 23 bits of IP inserted into 01-00-5E-00-00-00
  const macLow23 = long & 0x7fffff;
  const macLong = 0x01005e000000 | macLow23;

  const hexStr = macLong.toString(16).padStart(12, '0');
  const pairs = hexStr.match(/.{1,2}/g)!;
  return pairs.join(':').toUpperCase();
}

export default function IpMacConverterTool() {
  const [ipInput, setIpInput] = useState<string>('192.168.1.0');
  const [cidrPrefix, setCidrPrefix] = useState<number>(24);
  const [macInput, setMacInput] = useState<string>('001a2b3c4d5e');
  const [multicastIpInput, setMulticastIpInput] = useState<string>('239.255.255.250');

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Computations
  const subnetMask = useMemo(() => cidrToSubnetMask(cidrPrefix), [cidrPrefix]);
  const wildcardMask = useMemo(() => {
    const maskLong = ipToLong(subnetMask);
    if (maskLong === null) return '0.0.0.255';
    const wildcardLong = (~maskLong) >>> 0;
    return longToIp(wildcardLong);
  }, [subnetMask]);

  const binaryIp = useMemo(() => formatBinaryIp(ipInput), [ipInput]);
  const hexIp = useMemo(() => formatHexIp(ipInput), [ipInput]);

  const macFormats = useMemo(() => normalizeMac(macInput), [macInput]);
  const macMulticast = useMemo(() => multicastIpToMac(multicastIpInput), [multicastIpInput]);

  const ciscoAclCommand = useMemo(() => {
    return `access-list 10 permit ${ipInput} ${wildcardMask}`;
  }, [ipInput, wildcardMask]);

  const copyText = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ------------------- MODULE 1 : WILDCARD MASK & CISCO ACL */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Terminal className="size-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Calculateur de Masque Wildcard (Cisco ACL & OSPF)
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Adresse IP de réseau
            </label>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="ex: 192.168.1.0"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Masque / Notation CIDR
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-500">/</span>
              <input
                type="number"
                min="0"
                max="32"
                value={cidrPrefix}
                onChange={(e) => setCidrPrefix(Math.min(32, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Masque de sous-réseau calculé
            </label>
            <input
              type="text"
              readOnly
              value={subnetMask}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 font-mono text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
            />
          </div>
        </div>

        {/* Résultats Wildcard */}
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 p-4 dark:bg-blue-950/20 space-y-1">
            <span className="block text-xs font-bold text-blue-600 dark:text-blue-400">
              Masque Wildcard d&apos;Inversion (Cisco / OSPF)
            </span>
            <p className="font-mono text-lg font-black text-slate-900 dark:text-white">
              {wildcardMask}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Formule : 255.255.255.255 - SubnetMask ({subnetMask})
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-950 p-4 text-white space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">Commande Cisco ACL générée :</span>
              <button
                type="button"
                onClick={() => copyText(ciscoAclCommand, 'acl')}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              >
                {copiedField === 'acl' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copier
              </button>
            </div>
            <code className="block font-mono text-xs text-blue-400 font-bold">
              {ciscoAclCommand}
            </code>
          </div>
        </div>

        {/* Représentation Binaire / Hexadécimale */}
        {binaryIp && (
          <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Représentation Binaire IP (32 Bits) :
              </span>
              <code className="block font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {binaryIp}
              </code>
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Représentation Hexadécimale IP :
              </span>
              <code className="block font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                {hexIp}
              </code>
            </div>
          </div>
        )}
      </div>

      {/* ------------------- MODULE 2 : NORMALISATEUR MAC */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Cpu className="size-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Normaliseur & Formateur d&apos;Adresse MAC
          </h3>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Saisissez une adresse MAC (n&apos;importe quel format)
          </label>
          <input
            type="text"
            value={macInput}
            onChange={(e) => setMacInput(e.target.value)}
            placeholder="ex: 001a2b3c4d5e ou 00:1A:2B:3C:4D:5E"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />

          {macFormats ? (
            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Format Deux-Points (Standard)</span>
                <code className="mt-1 block font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {macFormats.colon}
                </code>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Format Cisco (Point Quad)</span>
                <code className="mt-1 block font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {macFormats.cisco}
                </code>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Format Tirés (Windows)</span>
                <code className="mt-1 block font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {macFormats.hyphen}
                </code>
              </div>
            </div>
          ) : (
            <p className="text-xs text-rose-500">
              Veuillez saisir une adresse MAC valide à 12 caractères hexadécimaux.
            </p>
          )}
        </div>
      </div>

      {/* ------------------- MODULE 3 : MULTICAST IP VERS MAC MULTICAST */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Network className="size-5 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Mapping IP Multicast vers MAC Multicast (IEEE 802.3)
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 items-end">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Adresse IP Multicast de Classe D (224.0.0.0 – 239.255.255.255)
            </label>
            <input
              type="text"
              value={multicastIpInput}
              onChange={(e) => setMulticastIpInput(e.target.value)}
              placeholder="ex: 224.0.0.5 (OSPF) ou 239.255.255.250 (UPnP)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            {macMulticast ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 p-3 dark:bg-amber-950/20 space-y-1">
                <span className="block text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  Adresse MAC Ethernet Multicast correspondante :
                </span>
                <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {macMulticast}
                </p>
              </div>
            ) : (
              <span className="text-xs text-rose-500">
                L&apos;IP doit appartenir au bloc Multicast (224.0.0.0 à 239.255.255.255).
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
