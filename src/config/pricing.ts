import { ROUTES } from './routes';

/**
 * La facturation est MENSUELLE, et seulement mensuelle.
 *
 * L'annuel a été retiré parce qu'un abonnement Stripe ne peut pas mélanger deux
 * périodicités : tous ses articles partagent le même intervalle. Un forfait
 * annuel avec des sièges supplémentaires facturés au mois n'est donc pas
 * exprimable — et facturer les sièges à l'année n'était pas voulu.
 *
 * Le choix a été fait de ne pas proposer l'annuel plutôt que d'afficher un
 * tarif qu'on ne saurait pas encaisser, ou de plafonner silencieusement
 * l'effectif des abonnés annuels.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

export interface PricingTier {
  id: PlanId;
  name: string;
  tagline: string;
  badge: string;
  popular: boolean;
  priceMonthly: number; // en euros
  includedUsers: number; // utilisateurs inclus dans le forfait de base
  additionalUserPriceMonthly: number; // coût par utilisateur supplémentaire par mois (+5 €)
  maxUsers: number | null; // 1 pour Free, null pour illimité
  stripePriceIdMonthly?: string;
  ctaText: string;
  ctaLink: string | null;
  ctaVariant: 'primary' | 'outline' | 'secondary';
  features: readonly string[];
}

export const PRICING_PLANS: readonly PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Découverte de REZO360',
    badge: 'Découverte',
    popular: false,
    priceMonthly: 0,
    includedUsers: 1,
    additionalUserPriceMonthly: 0,
    maxUsers: 1,
    ctaText: 'Créer un compte gratuit',
    ctaLink: ROUTES.register,
    ctaVariant: 'outline',
    features: [
      '1 utilisateur inclus (1 utilisateur maximum)',
      'Accès complet aux calculatrices et outils',
      'Recherche universelle via ⌘K',
      'Calculs certifiés conformes UTE / ITU-T',
      'Historique des 10 derniers calculs',
      'Jusqu’à 3 outils favoris',
      'Aucune facturation de siège supplémentaire',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Indépendants et très petites entreprises',
    badge: 'Indépendants',
    popular: false,
    priceMonthly: 19,
    includedUsers: 2,
    additionalUserPriceMonthly: 5,
    maxUsers: null,
    stripePriceIdMonthly: 'price_starter_monthly_v1',
    ctaText: 'Choisir le plan Starter',
    ctaLink: `${ROUTES.register}?plan=starter`,
    ctaVariant: 'outline',
    features: [
      'Toutes les fonctionnalités du plan Free',
      '2 utilisateurs inclus (+5 € / util. supp.)',
      'Gestion des missions & interventions terrain',
      'Fiches d’intervention & signature client',
      'Carnet Clients & Devis/Facturation',
      'Exportation des rapports en PDF certifié & CSV',
      'Historique de calculs & sauvegardes illimité',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Plan recommandé pour artisans et petites équipes',
    badge: 'Recommandé',
    popular: true,
    priceMonthly: 39,
    includedUsers: 5,
    additionalUserPriceMonthly: 5,
    maxUsers: null,
    stripePriceIdMonthly: 'price_pro_monthly_v1',
    ctaText: 'Choisir le plan Pro',
    ctaLink: `${ROUTES.register}?plan=pro`,
    ctaVariant: 'primary',
    features: [
      'Assistant IA — 100 requêtes/mois (données de l’entreprise + documentation)',
      'Calculateurs Métiers certifiés (Fibre, Élec, BTP...)',
      '5 utilisateurs inclus (+5 € / util. supp.)',
      'Toutes les fonctionnalités du plan Starter',
      'Parc Matériel, Outillage & Étalonnages',
      'Gestion de la Flotte de Véhicules',
      'Gestion des Stocks & Consommables',
      'Commandes Fournisseurs & Achats',
      'Support prioritaire par e-mail sous 24h',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'PME et équipes structurées',
    badge: 'PME & Équipes',
    popular: false,
    priceMonthly: 69,
    includedUsers: 10,
    additionalUserPriceMonthly: 5,
    maxUsers: null,
    stripePriceIdMonthly: 'price_business_monthly_v1',
    ctaText: 'Choisir le plan Business',
    ctaLink: `${ROUTES.register}?plan=business`,
    ctaVariant: 'primary',
    features: [
      'Assistant IA — 300 requêtes/mois',
      'Toutes les fonctionnalités du plan Pro',
      '10 utilisateurs inclus (+5 € / util. supp.)',
      'Planning avancé & calendrier d’équipe',
      'Contrôle qualité & revue des interventions',
      'Tableaux de bord & statistiques de rentabilité',
      'Espace collaboratif multi-techniciens',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Entreprises avec des équipes importantes',
    badge: 'Entreprises',
    popular: false,
    priceMonthly: 99,
    includedUsers: 20,
    additionalUserPriceMonthly: 5,
    maxUsers: null,
    stripePriceIdMonthly: 'price_enterprise_monthly_v1',
    ctaText: 'Choisir le plan Enterprise',
    ctaLink: `${ROUTES.register}?plan=enterprise`,
    ctaVariant: 'primary',
    features: [
      'Assistant IA — 1 000 requêtes/mois',
      'Toutes les fonctionnalités du plan Business',
      '20 utilisateurs inclus',
      '+5 € / utilisateur supplémentaire / mois',
      'Aucune limite maximale de membres',
      'Gouvernance d’organisation & audit log complet',
      'Garantie de service (SLA 99.9%)',
      'Account Manager et support dédié 24/7',
    ],
  },
] as const;

/**
 * Calcul du prix total affiché pour un plan et un nombre d'utilisateurs.
 *
 * Formule officielle :
 * - Plan payant : prix_total = prix_plan + max(0, utilisateurs - utilisateurs_inclus) × 5
 * - Free : prix_total = 0 € (max 1 utilisateur)
 */
export function computeSubscriptionPrice(planId: string, userCount: number): number {
  const plan = PRICING_PLANS.find((p) => p.id === planId);
  if (!plan || plan.id === 'free') return 0;

  const basePrice = plan.priceMonthly;
  const extraUsers = Math.max(0, userCount - plan.includedUsers);
  const extraCost = extraUsers * plan.additionalUserPriceMonthly;

  return basePrice + extraCost;
}

export function formatPrice(price: number): string {
  if (price === 0) return '0 €';
  return `${price.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}
