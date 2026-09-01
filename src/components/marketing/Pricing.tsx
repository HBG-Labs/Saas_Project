import { ArrowRight, Check, Sparkles, User, Users } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

/**
 * Grille tarifaire de la page d'accueil.
 *
 * Chacune des cinq formules portait sa propre couleur de bouton — cyan pour la
 * populaire, blanc pour la gratuite, puis ciel, émeraude et violet pour les
 * autres. Cinq couleurs sur une même ligne ne hiérarchisent rien : elles se
 * neutralisent, et la formule recommandée ne ressort pas plus que les autres.
 *
 * Une seule formule est mise en avant, avec le seul bouton plein. Les quatre
 * autres partagent le bouton de contour. La couleur redevient un signal.
 */
export function Pricing() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="primary" className="mb-4">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Tarifs simples et transparents
          </Badge>
          <h2 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Une formule adaptée à tous vos projets
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            Commencez gratuitement sans carte bancaire et changez de formule à tout moment, sans
            engagement.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PRICING_PLANS.map((tier) => {
            const displayPrice = tier.priceMonthly;

            return (
              <Card
                key={tier.id}
                className={cn(
                  'relative flex flex-col justify-between transition-shadow',
                  tier.popular
                    ? 'border-primary shadow-overlay ring-primary/20 ring-1'
                    : 'hover:shadow-raised',
                )}
              >
                {tier.popular ? (
                  <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                    <Badge variant="primary" className="border-primary shadow-xs">
                      <Sparkles className="size-3" aria-hidden="true" />
                      Recommandé
                    </Badge>
                  </div>
                ) : null}

                <div>
                  <CardHeader className="pt-6">
                    {!tier.popular ? (
                      <Badge variant="outline" className="mb-2 w-fit">
                        {tier.badge}
                      </Badge>
                    ) : null}
                    <CardTitle>{tier.name}</CardTitle>
                    <p className="text-muted-foreground min-h-[2.5rem] text-sm">{tier.tagline}</p>

                    <div className="border-border mt-3 border-t pt-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-foreground text-3xl font-bold tracking-tight tabular-nums">
                          {displayPrice === 0
                            ? '0 €'
                            : `${displayPrice % 1 === 0 ? displayPrice : displayPrice.toFixed(2)} €`}
                        </span>
                        {displayPrice > 0 ? (
                          <span className="text-muted-foreground text-sm">/ mois</span>
                        ) : null}
                      </div>
                      <p className="text-subtle-foreground mt-1 text-sm">
                        {tier.id === 'free' ? 'Accès gratuit permanent' : 'Facturé mensuellement'}
                      </p>
                    </div>

                    <div className="border-border bg-surface-sunken mt-4 space-y-1 rounded-lg border p-3">
                      <div className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                        {tier.includedUsers === 1 ? (
                          <User className="text-primary size-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <Users className="text-primary size-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {tier.includedUsers}{' '}
                          {tier.includedUsers > 1 ? 'utilisateurs inclus' : 'utilisateur inclus'}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {tier.additionalUserPriceMonthly > 0
                          ? `+${tier.additionalUserPriceMonthly} € / utilisateur supplémentaire / mois`
                          : 'Monocompte'}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <p className="text-subtle-foreground text-xs font-semibold tracking-wider uppercase">
                      Inclus dans cette offre
                    </p>
                    <ul className="space-y-2">
                      {tier.features.map((feat) => (
                        <li
                          key={feat}
                          className="text-muted-foreground flex items-start gap-2 text-sm leading-snug"
                        >
                          <Check
                            className={cn(
                              'mt-0.5 size-4 shrink-0',
                              feat.startsWith('❌') ? 'text-error' : 'text-success',
                            )}
                            aria-hidden="true"
                          />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  <Button
                    asChild
                    variant={tier.popular ? 'primary' : 'outline'}
                    className="w-full"
                  >
                    <Link to={tier.ctaLink ?? ROUTES.register}>
                      {tier.ctaText}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <p className="text-muted-foreground mt-10 text-center text-sm">
          Paiements sécurisés par Stripe · Formules sans engagement · Annulation en un clic
        </p>
      </div>
    </section>
  );
}
