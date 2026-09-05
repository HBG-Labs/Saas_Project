import {
  ArrowRight,
  Check,
  CreditCard,
  Headphones,
  Minus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';

import { PricingRoiCard } from '@/components/pricing/PricingRoiCard';
import { PricingSimulator } from '@/components/pricing/PricingSimulator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { useOrganizationEntitlements } from '@/features/billing';
import { useCurrentOrganization } from '@/features/organizations';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

const COMPARISON_FEATURES = [
  {
    name: 'Nombre d’utilisateurs inclus',
    free: '1 utilisateur',
    starter: '2 utilisateurs',
    pro: '5 utilisateurs',
    business: '10 utilisateurs',
    enterprise: '20 utilisateurs',
  },
  {
    name: 'Utilisateurs supplémentaires',
    free: 'Aucun (Max 1)',
    starter: '+5 €/user/mois',
    pro: '+5 €/user/mois',
    business: '+5 €/user/mois',
    enterprise: '+5 €/user/mois (Illimité)',
  },
  {
    name: 'Outils & convertisseurs universels',
    free: true,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Calculateurs Métiers certifiés (Fibre, Élec, BTP...)',
    free: false,
    starter: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Assistant IA (données de l’entreprise + documentation technique)',
    free: false,
    starter: false,
    pro: '100 req./mois',
    business: '300 req./mois',
    enterprise: '1 000 req./mois',
  },
  {
    name: 'Recherche universelle ⌘K',
    free: true,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Historique des calculs',
    free: '10 derniers',
    starter: 'Illimité',
    pro: 'Illimité',
    business: 'Illimité',
    enterprise: 'Illimité',
  },
  {
    name: 'Outils favoris',
    free: '3 favoris',
    starter: 'Illimité',
    pro: 'Illimité',
    business: 'Illimité',
    enterprise: 'Illimité',
  },
  {
    name: 'Export de bilans (PDF certifié & CSV)',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Sauvegarde auto des paramètres',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Gestion des missions & chantiers',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Fiches & rapports d’intervention PDF',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Devis & facturation certifiée',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Parc matériel, outillage & étalonnages',
    free: false,
    starter: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Flotte de véhicules & suivi technique',
    free: false,
    starter: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Gestion des stocks & achats fournisseurs',
    free: false,
    starter: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Plannings d’équipe & calendrier partagé',
    free: false,
    starter: false,
    pro: false,
    business: true,
    enterprise: true,
  },
  {
    name: 'Statistiques & tableaux de bord avancés',
    free: false,
    starter: false,
    pro: false,
    business: true,
    enterprise: true,
  },
  {
    name: 'Gouvernance, audit log & SLA 99.9%',
    free: false,
    starter: false,
    pro: false,
    business: false,
    enterprise: true,
  },
  {
    name: 'Support technique',
    free: 'Communauté',
    starter: 'E-mail 48h',
    pro: 'Prioritaire 24h',
    business: 'Dédié 24h',
    enterprise: 'Dédié 24/7 + SLA',
  },
] as const;

export default function PricingPage() {
  useDocumentTitle('Tarifs');
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { planCode: currentPlanCode } = useOrganizationEntitlements(organizationId);

  return (
    <div className="max-w-full contain-paint overflow-x-hidden pb-16 sm:pb-24">
      <section className="relative overflow-hidden bg-brand-night py-16 text-white sm:py-20">
        <div className="absolute -right-20 -top-28 size-80 rounded-full border-[4rem] border-signal-cyan/15" aria-hidden="true" />
        <div className="absolute -bottom-28 left-[45%] size-72 rounded-full border-[3rem] border-signal-lime/10" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:items-end lg:px-8">
          <div className="lg:col-span-7">
            <Badge className="border-white/20 bg-white/10 px-3 py-1 text-cyan-100">
              Tarifs REZO360
            </Badge>
            <h1 className="mt-6 text-4xl leading-[1.04] font-bold tracking-tight text-balance sm:text-6xl">
              Des tarifs clairs. Le bon niveau dès aujourd’hui.
            </h1>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-lg leading-relaxed text-blue-100">
              Choisissez selon la taille de votre équipe et les fonctions dont elle a besoin. Le
              simulateur applique le tarif mensuel réel, sièges supplémentaires compris.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <section aria-labelledby="pricing-simulator-title">
          <h2 id="pricing-simulator-title" className="sr-only">Simuler le tarif selon la taille de l’équipe</h2>
          <PricingSimulator />
        </section>

        <section aria-labelledby="pricing-plans-title">
          <div className="max-w-3xl">
            <span className="font-mono text-sm font-bold tracking-[0.16em] text-primary uppercase">Les formules</span>
            <h2 id="pricing-plans-title" className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
              Comparez l’essentiel en un regard.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Les cartes montrent les bénéfices décisifs. Le tableau plus bas conserve le détail complet.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PRICING_PLANS.map((tier) => {
              const isCurrentPlan = user != null && tier.id === currentPlanCode;
              const decisiveFeatures = tier.features
                .filter((feature) => !/^\d+ utilisateurs? inclus/.test(feature))
                .slice(0, 4);

              let targetLink = tier.ctaLink ?? ROUTES.register;
              let targetText = tier.ctaText;

              if (user != null) {
                if (isCurrentPlan) {
                  targetText = 'Formule actuelle';
                  targetLink = ROUTES.organizationBilling;
                } else if (tier.id === 'free') {
                  targetText = 'Accéder à l’application';
                  targetLink = ROUTES.missions;
                } else {
                  targetText = `Passer à ${tier.name}`;
                  targetLink = ROUTES.organizationBilling;
                }
              }

              return (
                <Card
                  key={tier.id}
                  className={cn(
                    'relative flex min-h-full flex-col overflow-visible p-5 transition-[transform,box-shadow,border-color] duration-200',
                    tier.popular
                      ? 'border-brand-night bg-brand-night text-white shadow-modal xl:-translate-y-4'
                      : 'bg-surface hover:border-primary/40 hover:shadow-raised',
                  )}
                >
                  {tier.popular ? (
                    <span className="absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-signal-lime px-3 py-1 text-xs font-bold text-brand-night shadow-raised">
                      <Sparkles className="size-3" aria-hidden="true" />
                      Recommandé
                    </span>
                  ) : (
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {tier.badge}
                    </span>
                  )}

                  <h3 className="mt-3 text-xl font-bold">{tier.name}</h3>
                  <p className={cn('mt-2 min-h-10 text-sm leading-snug', tier.popular ? 'text-blue-100' : 'text-muted-foreground')}>
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
                    <div className={cn('mt-4 rounded-xl border p-3', tier.popular ? 'border-white/15 bg-white/10' : 'border-border bg-surface-sunken')}>
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Users className={cn('size-4', tier.popular ? 'text-signal-cyan' : 'text-primary')} aria-hidden="true" />
                        {tier.includedUsers} {tier.includedUsers > 1 ? 'utilisateurs inclus' : 'utilisateur inclus'}
                      </p>
                      <p className={cn('mt-1 text-xs', tier.popular ? 'text-blue-100' : 'text-muted-foreground')}>
                        {tier.additionalUserPriceMonthly > 0
                          ? `+${tier.additionalUserPriceMonthly} € par siège supplémentaire`
                          : 'Un compte, sans dépassement'}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-5 flex-1 space-y-3">
                    {decisiveFeatures.map((feature) => (
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

                  <Button
                    asChild={!isCurrentPlan}
                    disabled={isCurrentPlan}
                    variant={isCurrentPlan ? 'outline' : tier.popular ? 'primary' : 'outline'}
                    className={cn(
                      'mt-7 min-h-touch w-full font-bold',
                      tier.popular && !isCurrentPlan &&
                        'border-signal-lime bg-signal-lime text-brand-night hover:border-white hover:bg-white',
                      tier.popular && isCurrentPlan &&
                        'cursor-default border-white/30 bg-white/10 text-white opacity-100',
                      isCurrentPlan && !tier.popular && 'cursor-default',
                    )}
                  >
                    {isCurrentPlan ? (
                      <span>{targetText}</span>
                    ) : (
                      <Link to={targetLink}>
                        {targetText}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        <section aria-label="Garanties tarifaires" className="grid overflow-hidden rounded-2xl border border-border bg-surface shadow-raised sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: '14 jours d’essai', detail: 'Sur les formules payantes', icon: Sparkles },
            { label: '5 € par siège', detail: 'Au-delà des sièges inclus', icon: Users },
            { label: 'Sans engagement', detail: 'Facturation mensuelle', icon: ShieldCheck },
            { label: 'Support prioritaire', detail: 'À partir de la formule Pro', icon: Headphones },
          ].map(({ label, detail, icon: Icon }) => (
            <div key={label} className="border-border p-5 sm:[&:nth-child(even)]:border-l lg:[&:not(:first-child)]:border-l">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-foreground">{label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="pricing-roi-title">
          <h2 id="pricing-roi-title" className="sr-only">Rentabilité opérationnelle</h2>
          <PricingRoiCard />
        </section>

        <section aria-labelledby="pricing-comparison-title">
          <div className="max-w-3xl">
            <span className="font-mono text-sm font-bold tracking-[0.16em] text-primary uppercase">Comparatif détaillé</span>
            <h2 id="pricing-comparison-title" className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
              Toutes les fonctions, formule par formule.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Sur mobile, faites défiler le tableau horizontalement sans déplacer le reste de la page.
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface shadow-raised">
            {/* Le conteneur de défilement doit pouvoir recevoir le focus au clavier. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div className="scroll-x" role="region" aria-label="Comparaison des formules" tabIndex={0}>
              <table className="min-w-[840px] w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-sunken">
                  <tr>
                    <th scope="col" className="min-w-60 bg-surface-sunken p-4 font-bold text-foreground">
                      Fonctionnalité
                    </th>
                    {PRICING_PLANS.map((plan) => (
                      <th
                        key={plan.id}
                        scope="col"
                        className={cn(
                          'w-[15%] p-4 text-center font-bold text-foreground',
                          plan.id === 'pro' && 'bg-primary/10 text-primary',
                        )}
                      >
                        {plan.name}
                        {plan.id === 'pro' ? <span className="sr-only">, formule recommandée</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {COMPARISON_FEATURES.map((row) => (
                    <tr key={row.name} className="hover:bg-surface-hover/50">
                      <th scope="row" className="bg-surface p-4 font-medium text-foreground">
                        {row.name}
                      </th>
                      <ComparisonCell value={row.free} />
                      <ComparisonCell value={row.starter} />
                      <ComparisonCell value={row.pro} featured />
                      <ComparisonCell value={row.business} />
                      <ComparisonCell value={row.enterprise} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-brand-blue px-6 py-12 text-white shadow-modal sm:px-12 sm:py-16">
          <div className="absolute -right-14 -top-16 size-60 rounded-full border-[2.5rem] border-signal-cyan/20" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <span className="font-mono text-sm font-bold tracking-[0.16em] text-signal-lime uppercase">Une trajectoire simple</span>
            <h2 className="mt-4 text-4xl leading-tight font-bold text-balance sm:text-5xl">
              Commencez petit. Évoluez sans changer d’outil.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-blue-100">
              Créez votre compte, choisissez la formule adaptée et ajustez-la quand votre équipe évolue.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 min-h-touch border-signal-lime bg-signal-lime px-6 text-brand-night hover:border-white hover:bg-white"
            >
              <Link to={ROUTES.register}>
                Commencer maintenant
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <p className="mt-5 flex items-center gap-2 text-sm text-blue-50">
              <CreditCard className="size-4 text-signal-cyan" aria-hidden="true" />
              Aucun débit aujourd’hui pour l’essai d’une formule payante.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function ComparisonCell({ value, featured = false }: { value: boolean | string; featured?: boolean }) {
  return (
    <td className={cn('p-4 text-center text-muted-foreground', featured && 'bg-primary/5 font-semibold text-foreground')}>
      {typeof value === 'boolean' ? (
        value ? (
          <Check className="inline size-5 text-primary" aria-label="Inclus" />
        ) : (
          <Minus className="inline size-5 text-subtle-foreground" aria-label="Non inclus" />
        )
      ) : (
        <span className="text-xs leading-snug font-medium">{value}</span>
      )}
    </td>
  );
}
