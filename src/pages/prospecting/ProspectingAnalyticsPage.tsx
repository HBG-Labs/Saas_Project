import { useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useProspectingAnalytics } from '@/features/prospecting';
import { useDocumentTitle } from '@/lib/use-document-title';
import type {
  ProspectingAnalytics,
  ProspectingFunnelBreakdownRow,
} from '@/features/prospecting/api/prospecting.api';

const FUNNEL_STEPS: Array<{ key: keyof ProspectingAnalytics['funnel']; label: string; emoji: string }> = [
  { key: 'detected', label: 'Détectés', emoji: '🛰️' },
  { key: 'qualified', label: 'Qualifiés', emoji: '✅' },
  { key: 'contacted', label: 'Contactés', emoji: '✉️' },
  { key: 'interested', label: 'Intéressés', emoji: '👀' },
  { key: 'trial', label: 'Essais', emoji: '🧪' },
  { key: 'converted', label: 'Clients', emoji: '🏆' },
];

const RATE_LABELS: Record<keyof ProspectingAnalytics['rates'], string> = {
  qualification: 'Taux de qualification',
  contact: 'Taux de contact',
  interest: 'Taux d’intérêt',
  trial: 'Taux d’essai',
  conversion: 'Taux de conversion',
};

function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

function BreakdownCard<T extends { label?: string; tier?: string; bucket?: string; source?: string }>({
  title,
  rows,
  rowLabel,
}: {
  title: string;
  rows: Array<T & ProspectingFunnelBreakdownRow>;
  rowLabel: (row: T & ProspectingFunnelBreakdownRow) => string;
}) {
  return (
    <Card className="border-border/80 bg-surface p-5 shadow-xs">
      <h2 className="text-foreground text-sm font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-subtle-foreground mt-3 text-xs">Aucune donnée sur la période.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={rowLabel(row)} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground truncate">{rowLabel(row)}</span>
              <span className="text-foreground shrink-0 font-mono font-bold">
                {row.converted}/{row.detected}{' '}
                <span className="text-subtle-foreground font-normal">
                  ({formatPercent(row.conversion_rate)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * §31 du cahier des charges — funnel détectés → qualifiés → contactés →
 * intéressés → essais → clients. « Réponses » est volontairement absent :
 * aucun événement distinct ne l'enregistre (voir la migration Phase 12).
 * Lecture de cohorte par date de DÉTECTION, jamais un instantané du statut
 * courant (un prospect qualifié puis refusé compte toujours « qualifié »).
 */
export default function ProspectingAnalyticsPage() {
  useDocumentTitle('Analytics — Prospect Radar');

  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const { data, isPending, error, refetch } = useProspectingAnalytics({
    from: from || null,
    to: to || null,
  });

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Funnel de prospection, par cohorte de date de détection."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          type="date"
          label="Détectés à partir du"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input type="date" label="Détectés jusqu’au" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {isPending ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-6">
          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <h2 className="text-foreground text-sm font-bold">Funnel</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {FUNNEL_STEPS.map((step) => (
                <div key={step.key}>
                  <p className="text-muted-foreground text-3xs font-bold tracking-wide uppercase">
                    {step.emoji} {step.label}
                  </p>
                  <p className="text-foreground mt-1 font-mono text-xl font-extrabold">
                    {data.funnel[step.key]}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <h2 className="text-foreground text-sm font-bold">Taux</h2>
            <ul className="mt-3 space-y-2">
              {(Object.keys(RATE_LABELS) as Array<keyof ProspectingAnalytics['rates']>).map((key) => (
                <li key={key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{RATE_LABELS[key]}</span>
                  <span className="text-foreground font-mono font-bold">
                    {formatPercent(data.rates[key])}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BreakdownCard title="Par zone" rows={data.by_zone} rowLabel={(r) => r.label} />
            <BreakdownCard title="Par secteur" rows={data.by_sector} rowLabel={(r) => r.label} />
            <BreakdownCard
              title="Par score initial"
              rows={data.by_score_tier}
              rowLabel={(r) => r.tier}
            />
            <BreakdownCard
              title="Par ancienneté d’entreprise"
              rows={data.by_company_age}
              rowLabel={(r) => r.bucket}
            />
            <BreakdownCard title="Par source" rows={data.by_source} rowLabel={(r) => r.source} />
          </div>
        </div>
      )}
    </div>
  );
}
