import { ClipboardCheck, Clock, FileCheck2, Route, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

const ROI_LEVERS = [
  {
    icon: Clock,
    title: 'Temps administratif',
    detail: 'Regroupez missions, notes et comptes rendus au même endroit pour limiter la ressaisie.',
  },
  {
    icon: FileCheck2,
    title: 'Délai de transmission',
    detail: 'Le compte rendu suit l’intervention jusqu’au contrôle et à la validation.',
  },
  {
    icon: Route,
    title: 'Visibilité opérationnelle',
    detail: 'Le tableau de bord relie priorités, équipes et missions en cours.',
  },
] as const;

export function PricingRoiCard() {
  return (
    <Card className="overflow-hidden border-border bg-surface shadow-raised">
      <CardContent className="grid gap-8 p-5 sm:p-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-4">
          <Badge variant="primary" className="mb-4 px-3 py-1 font-bold tracking-wide uppercase">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Retour opérationnel
          </Badge>
          <h3 className="text-2xl font-bold text-balance text-foreground sm:text-3xl">
            Mesurez la valeur sur votre propre activité.
          </h3>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Le gain réel dépend de votre volume de missions, de votre organisation et du temps que
            vous consacrez aujourd’hui aux tâches de suivi.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-8">
          {ROI_LEVERS.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface-sunken p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h4 className="mt-4 text-base font-bold text-foreground">{title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 border-t border-border pt-6 lg:col-span-12">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Le simulateur chiffre uniquement l’abonnement. Il ne présente pas d’économie théorique :
            vous pouvez comparer son montant à vos propres coûts de coordination et de traitement.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
