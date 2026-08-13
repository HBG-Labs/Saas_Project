import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { type BillingInterval, PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';

export function Pricing() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('annual');

  return (
    <section className="border-t border-border/80 bg-surface-sunken/40 py-20 dark:bg-slate-950 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3">
          <Badge variant="primary" className="text-2xs uppercase tracking-wider">
            Tarifs simples et transparents
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Une formule adaptée à tous vos projets
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Commencez gratuitement sans carte bancaire et évoluez à tout moment sans engagement.
          </p>

          {/* Sélecteur Facturation Mensuelle / Annuelle */}
          <div className="mt-8 flex justify-center">
            <div className="bg-surface-sunken border-border/80 flex items-center rounded-xl border p-1">
              <button
                type="button"
                onClick={() => setBillingInterval('monthly')}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  billingInterval === 'monthly'
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Facturation mensuelle
              </button>

              <button
                type="button"
                onClick={() => setBillingInterval('annual')}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  billingInterval === 'annual'
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Facturation annuelle</span>
                <Badge variant="primary" className="text-2xs py-0 px-1.5">
                  -20 %
                </Badge>
              </button>
            </div>
          </div>
        </div>

        {/* Grille des Cartes Tarifaires — 4 Formules */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PRICING_PLANS.map((tier) => {
            const isAnnual = billingInterval === 'annual';
            const displayPrice = isAnnual ? tier.priceAnnualMonthly : tier.priceMonthly;

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col justify-between transition-all duration-200 ${
                  tier.popular
                    ? 'border-primary/50 shadow-modal glow-primary bg-surface'
                    : 'hover:border-border-strong bg-surface'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge variant="primary" className="gap-1 shadow-sm py-0.5 px-3.5 text-2xs font-extrabold uppercase">
                      <Sparkles className="size-3" />
                      Le plus populaire
                    </Badge>
                  </div>
                )}

                <div>
                  <CardHeader className="pt-6">
                    <Badge variant="neutral" className="w-fit text-2xs mb-2">
                      {tier.badge}
                    </Badge>
                    <CardTitle className="text-xl">{tier.name}</CardTitle>
                    <p className="text-muted-foreground text-xs mt-1">{tier.tagline}</p>

                    <div className="mt-4 border-t border-border/40 pt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-3xl font-extrabold text-foreground tabular-nums">
                          {displayPrice === 0 ? '0 €' : `${displayPrice % 1 === 0 ? displayPrice : displayPrice.toFixed(2)} €`}
                        </span>
                        {displayPrice > 0 && <span className="text-muted-foreground text-xs font-medium">/ mois</span>}
                      </div>
                      <p className="text-subtle-foreground text-2xs mt-1">
                        {tier.id === 'free'
                          ? 'Accès gratuit permanent'
                          : isAnnual
                            ? `Facturé ${tier.priceAnnualTotal} € par an`
                            : 'Facturé mensuellement sans engagement'}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="mt-2 space-y-3">
                    <p className="text-subtle-foreground text-2xs font-semibold uppercase tracking-wider">
                      Inclus dans cette offre :
                    </p>
                    <ul className="space-y-2.5 text-xs">
                      {tier.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-foreground">
                          <Check className={`size-4 shrink-0 mt-0.5 ${feat.startsWith('❌') ? 'text-rose-500' : 'text-primary'}`} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-6 pt-0">
                  <Button
                    asChild
                    variant={tier.id === 'business' || tier.id === 'ultimate' ? 'primary' : tier.ctaVariant}
                    className={`w-full font-bold cursor-pointer ${
                      tier.id === 'ultimate'
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
                        : tier.id === 'business'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                          : tier.id === 'pro'
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                            : ''
                    }`}
                  >
                    <Link to={tier.ctaLink ?? ROUTES.register}>
                      {tier.ctaText}
                      <ArrowRight className="size-4 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          🔒 Paiements sécurisés par Stripe • Formules sans engagement • Annulation en 1 clic
        </div>
      </div>
    </section>
  );
}
