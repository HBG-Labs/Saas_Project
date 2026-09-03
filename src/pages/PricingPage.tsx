import { ArrowRight, Check, Minus, Shield, Sparkles, User, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { PricingRoiCard } from '@/components/pricing/PricingRoiCard';
import { PricingSimulator } from '@/components/pricing/PricingSimulator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { useOrganizationEntitlements } from '@/features/billing';
import { useCurrentOrganization } from '@/features/organizations';
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
  const [proModalOpen, setProModalOpen] = useState(false);

  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { planCode: currentPlanCode } = useOrganizationEntitlements(organizationId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-10">
      <div className="space-y-6">
        <PageHeader
          title="Une offre claire et transparente pour tous les professionnels"
          description="Choisissez la formule adaptée à vos besoins. Des offres sans engagement, ajustables selon la taille de votre équipe."
        />

        <p className="text-muted-foreground mt-4 text-center text-xs">
          Facturation mensuelle, sans engagement.{' '}
          <strong className="text-foreground">Quatorze jours d’essai gratuit</strong> sur toutes
          les formules payantes (0 € débité aujourd’hui). Au-delà des utilisateurs compris dans la
          formule, chaque siège supplémentaire coûte 5 € par mois.
        </p>

        {/* Grille des Cartes Tarifaires — 5 Formules */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PRICING_PLANS.map((tier) => {
            const displayPrice = tier.priceMonthly;
            const isCurrentPlan = user != null && tier.id === currentPlanCode;

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
                className={`relative flex flex-col justify-between transition-all duration-200 ${
                  tier.popular
                    ? 'border-primary/60 shadow-modal bg-surface ring-2 ring-primary/20'
                    : 'hover:border-border-strong bg-surface'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <Badge
                      className="gap-1 bg-surface border-2 border-primary text-primary py-0.5 px-3.5 text-2xs font-extrabold uppercase tracking-wide shadow-xs"
                    >
                      <Sparkles className="size-3 text-primary" />
                      Recommandé
                    </Badge>
                  </div>
                )}

                <div>
                  <CardHeader className="pt-6">
                    {!tier.popular && (
                      <Badge variant="neutral" className="w-fit text-2xs mb-2">
                        {tier.badge}
                      </Badge>
                    )}
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
                          <Check className={`size-3.5 shrink-0 mt-0.5 ${feat.startsWith('❌') ? 'text-error' : 'text-success'}`} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  {/*
                    La formule en cours passe par la VARIANTE `outline`, et non
                    par un fond réécrit à la main.

                    La version précédente gardait `variant="primary"` — donc le
                    texte blanc de cette variante — tout en repeignant le fond
                    en `bg-surface-sunken`, un gris clair. Résultat mesuré :
                    blanc sur #E6ECF1, soit 1,19:1. Le libellé « Formule
                    actuelle » était illisible pour tout client connecté.
                  */}
                  <Button
                    asChild={!isCurrentPlan}
                    disabled={isCurrentPlan}
                    variant={isCurrentPlan ? 'outline' : tier.popular ? 'primary' : tier.ctaVariant}
                    className={`h-9 w-full text-xs font-bold ${
                      isCurrentPlan ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    {isCurrentPlan ? (
                      <span>{targetText}</span>
                    ) : (
                      <Link to={targetLink}>
                        {targetText}
                        <ArrowRight className="size-3.5 ml-1 inline" />
                      </Link>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Suggestion 1 : Simulateur interactif de taille d'équipe */}
      <section>
        <PricingSimulator />
      </section>

      {/* Suggestion 2 : Calculateur et présentation du ROI Métier */}
      <section>
        <PricingRoiCard />
      </section>

      {/* Tableau comparatif détaillé */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">Comparatif détaillé des 5 formules</h2>
          <p className="text-muted-foreground text-xs mt-1">Visualisez l&apos;ensemble des prestations incluses et les fonctionnalités disponibles.</p>
        </div>

        <div className="bg-surface border-border/80 shadow-raised overflow-hidden rounded-2xl border">
          <div className="scroll-x">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-surface-sunken border-b border-border/60">
                <tr>
                  <th scope="col" className="p-3.5 font-semibold text-foreground">Fonctionnalité</th>
                  <th scope="col" className="p-3.5 font-semibold text-center text-foreground w-[15%]">Free</th>
                  <th scope="col" className="p-3.5 font-semibold text-center text-primary w-[15%]">Starter</th>
                  <th scope="col" className="p-3.5 font-semibold text-center text-primary font-bold w-[15%]">Pro ⭐</th>
                  <th scope="col" className="p-3.5 font-semibold text-center text-primary w-[15%]">Business</th>
                  <th scope="col" className="p-3.5 font-semibold text-center text-primary w-[15%]">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {COMPARISON_FEATURES.map((row) => (
                  <tr key={row.name} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="p-3.5 font-medium text-foreground">{row.name}</td>

                    <td className="p-3.5 text-center text-muted-foreground">
                      {typeof row.free === 'boolean' ? (
                        row.free ? <Check className="size-4 text-success inline" /> : <Minus className="size-4 text-subtle-foreground/50 inline" />
                      ) : (
                        <span className="font-mono text-2xs">{row.free}</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center text-foreground">
                      {typeof row.starter === 'boolean' ? (
                        row.starter ? <Check className="size-4 text-primary inline" /> : <Minus className="size-4 text-subtle-foreground/50 inline" />
                      ) : (
                        <span className="font-mono text-2xs text-primary font-semibold">{row.starter}</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center text-foreground bg-primary/5 font-semibold">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? <Check className="size-4 text-primary inline" /> : <Minus className="size-4 text-subtle-foreground/50 inline" />
                      ) : (
                        <span className="font-mono text-2xs text-primary font-bold">{row.pro}</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center text-foreground font-semibold">
                      {typeof row.business === 'boolean' ? (
                        row.business ? <Check className="size-4 text-primary inline" /> : <Minus className="size-4 text-subtle-foreground/50 inline" />
                      ) : (
                        <span className="font-mono text-2xs text-primary">{row.business}</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center text-foreground font-semibold">
                      {typeof row.enterprise === 'boolean' ? (
                        row.enterprise ? <Check className="size-4 text-primary inline" /> : <Minus className="size-4 text-subtle-foreground/50 inline" />
                      ) : (
                        <span className="font-mono text-2xs text-primary">{row.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Garantie de transparence */}
      <div className="bg-surface-sunken/60 border-border/60 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 sm:flex-row sm:p-8">
        <div className="flex items-center gap-3">
          <Shield className="size-6 text-primary shrink-0" />
          <div>
            <h3 className="text-foreground text-sm font-semibold">Paiements sécurisés & Sans engagement</h3>
            <p className="text-muted-foreground text-xs">
              Abonnez-vous en toute sérénité. Toutes nos formules sont sans engagement et résiliables à tout moment en 1 clic.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.faq}>Consulter la FAQ Tarifs</Link>
        </Button>
      </div>

      {/* Modale d'information Formule Pro */}
      <Modal
        open={proModalOpen}
        onOpenChange={setProModalOpen}
        title="Offre Pro — Formule recommandée"
        description="Le plan recommandé et cœur de cible de REZO360 pour artisans et équipes."
      >
        <div className="space-y-4 text-xs text-muted-foreground">
          <p>
            La formule Pro (39 € / mois) inclut 5 utilisateurs, la gestion complète des missions et interventions terrain, le suivi du matériel et des véhicules, ainsi que l&apos;exportation des rapports d&apos;intervention.
          </p>
          <div className="bg-surface-sunken rounded-lg p-3 border border-border/40 text-foreground font-medium">
            💡 +5 € / utilisateur supplémentaire par mois au-delà des 5 utilisateurs inclus.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setProModalOpen(false)}>
              Fermer
            </Button>
            <Button asChild size="sm">
              <Link
                to={user != null ? ROUTES.organizationBilling : `${ROUTES.register}?plan=pro`}
                onClick={() => setProModalOpen(false)}
              >
                {user != null ? 'Gérer mon abonnement' : 'Choisir le plan Pro'}
              </Link>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
