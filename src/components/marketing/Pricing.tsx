import { ArrowRight, Check, Sparkles, User, Users } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';

export function Pricing() {

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

          <p className="text-muted-foreground mt-4 text-xs">
            Facturation mensuelle, sans engagement.{' '}
            <strong className="text-foreground">Quatorze jours d’essai gratuit</strong> sur toutes
            les formules payantes, sans carte bancaire. Les utilisateurs au-delà de ceux compris
            dans la formule sont facturés 5 € par mois.
          </p>
        </div>

        {/* Grille des Cartes Tarifaires — 5 Formules */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PRICING_PLANS.map((tier) => {
            const displayPrice = tier.priceMonthly;

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col justify-between transition-all duration-200 ${
                  tier.popular
                    ? 'border-primary/60 shadow-modal glow-primary bg-surface ring-2 ring-primary/20'
                    : 'hover:border-border-strong bg-surface'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <Badge variant="primary" className="gap-1 shadow-sm py-0.5 px-3.5 text-2xs font-extrabold uppercase tracking-wide">
                      <Sparkles className="size-3" />
                      Recommandé
                    </Badge>
                  </div>
                )}

                <div>
                  <CardHeader className="pt-6">
                    <Badge variant="neutral" className="w-fit text-2xs mb-2">
                      {tier.badge}
                    </Badge>
                    <CardTitle className="text-lg font-bold">{tier.name}</CardTitle>
                    <p className="text-muted-foreground text-xs mt-1 min-h-[32px]">{tier.tagline}</p>

                    <div className="mt-3 border-t border-border/40 pt-3">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-3xl font-extrabold text-foreground tabular-nums">
                          {displayPrice === 0 ? '0 €' : `${displayPrice % 1 === 0 ? displayPrice : displayPrice.toFixed(2)} €`}
                        </span>
                        {displayPrice > 0 && <span className="text-muted-foreground text-xs font-medium">/ mois</span>}
                      </div>
                      <p className="text-subtle-foreground text-2xs mt-1">
                        {tier.id === 'free' ? 'Accès gratuit permanent' : 'Facturé mensuellement'}
                      </p>
                    </div>

                    {/* Quota utilisateurs & Sièges supplémentaires */}
                    <div className="mt-3.5 p-2.5 rounded-xl bg-surface-hover/60 border border-border/60 text-2xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        {tier.includedUsers === 1 ? <User className="size-3.5 text-primary" /> : <Users className="size-3.5 text-primary" />}
                        <span>{tier.includedUsers} {tier.includedUsers > 1 ? 'utilisateurs inclus' : 'utilisateur inclus'}</span>
                      </div>
                      {tier.additionalUserPriceMonthly > 0 ? (
                        <p className="text-muted-foreground font-medium">
                          +5 € / utilisateur supp. / mois
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          Monocompte (Max 1)
                        </p>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="mt-1 space-y-2.5">
                    <p className="text-subtle-foreground text-3xs font-bold uppercase tracking-wider">
                      Inclus dans cette offre :
                    </p>
                    <ul className="space-y-2 text-2xs">
                      {tier.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-1.5 text-foreground leading-tight">
                          <Check className={`size-3.5 shrink-0 mt-0.5 ${feat.startsWith('❌') ? 'text-rose-500' : 'text-primary'}`} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  <Button
                    asChild
                    variant={tier.popular ? 'primary' : tier.ctaVariant}
                    className={`w-full font-bold text-xs h-9 cursor-pointer ${
                      tier.popular
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md'
                        : tier.id === 'enterprise'
                          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
                          : tier.id === 'business'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                            : ''
                    }`}
                  >
                    <Link to={tier.ctaLink ?? ROUTES.register}>
                      {tier.ctaText}
                      <ArrowRight className="size-3.5 ml-1" />
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
