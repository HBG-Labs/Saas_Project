import { ArrowRight, Calculator, CheckCircle2, Minus, Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { computeSubscriptionPrice, PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';

export function PricingSimulator() {
  const [usersCount, setUsersCount] = useState<number>(5);

  const optimalTier = useMemo(() => {
    if (usersCount <= 1) return PRICING_PLANS.find((p) => p.id === 'free') ?? PRICING_PLANS[0]!;
    if (usersCount <= 4) return PRICING_PLANS.find((p) => p.id === 'starter') ?? PRICING_PLANS[1]!;
    if (usersCount <= 9) return PRICING_PLANS.find((p) => p.id === 'pro') ?? PRICING_PLANS[2]!;
    if (usersCount <= 19) return PRICING_PLANS.find((p) => p.id === 'business') ?? PRICING_PLANS[3]!;
    return PRICING_PLANS.find((p) => p.id === 'enterprise') ?? PRICING_PLANS[4]!;
  }, [usersCount]);

  const activePrice = computeSubscriptionPrice(optimalTier.id, usersCount);

  const extraUsers = Math.max(0, usersCount - optimalTier.includedUsers);
  const extraCostMonthly = extraUsers * optimalTier.additionalUserPriceMonthly;
  const costPerUser = usersCount > 0 ? (activePrice / usersCount).toFixed(2).replace('.00', '') : '0';

  const presets = [
    { label: '1 (Free)', count: 1 },
    { label: '2 (Starter)', count: 2 },
    { label: '5 (Pro)', count: 5 },
    { label: '10 (Business)', count: 10 },
    { label: '20 (Enterprise)', count: 20 },
    { label: '50', count: 50 },
    { label: '100', count: 100 },
  ];

  return (
    <Card className="overflow-hidden border-primary/30 bg-surface shadow-overlay">
      <CardContent className="space-y-8 p-5 sm:p-8">
        <div className="grid gap-5 border-b border-border pb-7 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Badge variant="primary" className="mb-3 px-3 py-1 font-bold tracking-wide uppercase">
              <Calculator className="size-3.5" aria-hidden="true" />
              Simulateur d’équipe
            </Badge>
            <h3 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
              Combien de personnes utiliseront REZO360 ?
            </h3>
            <p className="mt-3 text-base text-muted-foreground">
              Déplacez le curseur : la formule conseillée et le prix total se mettent à jour.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:col-span-5 lg:justify-end" aria-label="Tailles d’équipe fréquentes">
            {presets.map((preset) => (
              <button
                key={preset.count}
                type="button"
                onClick={() => setUsersCount(preset.count)}
                className={`inline-flex min-h-touch items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors ${
                  usersCount === preset.count
                    ? 'border-primary bg-primary text-primary-foreground shadow-raised'
                    : 'border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
                aria-pressed={usersCount === preset.count}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-5 lg:col-span-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="compact-team-slider" className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Users className="size-5 text-primary" aria-hidden="true" />
                Taille de l’équipe
              </label>

              <div className="flex w-fit items-center gap-1 rounded-xl border border-border bg-surface-sunken p-1">
                <button
                  type="button"
                  onClick={() => setUsersCount((count) => Math.max(1, count - 1))}
                  disabled={usersCount <= 1}
                  className="flex size-touch items-center justify-center rounded-lg bg-surface text-foreground shadow-xs transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Diminuer le nombre d’utilisateurs"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <output htmlFor="compact-team-slider" className="min-w-28 px-3 text-center font-mono text-lg font-bold text-primary tabular-nums">
                  {usersCount} {usersCount > 1 ? 'utilisateurs' : 'utilisateur'}
                </output>
                <button
                  type="button"
                  onClick={() => setUsersCount((count) => Math.min(100, count + 1))}
                  disabled={usersCount >= 100}
                  className="flex size-touch items-center justify-center rounded-lg bg-surface text-foreground shadow-xs transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Augmenter le nombre d’utilisateurs"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <input
              id="compact-team-slider"
              type="range"
              min="1"
              max="100"
              step="1"
              value={usersCount}
              onChange={(event) => setUsersCount(parseInt(event.target.value, 10))}
              className="h-3 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-primary"
            />
            <div className="flex justify-between font-mono text-xs text-muted-foreground" aria-hidden="true">
              <span>1</span>
              <span>20</span>
              <span>50</span>
              <span>100</span>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary-subtle p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
                Formule conseillée : <strong className="text-primary">{optimalTier.name}</strong>
              </span>
              <span className="text-muted-foreground">
                {extraUsers > 0 && optimalTier.additionalUserPriceMonthly > 0
                  ? `${extraUsers} siège${extraUsers > 1 ? 's' : ''} supplémentaire${extraUsers > 1 ? 's' : ''} · +${extraCostMonthly} €`
                  : `${optimalTier.includedUsers} siège${optimalTier.includedUsers > 1 ? 's' : ''} inclus`}
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-brand-night p-6 text-white shadow-modal lg:col-span-5 sm:p-8">
            <span className="text-sm font-semibold tracking-wider text-cyan-100 uppercase">Total mensuel estimé</span>
            <div className="mt-3 flex items-end gap-2">
              <span className="font-display text-5xl font-bold tracking-tight tabular-nums">
                {activePrice} €
              </span>
              <span className="pb-1 text-base text-blue-100">/ mois</span>
            </div>
            <p className="mt-3 text-sm text-blue-100">
              Soit <strong className="text-white">{costPerUser} €</strong> par utilisateur et par mois.
            </p>
            <Button
              asChild
              className="mt-6 min-h-touch w-full border-signal-lime bg-signal-lime text-brand-night hover:border-white hover:bg-white"
            >
              <Link to={`${ROUTES.register}?plan=${optimalTier.id}`}>
                {optimalTier.id === 'free' ? 'Créer un compte' : `Choisir ${optimalTier.name}`}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
