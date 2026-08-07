import { ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import { Section } from './Section';

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <Section
      id="tarifs"
      eyebrow="Tarifs & Offres"
      title="Des formules adaptées à chaque professionnel"
      description="Découvrez nos offres transparentes et sans engagement. Accès gratuit permanent pour tester la plateforme."
      centered
    >
      {/* Sélecteur annuel / mensuel */}
      <div className="mb-10 flex items-center justify-center gap-3">
        <span className={`text-xs font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Mensuel
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isAnnual}
          onClick={() => setIsAnnual(!isAnnual)}
          className="bg-surface-sunken border-border relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-primary shadow-sm transform transition duration-200 ease-in-out ${
              isAnnual ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-xs font-medium flex items-center gap-1.5 ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
          <span>Annuel</span>
          <Badge variant="primary" className="text-2xs py-0 px-1.5">
            -17 %
          </Badge>
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PRICING_PLANS.map((plan) => {
          const displayPrice = isAnnual ? plan.priceAnnualMonthly : plan.priceMonthly;

          return (
            <div
              key={plan.id}
              className={cn(
                'bg-surface relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200',
                plan.popular
                  ? 'border-primary/50 shadow-modal glow-primary lg:scale-[1.03]'
                  : 'border-border/70 shadow-raised hover:border-border-strong',
              )}
            >
              {plan.popular ? (
                <Badge variant="primary" className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-sm py-0.5 px-3">
                  Recommandé
                </Badge>
              ) : null}

              <div>
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="text-muted-foreground mt-1 text-xs">{plan.tagline}</p>

                <div className="mt-4 border-t border-border/40 pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-extrabold text-foreground tabular-nums">
                      {displayPrice === 0 ? '0 €' : `${displayPrice.toFixed(2)} €`}
                    </span>
                    {displayPrice > 0 && <span className="text-muted-foreground text-xs font-medium">/ mois</span>}
                  </div>
                  <p className="text-subtle-foreground text-2xs mt-1">
                    {plan.id === 'free' ? 'Gratuit sans limitation de durée' : isAnnual ? 'Facturation annuelle' : 'Facturation mensuelle sans engagement'}
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5 text-xs">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-foreground">
                      <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-border/40">
                <Button
                  asChild
                  variant={plan.popular ? 'primary' : 'outline'}
                  size="lg"
                  className="w-full"
                >
                  <Link to={ROUTES.pricing}>
                    {plan.ctaText}
                    <ArrowRight className="size-4 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
