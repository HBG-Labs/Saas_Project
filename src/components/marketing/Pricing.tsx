import { ArrowRight, Check, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

const DECISIVE_FEATURE_COUNT = 4;

export function Pricing() {
  return (
    <section className="bg-surface py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Badge variant="primary" className="mb-4">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Cinq formules, un même outil
            </Badge>
            <h2 className="text-4xl leading-tight font-bold text-balance text-foreground sm:text-5xl">
              Commencez au bon niveau. Gardez le même cockpit.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-base leading-relaxed text-muted-foreground">
              Chaque formule suit la taille de l’équipe et les fonctions nécessaires. La facturation
              reste mensuelle, sans engagement.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PRICING_PLANS.map((tier) => (
            <Card
              key={tier.id}
              className={cn(
                'relative flex min-h-full flex-col overflow-visible p-5',
                tier.popular
                  ? 'border-brand-night bg-brand-night text-white shadow-modal xl:-translate-y-3'
                  : 'bg-background/60 hover:border-primary/40 hover:shadow-raised',
              )}
            >
              {tier.popular ? (
                <span className="absolute -top-3 left-5 rounded-full bg-signal-lime px-3 py-1 text-xs font-bold text-brand-night shadow-raised">
                  Recommandé
                </span>
              ) : null}

              <div>
                <p
                  className={cn(
                    'text-xs font-semibold tracking-wider uppercase',
                    tier.popular ? 'text-cyan-100' : 'text-muted-foreground',
                  )}
                >
                  {tier.badge}
                </p>
                <h3 className="mt-2 text-xl font-bold">{tier.name}</h3>
                <p className={cn('mt-2 min-h-10 text-sm', tier.popular ? 'text-blue-100' : 'text-muted-foreground')}>
                  {tier.tagline}
                </p>

                <div className={cn('mt-5 border-t pt-4', tier.popular ? 'border-white/20' : 'border-border')}>
                  <div className="flex items-end gap-1.5">
                    <span className="font-display text-4xl font-bold tracking-tight tabular-nums">
                      {tier.priceMonthly} €
                    </span>
                    {tier.priceMonthly > 0 ? (
                      <span className={cn('pb-1 text-sm', tier.popular ? 'text-blue-100' : 'text-muted-foreground')}>
                        / mois
                      </span>
                    ) : null}
                  </div>
                  <p className={cn('mt-2 flex items-center gap-2 text-sm', tier.popular ? 'text-white' : 'text-foreground')}>
                    <Users className={cn('size-4', tier.popular ? 'text-signal-cyan' : 'text-primary')} aria-hidden="true" />
                    {tier.includedUsers} {tier.includedUsers > 1 ? 'utilisateurs inclus' : 'utilisateur inclus'}
                  </p>
                </div>

                <ul className="mt-5 space-y-3">
                  {tier.features.slice(0, DECISIVE_FEATURE_COUNT).map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        'flex items-start gap-2 text-sm leading-snug',
                        tier.popular ? 'text-blue-50' : 'text-muted-foreground',
                      )}
                    >
                      <Check
                        className={cn('mt-0.5 size-4 shrink-0', tier.popular ? 'text-signal-lime' : 'text-primary')}
                        aria-hidden="true"
                      />
                      <span>{feature.replace(/^❌\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                asChild
                variant={tier.popular ? 'primary' : 'outline'}
                className={cn(
                  'mt-7 min-h-touch w-full',
                  tier.popular && 'border-signal-lime bg-signal-lime text-brand-night hover:border-white hover:bg-white',
                )}
              >
                <Link to={tier.ctaLink ?? ROUTES.register}>
                  {tier.ctaText}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            14 jours d’essai sur les formules payantes · 5 € par siège supplémentaire · Sans engagement
          </p>
          <Button asChild variant="ghost" className="min-h-touch">
            <Link to={ROUTES.pricing}>
              Comparer toutes les fonctions
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
