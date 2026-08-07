import { ArrowRight, Check, HelpCircle, Minus, Shield, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { type BillingInterval, PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

const COMPARISON_FEATURES = [
  { name: 'Accès au catalogue complet d’outils', free: true, pro: true, team: true },
  { name: 'Recherche universelle ⌘K', free: true, pro: true, team: true },
  { name: 'Calculs certifiés UTE / ITU-T', free: true, pro: true, team: true },
  { name: 'Mode sombre & application mobile', free: true, pro: true, team: true },
  { name: 'Historique des calculs', free: '10 derniers', pro: 'Illimité', team: 'Illimité' },
  { name: 'Outils favoris', free: '3 favoris', pro: 'Illimité', team: 'Illimité' },
  { name: 'Export de bilans (PDF certifié & CSV)', free: false, pro: true, team: true },
  { name: 'Sauvegarde auto des paramètres', free: false, pro: true, team: true },
  { name: 'Espace de travail partagé d’équipe', free: false, pro: false, team: true },
  { name: 'Support technique', free: 'Communauté', pro: 'Prioritaire 24h', team: 'Dédié + SLA' },
] as const;

export default function PricingPage() {
  useDocumentTitle('Tarifs');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('annual');
  const [proModalOpen, setProModalOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="Une offre claire et transparente pour tous les professionnels"
        description="Choisissez la formule adaptée à vos besoins. Essai gratuit de 14 jours sur la formule Pro, sans engagement."
      />

      {/* Sélecteur Facturation Mensuelle / Annuelle */}
      <div className="mb-12 flex justify-center">
        <div className="bg-surface-sunken border-border/80 flex items-center rounded-xl border p-1">
          <button
            type="button"
            onClick={() => setBillingInterval('monthly')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              billingInterval === 'monthly'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Facturation mensuelle
          </button>

          <button
            type="button"
            onClick={() => setBillingInterval('annual')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              billingInterval === 'annual'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Facturation annuelle</span>
            <Badge variant="primary" className="text-2xs py-0 px-1.5">
              -17 %
            </Badge>
          </button>
        </div>
      </div>

      {/* Grille des Cartes Tarifaires */}
      <div className="grid gap-8 lg:grid-cols-3">
        {PRICING_PLANS.map((tier) => {
          const isAnnual = billingInterval === 'annual';
          const displayPrice = isAnnual ? tier.priceAnnualMonthly : tier.priceMonthly;

          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col justify-between transition-all duration-200 ${
                tier.popular ? 'border-primary/50 shadow-modal glow-primary' : 'hover:border-border-strong'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="primary" className="gap-1 shadow-sm py-0.5 px-3">
                    <Sparkles className="size-3" />
                    Le plus populaire
                  </Badge>
                </div>
              )}

              <div>
                <CardHeader className="pt-6">
                  <Badge variant="neutral" className="w-fit text-2xs mb-2">
                    {tier.badge}
                  </Badge>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <p className="text-muted-foreground text-xs mt-1">{tier.tagline}</p>

                  <div className="mt-4 border-t border-border/40 pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-extrabold text-foreground tabular-nums">
                        {displayPrice === 0 ? '0 €' : `${displayPrice.toFixed(2)} €`}
                      </span>
                      {displayPrice > 0 && <span className="text-muted-foreground text-xs font-medium">/ mois</span>}
                    </div>
                    <p className="text-subtle-foreground text-2xs mt-1">
                      {tier.id === 'free'
                        ? 'Accès gratuit permanent'
                        : isAnnual
                          ? `Facturé ${tier.priceAnnualTotal} € par an`
                          : 'Facturé mensuellement sans engagement'}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="mt-2 space-y-3">
                  <p className="text-subtle-foreground text-2xs font-semibold uppercase tracking-wider">
                    Inclus dans cette offre :
                  </p>
                  <ul className="space-y-2.5 text-xs">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-foreground">
                        <Check className="size-4 text-primary shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </div>

              <div className="p-6 pt-0">
                {tier.ctaLink ? (
                  tier.ctaLink.startsWith('mailto:') ? (
                    <Button asChild variant={tier.ctaVariant} className="w-full">
                      <a href={tier.ctaLink}>{tier.ctaText}</a>
                    </Button>
                  ) : (
                    <Button asChild variant={tier.ctaVariant} className="w-full">
                      <Link to={tier.ctaLink}>
                        {tier.ctaText}
                        <ArrowRight className="size-4 ml-1.5" />
                      </Link>
                    </Button>
                  )
                ) : (
                  <Button
                    variant={tier.ctaVariant}
                    className="w-full"
                    onClick={() => setProModalOpen(true)}
                  >
                    {tier.ctaText}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tableau comparatif détaillé */}
      <section className="mt-20">
        <div className="text-center mb-8">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">Comparatif détaillé des fonctionnalités</h2>
          <p className="text-muted-foreground text-xs mt-1">Visualisez l&apos;ensemble des prestations incluses dans chaque formule.</p>
        </div>

        <div className="bg-surface border-border/80 shadow-raised overflow-hidden rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-sunken border-b border-border/60">
                <tr>
                  <th scope="col" className="p-4 font-semibold text-foreground">Fonctionnalité</th>
                  <th scope="col" className="p-4 font-semibold text-center text-foreground w-1/5">Gratuit</th>
                  <th scope="col" className="p-4 font-semibold text-center text-primary w-1/5">Pro</th>
                  <th scope="col" className="p-4 font-semibold text-center text-foreground w-1/5">Équipe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {COMPARISON_FEATURES.map((row) => (
                  <tr key={row.name} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="p-4 font-medium text-foreground">{row.name}</td>

                    <td className="p-4 text-center text-muted-foreground">
                      {typeof row.free === 'boolean' ? (
                        row.free ? <Check className="size-4 text-success inline" /> : <Minus className="size-4 text-subtle-foreground/50 inline" />
                      ) : (
                        <span className="font-mono text-2xs">{row.free}</span>
                      )}
                    </td>

                    <td className="p-4 text-center text-foreground font-semibold">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? <Check className="size-4 text-primary inline" /> : <Minus className="size-4 text-subtle-foreground/50 inline" />
                      ) : (
                        <span className="font-mono text-2xs text-primary">{row.pro}</span>
                      )}
                    </td>

                    <td className="p-4 text-center text-muted-foreground">
                      {typeof row.team === 'boolean' ? (
                        row.team ? <Check className="size-4 text-success inline" /> : <Minus className="size-4 text-subtle-foreground/50 inline" />
                      ) : (
                        <span className="font-mono text-2xs">{row.team}</span>
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
      <div className="bg-surface-sunken/60 border-border/60 mt-16 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 sm:flex-row sm:p-8">
        <div className="flex items-center gap-3">
          <Shield className="size-6 text-primary shrink-0" />
          <div>
            <h3 className="text-foreground text-sm font-semibold">Paiements sécurisés & Garantie 14 jours</h3>
            <p className="text-muted-foreground text-xs">
              Testez la formule Pro en toute sérénité. Résiliable à tout moment en un clic depuis votre espace membre.
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
        title="Offre Pro — Essai gratuit 14 jours"
        description="Activez votre essai gratuit de 14 jours lors de la création de votre compte."
      >
        <div className="space-y-4 text-xs text-muted-foreground">
          <p>
            La formule Pro débloque l&apos;historique de calculs illimité, l&apos;exportation des rapports en PDF certifiés et la sauvegarde automatique de vos paramètres d&apos;outils.
          </p>
          <div className="bg-surface-sunken rounded-lg p-3 border border-border/40 text-foreground font-medium">
            💡 Aucune carte bancaire n&apos;est requise pour débuter l&apos;essai gratuit.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setProModalOpen(false)}>
              Fermer
            </Button>
            <Button asChild size="sm">
              <Link to={`${ROUTES.register}?plan=pro`} onClick={() => setProModalOpen(false)}>
                Créer un compte Pro
              </Link>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
