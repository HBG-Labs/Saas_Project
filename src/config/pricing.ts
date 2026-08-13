import { ROUTES } from './routes';

export type BillingInterval = 'monthly' | 'annual';

export interface PricingTier {
  id: 'free' | 'pro' | 'business' | 'ultimate';
  name: string;
  tagline: string;
  badge: string;
  popular: boolean;
  priceMonthly: number; // en euros
  priceAnnualMonthly: number; // équivalent mensuel en facturation annuelle
  priceAnnualTotal: number; // total annuel en euros
  stripePriceIdMonthly?: string;
  stripePriceIdAnnual?: string;
  ctaText: string;
  ctaLink: string | null;
  ctaVariant: 'primary' | 'outline' | 'secondary';
  features: readonly string[];
}

export const PRICING_PLANS: readonly PricingTier[] = [
  {
    id: 'free',
    name: 'Starter',
    tagline: 'Pour techniciens solo et étudiants',
    badge: 'Accès Libre',
    popular: false,
    priceMonthly: 0,
    priceAnnualMonthly: 0,
    priceAnnualTotal: 0,
    ctaText: 'Créer un compte gratuit',
    ctaLink: ROUTES.register,
    ctaVariant: 'outline',
    features: [
      '1 utilisateur (Monocompte strict)',
      '❌ Gestion du personnel non autorisée',
      'Accès complet aux calculatrices et outils',
      'Recherche universelle via ⌘K',
      'Calculs certifiés conformes UTE / ITU-T',
      'Historique des 10 derniers calculs',
      'Jusqu’à 3 outils favoris',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Pour artisans et micro-équipes',
    badge: 'Artisans',
    popular: false,
    priceMonthly: 19,
    priceAnnualMonthly: 15,
    priceAnnualTotal: 180,
    stripePriceIdMonthly: 'price_pro_monthly_v1',
    stripePriceIdAnnual: 'price_pro_annual_v1',
    ctaText: 'S’abonner au plan Pro',
    ctaLink: `${ROUTES.register}?plan=pro`,
    ctaVariant: 'outline',
    features: [
      'Toutes les fonctionnalités du plan Starter',
      'Jusqu’à 3 utilisateurs inclus (Fixe)',
      '✅ Gestion du personnel essentielle',
      'Historique de calculs illimité',
      'Exportation des rapports en PDF certifié & CSV',
      'Nombre d’outils favoris illimité',
      'Sauvegarde automatique des paramètres',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Pour PME et équipes terrain',
    badge: 'Recommandé',
    popular: true,
    priceMonthly: 49,
    priceAnnualMonthly: 39,
    priceAnnualTotal: 468,
    stripePriceIdMonthly: 'price_business_monthly_v1',
    stripePriceIdAnnual: 'price_business_annual_v1',
    ctaText: 'S’abonner au plan Business',
    ctaLink: `${ROUTES.register}?plan=business`,
    ctaVariant: 'primary',
    features: [
      'Toutes les fonctionnalités du plan Pro',
      '10 utilisateurs inclus',
      'Technicien supplémentaire à +5 € / mois',
      '✅ Gestion du personnel avancée & plannings',
      'Espace de travail partagé avec dossiers d’étude',
      'Modèles de calculs et normes personnalisés',
      'Support prioritaire par e-mail sous 24h',
    ],
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    tagline: 'Pour grands comptes et structures multi-sites',
    badge: 'Haut de gamme',
    popular: false,
    priceMonthly: 99,
    priceAnnualMonthly: 79,
    priceAnnualTotal: 948,
    stripePriceIdMonthly: 'price_ultimate_monthly_v1',
    stripePriceIdAnnual: 'price_ultimate_annual_v1',
    ctaText: 'S’abonner au plan Ultimate',
    ctaLink: `${ROUTES.register}?plan=ultimate`,
    ctaVariant: 'primary',
    features: [
      'Toutes les fonctionnalités du plan Business',
      '20 utilisateurs inclus',
      'Technicien supplémentaire à +5 € / mois',
      '✅ Multi-sites & Intégration SSO / API',
      'Gouvernance d’organisation & audit log',
      'Garantie de service (SLA 99.9%)',
      'Account Manager et support dédié',
    ],
  },
] as const;

export function formatPrice(price: number): string {
  if (price === 0) return '0 €';
  return `${price.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}
