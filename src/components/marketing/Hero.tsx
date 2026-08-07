import { ArrowRight, Cable, Calculator, Network, Zap } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { ROUTES } from '@/config/routes';

const PREVIEW_TOOLS = [
  { icon: Cable, label: 'Bilan optique', value: '−18,4', unit: 'dB' },
  { icon: Network, label: 'Sous-réseau /26', value: '62', unit: 'hôtes' },
  { icon: Zap, label: "Loi d'Ohm", value: '4,8', unit: 'A' },
  { icon: Calculator, label: 'dBm → mW', value: '15,8', unit: 'mW' },
] as const;

/**
 * Section d'ouverture.
 *
 * L'aperçu à droite montre des VALEURS, pas une capture d'écran générique :
 * pour un public technique, voir un résultat de calcul plausible communique
 * mieux la proposition de valeur qu'une illustration abstraite.
 *
 * Ces valeurs sont illustratives et figées — ce n'est pas un outil fonctionnel.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
      {/* Dégradé décoratif, masqué aux lecteurs d'écran. */}
      <div
        aria-hidden="true"
        className="from-primary-subtle pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b to-transparent opacity-60"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <Badge variant="primary" className="mb-5">
            Phase de construction — nouveaux outils chaque mois
          </Badge>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            La boîte à outils des <span className="text-primary">professionnels techniques</span>
          </h1>

          <p className="text-muted-foreground mt-6 max-w-xl text-lg">
            Calculs de fibre optique, sous-réseaux IPv4, lois de l&apos;électricité et conversions
            d&apos;unités. Des outils précis, rapides, utilisables sur le terrain comme au bureau.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to={ROUTES.register}>
                Créer un compte gratuit
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={ROUTES.tools}>Explorer les outils</Link>
            </Button>
          </div>

          <p className="text-subtle-foreground mt-6 flex flex-wrap items-center gap-1.5 text-xs">
            Astuce : <Kbd>⌘</Kbd> <Kbd>K</Kbd> ouvre la recherche depuis n&apos;importe où.
          </p>
        </div>

        {/* ------------------------------------------------------- aperçu */}
        <div className="relative">
          <div className="bg-surface border-border shadow-modal rounded-xl border p-5">
            <div className="border-border mb-4 flex items-center gap-2 border-b pb-3">
              <span className="bg-error size-2.5 rounded-full" aria-hidden="true" />
              <span className="bg-warning size-2.5 rounded-full" aria-hidden="true" />
              <span className="bg-success size-2.5 rounded-full" aria-hidden="true" />
              <span className="text-subtle-foreground ml-2 text-xs">Aperçu du tableau de bord</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {PREVIEW_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div key={tool.label} className="bg-surface-sunken rounded-lg p-3">
                    <Icon className="text-primary size-4" aria-hidden="true" />
                    <p className="text-subtle-foreground text-2xs mt-2">{tool.label}</p>
                    <p className="mt-0.5 flex items-baseline gap-1">
                      <span className="font-mono text-xl font-semibold tabular-nums">
                        {tool.value}
                      </span>
                      <span className="text-muted-foreground text-xs">{tool.unit}</span>
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="text-subtle-foreground text-2xs mt-4">Valeurs d&apos;illustration.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
