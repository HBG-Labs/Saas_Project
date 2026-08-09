import { Copy, Network } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

import { computeSubnet } from './compute';

export default function SubnetCalculatorTool() {
  const [ipAddress, setIpAddress] = useState('192.168.10.0');
  const [cidr, setCidr] = useState(24);
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () => computeSubnet({ ipAddress: ipAddress.trim() || '192.168.1.0', cidr }),
    [ipAddress, cidr],
  );

  const handleCopy = () => {
    const summary = `Sous-réseau IP : ${result.networkAddress}/${result.cidr} | Masque: ${result.netmask} | Hôtes utiles: ${result.usableHosts} (${result.firstUsableIp} -> ${result.lastUsableIp})`;
    void navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="size-5 text-accent" />
            Paramètres d&apos;adressage IP & Masque CIDR
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input
                label="Adresse IPv4"
                placeholder="ex: 192.168.1.0"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="text-foreground text-xs font-semibold block mb-1.5">
                Masque CIDR (/{cidr})
              </label>
              <select
                value={cidr}
                onChange={(e) => setCidr(parseInt(e.target.value, 10))}
                className="bg-surface border-border/80 text-foreground h-9 w-full rounded-md border px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-ring"
              >
                {Array.from({ length: 23 }, (_, i) => i + 8).map((mask) => (
                  <option key={mask} value={mask}>
                    /{mask} ({Math.pow(2, 32 - mask) - 2 > 0 ? Math.pow(2, 32 - mask) - 2 : 0} hôtes)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-surface-sunken rounded-xl p-4 border border-border/60 space-y-3">
            <span className="text-subtle-foreground text-2xs font-semibold uppercase tracking-wider block">
              Structure du masque binaire
            </span>
            <div className="font-mono text-xs text-primary font-medium tracking-widest break-all">
              {result.binaryNetmask}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-sunken/60 border-border/80 flex flex-col justify-between">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Plage d&apos;Adresses IP</CardTitle>
            <Badge variant="info" className="font-mono text-2xs">
              /{cidr}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-surface rounded-xl p-4 border border-border/60">
            <span className="text-subtle-foreground text-2xs font-semibold uppercase tracking-wider block">
              Hôtes exploitables
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-4xl font-extrabold text-foreground tabular-nums">
                {result.usableHosts}
              </span>
              <span className="text-muted-foreground text-sm font-semibold">IPs libres</span>
            </div>
          </div>

          <div className="space-y-2 text-xs border-t border-border/40 pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Réseau :</span>
              <span className="font-mono font-medium text-foreground">{result.networkAddress}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Masque :</span>
              <span className="font-mono font-medium text-foreground">{result.netmask}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Broadcast :</span>
              <span className="font-mono font-medium text-foreground">{result.broadcastAddress}</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Première IP :</span>
              <span className="font-mono font-medium text-primary">{result.firstUsableIp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dernière IP :</span>
              <span className="font-mono font-medium text-primary">{result.lastUsableIp}</span>
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full mt-4" onClick={handleCopy}>
            <Copy className="size-3.5 mr-1.5" />
            {copied ? 'Plage copiée !' : 'Copier la plage IP'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
