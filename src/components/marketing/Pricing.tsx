import { ArrowRight, Check, Users } from 'lucide-react';
import { Link } from 'react-router';

import { PRICING_PLANS, formatPrice } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { trackLandingAction } from '@/lib/meta-pixel';

const paidPlans = PRICING_PLANS.filter((plan) => plan.priceMonthly > 0);
const freePlan = PRICING_PLANS.find((plan) => plan.id === 'free');

export function Pricing() {
  return (
    <section id="tarifs" className="lp-pricing" aria-labelledby="lp-pricing-title">
      <div className="lp-container">
        <div className="lp-pricing__heading">
          <div>
            <p className="lp-eyebrow">À votre rythme</p>
            <h2 id="lp-pricing-title">
              Une formule adaptée <br />à votre équipe.
            </h2>
          </div>
          <div className="lp-pricing__heading-copy">
            <p>Un abonnement mensuel. Des utilisateurs inclus. La liberté d’évoluer.</p>
            <Link to={ROUTES.pricing}>
              Comparer toutes les fonctions <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="lp-pricing__trial-explainer" aria-label="Du compte gratuit à l’essai">
          <p>
            <strong>1. Créez votre compte Free</strong>Sans carte, pour découvrir les outils
            techniques. La gestion des interventions est disponible dès Starter.
          </p>
          <p>
            <strong>2. Activez votre essai</strong>Choisissez une offre payante depuis votre espace
            : 14 jours d’essai, avec carte bancaire.
          </p>
          <p>
            <strong>3. Gardez la main</strong>Aucun débit avant la fin de l’essai. Vous pouvez
            résilier en ligne avant l’échéance.
          </p>
        </div>
        <div className="lp-pricing__grid">
          {paidPlans.map((tier) => {
            const features = tier.features
              .filter(
                (feature) =>
                  !/^Toutes les fonctionnalités|\+5 €|Aucune limite maximale/.test(feature) &&
                  !feature.includes('utilisateurs inclus'),
              )
              .slice(0, 3);
            const inherited = tier.features.find((feature) =>
              feature.startsWith('Toutes les fonctionnalités du plan'),
            );

            return (
              <article
                key={tier.id}
                aria-labelledby={`lp-price-${tier.id}`}
                className={cn('lp-price-card', tier.popular && 'lp-price-card--popular')}
              >
                <div className="lp-price-card__topline">
                  {tier.popular ? <strong>Recommandé</strong> : <span>{tier.badge}</span>}
                </div>
                <h3 id={`lp-price-${tier.id}`}>{tier.name}</h3>
                <p className="lp-price-card__tagline">{tier.tagline}</p>
                <div className="lp-price-card__price">
                  <strong>{formatPrice(tier.priceMonthly)}</strong>
                  <span>/ mois</span>
                </div>
                <p className="lp-price-card__users">
                  <Users aria-hidden="true" />
                  {tier.includedUsers} utilisateurs inclus
                </p>
                <p className="lp-price-card__includes">
                  {inherited
                    ? inherited.replace('Toutes les fonctionnalités du plan ', 'Tout ') + ' inclus'
                    : '\u00a0'}
                </p>
                <ul>
                  {features.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="lp-price-card__extra">
                  +{formatPrice(tier.additionalUserPriceMonthly)} / utilisateur supplémentaire /
                  mois
                </p>
                <Link
                  className="lp-price-card__cta"
                  to={tier.ctaLink ?? ROUTES.register}
                  onClick={() => trackLandingAction('plan', tier.id)}
                >
                  {`Choisir ${tier.name}`}
                  <ArrowRight aria-hidden="true" />
                </Link>
                <p className="lp-price-card__trial">
                  {tier.id === 'business'
                    ? 'Essai Business à activer après inscription'
                    : 'Essai à activer après inscription'}
                </p>
              </article>
            );
          })}
        </div>

        {freePlan ? (
          <div className="lp-pricing__free">
            <div>
              <h3>
                Découvrir avec {freePlan.name} <span>{formatPrice(freePlan.priceMonthly)}</span>
              </h3>
              <p>
                {freePlan.includedUsers} utilisateur, les calculatrices et outils techniques. Sans
                carte, sans limite de durée. Les interventions et la facturation nécessitent une
                offre payante.
              </p>
            </div>
            <Link
              to={freePlan.ctaLink ?? ROUTES.register}
              onClick={() => trackLandingAction('signup', 'pricing-free')}
            >
              Créer mon compte gratuit <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : null}

        <p className="lp-pricing__footnote">
          L’inscription est gratuite. Activez ensuite votre essai de 14 jours depuis votre espace.
          Une carte est demandée pour les offres payantes ; aucun débit avant la fin de l’essai.
          Sans engagement, résiliable en ligne. Prix mensuels en euros, hors taxes le cas échéant.
          L’essai est soumis aux <Link to={ROUTES.terms}>conditions générales</Link>.
        </p>
      </div>
    </section>
  );
}
