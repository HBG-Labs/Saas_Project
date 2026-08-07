import { ROUTES } from './routes';

export type BillingInterval = 'monthly' | 'annual';

export interface PricingTier {
  id: 'free' | 'pro' | 'team';
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
    name: 'Gratuit',
    tagline: 'Pour découvrir la plateforme et les étudiants',
    badge: 'Accès Libre',
    popular: false,
    priceMonthly: 0,
    priceAnnualMonthly: 0,
    priceAnnualTotal: 0,
    ctaText: 'Créer un compte gratuit',
    ctaLink: ROUTES.register,
    ctaVariant: 'outline',
    features: [
      'Accès complet à toutes les calculatrices publiées',
      'Recherche universelle via ⌘K',
      'Calculs certifiés conformes UTE / ITU-T',
      'Mode sombre & application mobile',
      'Historique des 10 derniers calculs',
      'Jusqu’à 3 outils favoris',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Pour les techniciens et ingénieurs en activité',
    badge: 'Recommandé',
    popular: true,
    priceMonthly: 14.99,
    priceAnnualMonthly: 12.41, // ~149€ / an (2 mois offerts)
    priceAnnualTotal: 149,
    stripePriceIdMonthly: 'price_pro_monthly_v1',
    stripePriceIdAnnual: 'price_pro_annual_v1',
    ctaText: 'Commencer l’essai gratuit 14 jours',
    ctaLink: `${ROUTES.register}?plan=pro`,
    ctaVariant: 'primary',
    features: [
      'Toutes les fonctionnalités du plan Gratuit',
      'Historique de calculs illimité',
      'Exportation des rapports en PDF certifié & CSV',
      'Nombre d’outils favoris illimité',
      'Sauvegarde automatique des paramètres d’outils',
      'Support prioritaire par e-mail sous 24h',
    ],
  },
  {
    id: 'team',
    name: 'Équipe / Entreprise',
    tagline: 'Pour les bureaux d’études et équipes terrain',
    badge: 'Multi-utilisateurs',
    popular: false,
    priceMonthly: 39.99,
    priceAnnualMonthly: 33.25, // ~399€ / an
    priceAnnualTotal: 399,
    stripePriceIdMonthly: 'price_team_monthly_v1',
    stripePriceIdAnnual: 'price_team_annual_v1',
    ctaText: 'Demander un devis Entreprise',
    ctaLink: 'mailto:contact@nexoratech.fr?subject=Demande%20Offre%20Entreprise%20NexoraTech',
    ctaVariant: 'outline',
    features: [
      'Toutes les fonctionnalités du plan Pro',
      'Comptes utilisateurs centralisés pour l’équipe',
      'Espace de travail partagé avec dossiers d’étude',
      'Modèles de calculs et normes d’entreprise personnalisés',
      'Garantie de service (SLA 99.9%) & Support dédié',
      'Facturation annuelle centralisée avec TVA',
    ],
  },
] as const;

export function formatPrice(price: number): string {
  if (price === 0) return '0 €';
  return `${price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
