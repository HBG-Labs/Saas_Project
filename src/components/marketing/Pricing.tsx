import { ArrowRight, Check, Sparkles, User, Users } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';

export function Pricing() {

  return (
    <section className="py-20 sm:py-28 bg-transparent text-white">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-none border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-bold text-cyan-300 shadow-xs">
            <Sparkles className="size-3.5 text-cyan-400" />
            <span>Tarifs Simples &amp; Transparents</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            Une formule adaptée à tous vos projets
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            Commencez gratuitement sans carte bancaire et évoluez à tout moment sans engagement.
          </p>
        </div>

        {/* Grille des Cartes Tarifaires — 5 Formules avec Bords Carrés */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PRICING_PLANS.map((tier) => {
            const displayPrice = tier.priceMonthly;

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col justify-between transition-all duration-300 backdrop-blur-xl rounded-none ${
                  tier.popular
                    ? 'bg-cyan-500/[0.08] border-cyan-400/70 shadow-[0_8px_32px_0_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40 hover:bg-cyan-500/[0.14]'
                    : 'bg-white/[0.04] border-white/15 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-white/[0.08] hover:border-white/30 hover:-translate-y-1'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <Badge
                      className="gap-1 rounded-none bg-cyan-950/90 backdrop-blur-md border-2 border-cyan-400 text-cyan-300 py-0.5 px-3.5 text-2xs font-extrabold uppercase tracking-wide shadow-xs"
                    >
                      <Sparkles className="size-3 text-cyan-400" />
                      Recommandé
                    </Badge>
                  </div>
                )}

                <div>
                  <CardHeader className="pt-6">
                    {!tier.popular && (
                      <Badge variant="neutral" className="w-fit rounded-none text-2xs mb-2 border-white/15 bg-white/10 backdrop-blur-xs text-slate-200">
                        {tier.badge}
                      </Badge>
                    )}
                    <CardTitle className="text-base font-bold text-white">{tier.name}</CardTitle>
                    <p className="text-slate-300 text-xs mt-1 min-h-[32px]">{tier.tagline}</p>

                    <div className="mt-3 border-t border-white/10 pt-3">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                          {displayPrice === 0 ? '0 €' : `${displayPrice % 1 === 0 ? displayPrice : displayPrice.toFixed(2)} €`}
                        </span>
                        {displayPrice > 0 && <span className="text-slate-400 text-xs font-medium">/ mois</span>}
                      </div>
                      <p className="text-slate-400 text-2xs mt-1">
                        {tier.id === 'free' ? 'Accès gratuit permanent' : 'Facturé mensuellement'}
                      </p>
                    </div>

                    {/* Quota utilisateurs & Sièges supplémentaires */}
                    <div className="mt-3.5 p-2.5 rounded-none backdrop-blur-md bg-white/5 border border-white/10 text-2xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                        {tier.includedUsers === 1 ? <User className="size-3.5 text-cyan-400" /> : <Users className="size-3.5 text-cyan-400" />}
                        <span>{tier.includedUsers} {tier.includedUsers > 1 ? 'utilisateurs inclus' : 'utilisateur inclus'}</span>
                      </div>
                      {tier.additionalUserPriceMonthly > 0 ? (
                        <p className="text-slate-400 font-medium">
                          +5 € / utilisateur supp. / mois
                        </p>
                      ) : (
                        <p className="text-slate-400">
                          Monocompte (Max 1)
                        </p>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="mt-1 space-y-2.5">
                    <p className="text-slate-400 text-3xs font-bold uppercase tracking-wider">
                      Inclus dans cette offre :
                    </p>
                    <ul className="space-y-2 text-2xs">
                      {tier.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-1.5 text-slate-200 leading-tight">
                          <Check className={`size-3.5 shrink-0 mt-0.5 ${feat.startsWith('❌') ? 'text-rose-400' : 'text-cyan-400'}`} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  <Link
                    to={tier.ctaLink ?? ROUTES.register}
                    className={`inline-flex items-center justify-center gap-1.5 w-full rounded-none font-bold text-xs h-9 cursor-pointer transition-all duration-200 ${
                      tier.popular
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-md ring-1 ring-cyan-400/50'
                        : tier.id === 'free'
                          ? 'border border-white/20 bg-white/5 text-white hover:bg-white/15 hover:border-white/40 shadow-xs backdrop-blur-xs'
                          : tier.id === 'starter'
                            ? 'border border-sky-400/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/70 shadow-xs backdrop-blur-xs'
                            : tier.id === 'business'
                              ? 'border border-emerald-400/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/80 shadow-xs backdrop-blur-xs'
                              : 'border border-purple-400/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/80 shadow-xs backdrop-blur-xs'
                    }`}
                  >
                    <span>{tier.ctaText}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 text-center text-xs text-slate-400">
          🔒 Paiements sécurisés par Stripe • Formules sans engagement • Annulation en 1 clic
        </div>
      </div>
    </section>
  );
}
