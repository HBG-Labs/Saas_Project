import { Check } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import { Section } from './Section';

/**
 * Grille tarifaire — STRUCTURE uniquement.
 *
 * Aucun modèle économique n'a été défini pour NexoraTech. Afficher des montants
 * inventés serait un engagement commercial que le produit ne peut pas tenir :
 * les prix sont donc explicitement marqués « à définir ».
 *
 * La répartition des fonctionnalités reflète en revanche ce que l'architecture
 * permet réellement aujourd'hui.
 */
const PLANS = [
  {
    name: 'Gratuit',
    price: null,
    tagline: 'Pour découvrir et pour les étudiants',
    features: [
      'Accès aux outils de base',
      'Favoris illimités',
      'Historique sur 30 jours',
      'Mode sombre',
    ],
    cta: 'Créer un compte',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: null,
    tagline: 'Pour les techniciens et ingénieurs en activité',
    features: [
      'Tous les outils, y compris avancés',
      'Historique illimité',
      'Paramètres d’outils sauvegardés',
      'Export des résultats',
      'Support prioritaire',
    ],
    cta: 'Choisir Pro',
    highlighted: true,
  },
  {
    name: 'Équipe',
    price: null,
    tagline: 'Pour les bureaux d’études et centres de formation',
    features: [
      'Tout le plan Pro',
      'Comptes multiples',
      'Espace de travail partagé',
      'Références internes',
      'Facturation centralisée',
    ],
    cta: 'Nous contacter',
    highlighted: false,
  },
] as const;

export function Pricing() {
  return (
    <Section
      id="tarifs"
      eyebrow="Tarifs"
      title="Une offre simple"
      description="La grille définitive sera publiée à la sortie de la version 1.0."
      centered
    >
      <p className="border-warning-border bg-warning-subtle text-foreground mx-auto mb-10 max-w-2xl rounded-lg border px-4 py-3 text-center text-sm">
        <strong className="font-semibold">Tarifs non définis.</strong> Les montants seront annoncés
        ultérieurement ; seule la répartition des fonctionnalités est indicative.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              'bg-surface relative flex flex-col rounded-xl border p-6',
              plan.highlighted
                ? 'border-primary shadow-overlay lg:scale-[1.03]'
                : 'border-border shadow-raised',
            )}
          >
            {plan.highlighted ? (
              <Badge variant="primary" className="absolute -top-2.5 left-6">
                Le plus complet
              </Badge>
            ) : null}

            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{plan.tagline}</p>

            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="text-subtle-foreground text-3xl font-bold">—</span>
              <span className="text-muted-foreground text-sm">à définir</span>
            </p>

            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm">
                  <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              variant={plan.highlighted ? 'primary' : 'outline'}
              size="lg"
              className="mt-6 w-full"
            >
              <Link to={ROUTES.register}>{plan.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}
