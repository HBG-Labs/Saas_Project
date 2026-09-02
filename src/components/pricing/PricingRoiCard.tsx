import { CheckCircle, Clock, FileCheck2, Sparkles, TrendingUp, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

export function PricingRoiCard() {
  const stats = [
    {
      icon: Clock,
      value: '~3h / sem.',
      label: 'Temps administratif gagné',
      detail: 'Par technicien grâce aux formulaires et fiches préremplies sur site.',
    },
    {
      icon: TrendingUp,
      value: '450 € / mois',
      label: 'Économie moyenne estimée',
      detail: 'En heures de bureau éliminées et devis envoyés 2x plus vite.',
    },
    {
      icon: Zap,
      value: 'Dès le 1ᵉʳ devis',
      label: 'Seuil de rentabilité',
      detail: 'Amorti dès la première intervention facturée sans litige.',
    },
  ];

  return (
    <Card className="border-border/80 bg-surface-sunken/50 shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="primary" className="gap-1 text-3xs uppercase font-bold tracking-wide">
              <Sparkles className="size-3" />
              Rentabilité
            </Badge>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Un investissement 100% amorti dès le premier mois
            </h3>
          </div>
          <span className="text-3xs font-semibold text-success">
            Zéro double saisie • Rapports certifiés
          </span>
        </div>

        {/* 3 métriques compactes */}
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-surface rounded-xl p-3 border border-border/60 shadow-2xs space-y-1.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <Icon className="size-3.5" />
                  </div>
                  <span className="font-mono text-base font-extrabold text-foreground tabular-nums">
                    {stat.value}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">{stat.label}</h4>
                  <p className="text-3xs text-muted-foreground mt-0.5 leading-snug">
                    {stat.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bénéfices en 1 ligne */}
        <div className="grid gap-2 sm:grid-cols-2 pt-1 border-t border-border/40 text-2xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle className="size-3.5 text-success shrink-0" />
            <span>
              <strong className="text-foreground">Conformité UTE & ITU-T :</strong> Évitez les erreurs de dimensionnement.
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileCheck2 className="size-3.5 text-primary shrink-0" />
            <span>
              <strong className="text-foreground">Signature client sur mobile :</strong> Facturation immédiate le jour même.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
