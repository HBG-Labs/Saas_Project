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
    <Card className="border-primary/30 bg-gradient-to-br from-surface via-surface to-primary/5 shadow-raised overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* En-tête compact */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="primary" className="gap-1 text-3xs py-0.5 px-2 uppercase font-bold tracking-wide">
              <Calculator className="size-3" />
              Simulateur
            </Badge>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Estimez votre tarif sur-mesure (1 à 100 utilisateurs)
            </h3>
          </div>

          {/* Raccourcis ultra-compacts */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            <span className="text-3xs text-muted-foreground mr-1 hidden sm:inline">Paliers :</span>
            {presets.map((preset) => (
              <button
                key={preset.count}
                type="button"
                onClick={() => setUsersCount(preset.count)}
                className={`min-h-touch sm:min-h-0 inline-flex items-center justify-center text-3xs px-2 py-1 rounded-md border font-medium transition-all cursor-pointer ${
                  usersCount === preset.count
                    ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                    : 'bg-surface border-border/60 text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Corps du simulateur — Grille compacte */}
        <div className="grid gap-4 lg:grid-cols-12 items-center">
          {/* Curseur et détails */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="compact-team-slider" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-primary" />
                Nombre d&apos;utilisateurs :
              </label>

              {/* Sélecteur pas à pas */}
              <div className="flex items-center gap-1 bg-surface-sunken border border-border/80 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUsersCount((c) => Math.max(1, c - 1))}
                  disabled={usersCount <= 1}
                  className="size-touch sm:size-6 rounded bg-surface flex items-center justify-center text-foreground hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  aria-label="Diminuer"
                >
                  <Minus className="size-3" />
                </button>

                <span className="font-mono text-xs font-extrabold text-primary px-2 min-w-[60px] text-center tabular-nums">
                  {usersCount} {usersCount > 1 ? 'users' : 'user'}
                </span>

                <button
                  type="button"
                  onClick={() => setUsersCount((c) => Math.min(100, c + 1))}
                  disabled={usersCount >= 100}
                  className="size-touch sm:size-6 rounded bg-surface flex items-center justify-center text-foreground hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  aria-label="Augmenter"
                >
                  <Plus className="size-3" />
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
              onChange={(e) => setUsersCount(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-surface-sunken rounded-lg appearance-none cursor-pointer accent-primary"
            />

            <div className="flex justify-between text-3xs text-muted-foreground font-mono">
              <span>1 (Free)</span>
              <span>2 (Starter)</span>
              <span>5 (Pro)</span>
              <span>10 (Business)</span>
              <span>20 (Enterprise)</span>
              <span>50</span>
              <span>100</span>
            </div>

            {/* Ligne récapitulative compacte */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-surface-sunken/80 border border-border/60 text-2xs">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <CheckCircle2 className="size-3 text-success shrink-0" />
                Formule conseillée : <strong className="text-primary">{optimalTier.name}</strong> ({optimalTier.includedUsers} inclus)
              </span>

              <span className="text-muted-foreground font-mono">
                {extraUsers > 0 && optimalTier.additionalUserPriceMonthly > 0 ? (
                  <span>
                    Base {optimalTier.priceMonthly}€ + {extraUsers} supp. (+{extraCostMonthly}€)
                  </span>
                ) : (
                  <span>Forfait complet (aucun supplément)</span>
                )}
              </span>
            </div>
          </div>

          {/* Résultat et action */}
          <div className="lg:col-span-5 bg-surface border border-border/80 rounded-xl p-3.5 shadow-xs flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-3xs uppercase font-bold tracking-wider text-muted-foreground block">
                Total estimé
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-foreground font-mono tabular-nums">
                  {activePrice === 0 ? '0 €' : `${activePrice} €`}
                </span>
                <span className="text-2xs text-muted-foreground font-medium">/ mois</span>
              </div>
              <p className="text-3xs text-muted-foreground">
                Soit <strong className="text-foreground">{costPerUser} €</strong> / user / mois
              </p>
            </div>

            <Button asChild variant="primary" className="font-bold text-xs h-9 px-4 shrink-0 shadow-sm">
              <Link to={`${ROUTES.register}?plan=${optimalTier.id}`}>
                {optimalTier.id === 'free' ? 'Créer un compte' : `Choisir ${optimalTier.name}`}
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
