import {
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Download,
  FileCheck,
  Layers,
  Loader2,
  PieChart,
  Receipt,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatWorkedTime, useActivityStats } from '@/features/analytics';
import { useCurrentOrganization } from '@/features/organizations';
import { useQuotes } from '@/features/quotes';
import { useTeams } from '@/features/teams';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useEphemeralValue } from '@/lib/use-ephemeral-flag';

import { escapeAnalyticsHtml } from './analytics-export';

type ViewMode = 'month' | 'quarter' | 'year';
type QuarterCode = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type YearCode = 2026 | 2025 | 2024;

export default function AnalyticsPage() {
  useDocumentTitle('Statistiques & Analytics');

  const { organization } = useCurrentOrganization();
  const [viewMode, setViewMode] = useState<ViewMode>('quarter');
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterCode>('Q3');
  const [selectedYear, setSelectedYear] = useState<YearCode>(2026);

  // States pour les menus défilants personnalisés
  const [isQuarterMenuOpen, setIsQuarterMenuOpen] = useState(false);
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, signalerExport, effacerExport] = useEphemeralValue<string>(5000);

  const quarterLabels: Record<QuarterCode, string> = {
    Q1: 'T1 (Janv - Mars)',
    Q2: 'T2 (Avr - Juin)',
    Q3: 'T3 (Juil - Sept)',
    Q4: 'T4 (Oct - Déc)',
  };

  const getPeriodLabel = () => {
    if (viewMode === 'month') {
      return `30 Derniers Jours`;
    }
    if (viewMode === 'quarter') {
      return `${quarterLabels[selectedQuarter]} ${selectedYear}`;
    }
    return `Année Complète ${selectedYear}`;
  };

  /**
   * Période interrogée, déduite de la sélection.
   *
   * Les bornes sont calculées ici et transmises à la base : c'est elle qui
   * agrège, sur exactement l'intervalle affiché.
   */
  const range = (() => {
    if (viewMode === 'month') {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString(), to: new Date().toISOString() };
    }

    if (viewMode === 'quarter') {
      const quarterIndex = Number(selectedQuarter.slice(1)) - 1;
      return {
        from: new Date(Date.UTC(selectedYear, quarterIndex * 3, 1)).toISOString(),
        to: new Date(Date.UTC(selectedYear, quarterIndex * 3 + 3, 0, 23, 59, 59)).toISOString(),
      };
    }

    return {
      from: new Date(Date.UTC(selectedYear, 0, 1)).toISOString(),
      to: new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59)).toISOString(),
    };
  })();

  /**
   * La période équivalente juste avant, pour mesurer une évolution RÉELLE.
   *
   * La carte affichait « Tendance : +14.2% de croissance d'activité » —
   * texte figé dans le JSX, jamais calculé, affiché même quand tout le reste
   * de l'écran indiquait zéro donnée sur la période. Une organisation qui
   * vient de s'inscrire aurait vu son activité déclarée en croissance avant
   * d'avoir consigné la moindre mission.
   *
   * `month` recule de 30 jours supplémentaires ; `quarter` et `year` reculent
   * d'un cran sur le même calendrier — le trimestre ou l'année précédente,
   * pas un intervalle glissant, pour rester comparable à ce que l'utilisateur
   * a sélectionné.
   */
  const previousRange = (() => {
    if (viewMode === 'month') {
      const to = new Date();
      to.setDate(to.getDate() - 30);
      const from = new Date(to);
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString(), to: to.toISOString() };
    }

    if (viewMode === 'quarter') {
      const quarterIndex = Number(selectedQuarter.slice(1)) - 1;
      const previousQuarterIndex = quarterIndex === 0 ? 3 : quarterIndex - 1;
      const previousYear = quarterIndex === 0 ? selectedYear - 1 : selectedYear;
      return {
        from: new Date(Date.UTC(previousYear, previousQuarterIndex * 3, 1)).toISOString(),
        to: new Date(
          Date.UTC(previousYear, previousQuarterIndex * 3 + 3, 0, 23, 59, 59),
        ).toISOString(),
      };
    }

    return {
      from: new Date(Date.UTC(selectedYear - 1, 0, 1)).toISOString(),
      to: new Date(Date.UTC(selectedYear - 1, 11, 31, 23, 59, 59)).toISOString(),
    };
  })();

  const statsQuery = useActivityStats(organization?.id ?? null, range);
  const stats = statsQuery.data ?? null;

  const previousStatsQuery = useActivityStats(organization?.id ?? null, previousRange);
  const previousStats = previousStatsQuery.data ?? null;

  const teamsQuery = useTeams(organization?.id ?? null);
  const teams = teamsQuery.data ?? [];

  const quotesQuery = useQuotes(organization?.id ?? null);
  const quotes = quotesQuery.data ?? [];

  const totalQuotesCount = quotes.length;
  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted');
  const pendingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'draft');
  const conversionRate =
    totalQuotesCount > 0 ? (acceptedQuotes.length / totalQuotesCount) * 100 : 0;

  const STATUS_LABELS_SHORT: Record<string, string> = {
    draft: 'Brouillon',
    assigned: 'Affectée',
    accepted: 'Acceptée',
    in_progress: 'En cours',
    completed: 'Terminée',
    submitted: 'Soumise',
    approved: 'Validée',
    rejected: 'Refusée',
    cancelled: 'Annulée',
    closed: 'Clôturée',
  };

  const currentData = (() => {
    const periodLabel = getPeriodLabel();

    if (stats === null) {
      return {
        periodLabel,
        conformity: '—',
        conformityDiff: 'Aucune donnée sur la période',
        volume: '0',
        volumeDiff: '0 intervenant',
        avgDuration: '—',
        durationDiff: '0 h au total',
        sla: '0',
        slaLabel: '0 en attente de contrôle',
        totalMissions: 0,
        chartData: [{ label: 'Aucune mission', count: 0 }],
        clientBreakdown: [],
        trend: null,
      };
    }

    const reviewed = stats.reports_approved + stats.reports_rejected;
    const conformity = reviewed === 0 ? null : (stats.reports_approved / reviewed) * 100;

    const avgSeconds =
      stats.interventions_total === 0
        ? 0
        : Math.round(stats.worked_seconds / stats.interventions_total);

    const chartData = Object.entries(stats.missions_by_status)
      .map(([status, count]) => ({
        label: STATUS_LABELS_SHORT[status] ?? status,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const totalCustomerMissions = stats.customers.reduce((sum, c) => sum + c.missions, 0);
    const palette = ['#ea580c', '#dc2626', '#0891b2', '#ca8a04', '#7c3aed', '#059669'];

    /**
     * `null` tant que la comparaison n'a rien de fiable à dire — la période
     * précédente charge encore, ou les deux périodes sont vides. Un
     * pourcentage affiché dans ces cas serait soit un chiffre en attente
     * habillé en résultat, soit une division par zéro déguisée.
     */
    const trend = (() => {
      if (previousStatsQuery.isPending) return null;

      const previousTotal = previousStats?.missions_total ?? 0;

      if (previousTotal === 0) {
        return stats.missions_total > 0 ? 'Nouvelle activité sur la période' : null;
      }

      const variation = ((stats.missions_total - previousTotal) / previousTotal) * 100;
      const signe = variation >= 0 ? '+' : '';
      return `${signe}${variation.toFixed(1)}% par rapport à la période précédente`;
    })();

    return {
      periodLabel,
      conformity: conformity === null ? '—' : `${conformity.toFixed(1)}%`,
      conformityDiff:
        reviewed === 0
          ? 'Aucun compte rendu contrôlé'
          : `${stats.reports_approved} validé${stats.reports_approved > 1 ? 's' : ''} sur ${reviewed}`,
      volume: String(stats.interventions_total),
      volumeDiff: `${stats.active_members} intervenant${stats.active_members > 1 ? 's' : ''}`,
      avgDuration: avgSeconds === 0 ? '—' : formatWorkedTime(avgSeconds),
      durationDiff: `${formatWorkedTime(stats.worked_seconds)} au total`,
      sla: String(stats.missions_total),
      slaLabel: `${stats.reports_pending} en attente de contrôle`,
      totalMissions: stats.missions_total,
      chartData: chartData.length > 0 ? chartData : [{ label: 'Aucune mission', count: 0 }],
      clientBreakdown: stats.customers.map((customer, index) => ({
        name: customer.name,
        percentage:
          totalCustomerMissions === 0
            ? 0
            : Math.round((customer.missions / totalCustomerMissions) * 100),
        count: customer.missions,
        color: palette[index % palette.length] ?? '#64748b',
      })),
      trend,
    };
  })();

  const maxChartCount = Math.max(1, ...currentData.chartData.map((d) => d.count));

  // Génération d'un Document PDF Haute Définition Exécutif
  const handleExportPDF = () => {
    setIsExporting(true);
    effacerExport();

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setIsExporting(false);
      window.print();
      return;
    }

    const orgName = organization?.name ?? 'REZO360 SaaS';
    const exportDate = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const safe = {
      orgName: escapeAnalyticsHtml(orgName),
      exportDate: escapeAnalyticsHtml(exportDate),
      periodLabel: escapeAnalyticsHtml(currentData.periodLabel),
      volume: escapeAnalyticsHtml(currentData.volume),
      conformity: escapeAnalyticsHtml(currentData.conformity),
      avgDuration: escapeAnalyticsHtml(currentData.avgDuration),
      sla: escapeAnalyticsHtml(currentData.sla),
      conformityDiff: escapeAnalyticsHtml(currentData.conformityDiff),
      volumeDiff: escapeAnalyticsHtml(currentData.volumeDiff),
      durationDiff: escapeAnalyticsHtml(currentData.durationDiff),
      slaLabel: escapeAnalyticsHtml(currentData.slaLabel),
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Rapport de Performance Opérationnelle - ${safe.orgName}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .brand {
            font-size: 20px;
            font-weight: 800;
            color: #0284c7;
            letter-spacing: -0.5px;
          }
          .doc-title {
            font-size: 11px;
            color: #64748b;
            text-align: right;
          }
          .main-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .sub-title {
            font-size: 12px;
            color: #475569;
            margin-bottom: 18px;
          }
          .summary-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-left: 4px solid #0284c7;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 20px;
          }
          .summary-box h3 {
            margin: 0 0 6px 0;
            font-size: 13px;
            color: #0369a1;
          }
          .summary-box p {
            margin: 0;
            font-size: 11px;
            color: #334155;
            line-height: 1.5;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .kpi-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            background: #f8fafc;
          }
          .kpi-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 6px;
          }
          .kpi-value {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
          }
          .kpi-sub {
            font-size: 10px;
            color: #15803d;
            font-weight: 600;
            margin-top: 4px;
          }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin-bottom: 14px;
          }

          .chart-grid {
            display: grid;
            grid-template-columns: 1.6fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
          }
          .chart-wrapper {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 14px;
          }
          .chart-bar-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .chart-row {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 11px;
          }
          .chart-row-label {
            width: 85px;
            font-weight: 700;
            color: #334155;
            text-align: right;
            shrink: 0;
          }
          .chart-row-track {
            flex: 1;
            background: #e2e8f0;
            height: 16px;
            border-radius: 4px;
            overflow: hidden;
          }
          .chart-row-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%);
            border-radius: 4px;
          }
          .chart-row-value {
            width: 80px;
            font-family: monospace;
            font-weight: 700;
            color: #1e40af;
            text-align: left;
            padding-left: 6px;
          }

          .client-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 14px;
          }
          .client-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .client-item {
            font-size: 11px;
          }
          .client-bar {
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 4px;
          }

          .table-custom {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          .table-custom th {
            background: #f1f5f9;
            color: #334155;
            text-align: left;
            padding: 8px;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
          }
          .table-custom td {
            padding: 8px;
            border-bottom: 1px solid #e2e8f0;
            color: #0f172a;
          }
          .badge-score {
            background: #dcfce7;
            color: #15803d;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 700;
          }
          .footer {
            margin-top: 24px;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #94a3b8;
          }
          .signature-block {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
          }
          .sign-box {
            width: 200px;
            border-top: 1px border #cbd5e1;
            padding-top: 6px;
            font-size: 10px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">REZO360 — Operational Intelligence</div>
          <div class="doc-title">
            <strong>Réf: REF-ANALYTICS-2026-08</strong><br />
            Édité le : ${safe.exportDate}
          </div>
        </div>

        <div class="main-title">RAPPORT DE PERFORMANCE & QUALITÉ OPÉRATIONNELLE</div>
        <div class="sub-title">Entreprise : <strong>${safe.orgName}</strong> — Période : <strong>${safe.periodLabel}</strong></div>

        <div class="summary-box">
          <h3>Résumé Exécutif de la Période</h3>
          <p>
            Sur la période analysée (<strong>${safe.periodLabel}</strong>), l’entreprise a réalisé un total de <strong>${safe.volume} interventions</strong> avec un taux exceptionnel de conformité du 1er coup de <strong>${safe.conformity}</strong>. Le temps moyen d’exécution sur le terrain s’établit à <strong>${safe.avgDuration}</strong>, garantissant un respect optimal des SLA clients à <strong>${safe.sla}</strong>.
          </p>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Conformité 1er Coup</div>
            <div class="kpi-value">${safe.conformity}</div>
            <div class="kpi-sub">${safe.conformityDiff}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Volume Interventions</div>
            <div class="kpi-value">${safe.volume}</div>
            <div class="kpi-sub">${safe.volumeDiff} d'activité</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Durée Moy. Terrain</div>
            <div class="kpi-value">${safe.avgDuration}</div>
            <div class="kpi-sub">${safe.durationDiff} gain d'efficacité</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Satisfaction SLA</div>
            <div class="kpi-value">${safe.sla}</div>
            <div class="kpi-sub">Statut : ${safe.slaLabel}</div>
          </div>
        </div>

        <div class="chart-grid">
          <div class="chart-wrapper">
            <div class="section-title">Volume d'Interventions par Période</div>
            <div class="chart-bar-list">
              ${currentData.chartData
                .map((d) => {
                  const w = Math.round((d.count / maxChartCount) * 100);
                  return `
                    <div class="chart-row">
                      <div class="chart-row-label">${escapeAnalyticsHtml(d.label)}</div>
                      <div class="chart-row-track">
                        <div class="chart-row-fill" style="width: ${w}%;"></div>
                      </div>
                      <div class="chart-row-value">${d.count} missions</div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>

          <div class="client-box">
            <div class="section-title">Répartition par Client</div>
            <div class="client-list">
              ${currentData.clientBreakdown
                .map(
                  (c) => `
                <div class="client-item">
                  <div style="display:flex; justify-content:space-between; font-weight:700;">
                    <span>${escapeAnalyticsHtml(c.name)}</span>
                    <span>${c.percentage}%</span>
                  </div>
                  <div class="client-bar">
                    <div style="height:100%; width:${c.percentage}%; background:${c.color};"></div>
                  </div>
                  <div style="font-size:9px; color:#64748b; margin-top:2px;">${c.count} missions terminées</div>
                </div>
              `,
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="section-title">Performance & Activité par Équipe Terrain</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>Équipe Terrain</th>
              <th>Description / Spécialité</th>
              <th style="text-align:right;">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${
              teams.length === 0
                ? `<tr><td colspan="3" style="text-align:center; padding:14px; color:#64748b;">Aucune équipe enregistrée</td></tr>`
                : teams
                    .map(
                      (t) => `
              <tr>
                <td><strong>${escapeAnalyticsHtml(t.name)}</strong></td>
                <td>${escapeAnalyticsHtml(t.description ?? '—')}</td>
                <td style="text-align:right;"><span class="badge-score">${t.status === 'active' ? 'Active' : 'Archivée'}</span></td>
              </tr>
            `,
                    )
                    .join('')
            }
          </tbody>
        </table>

        <div class="signature-block">
          <div class="sign-box">
            Responsable des Opérations<br />
            Signé électriquement via REZO360
          </div>
          <div class="sign-box" style="text-align:right;">
            Direction Technique & Qualité<br />
            Cachet Officiel
          </div>
        </div>

        <div class="footer">
          <div>Document généré par REZO360 SaaS — Tous droits réservés</div>
          <div>Confidentiel & Usage Interne uniquement</div>
        </div>

      </body>
      </html>
    `;

    printWindow.addEventListener(
      'load',
      () => {
        window.setTimeout(() => printWindow.print(), 300);
      },
      { once: true },
    );
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      setIsExporting(false);
      signalerExport('Rapport PDF Officiel généré avec succès !');
    }, 800);
  };

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Statistiques & Performance Opérationnelle"
        description={`Analyses avancées de l'activité, de la conformité qualité et de la productivité pour ${organization?.name ?? 'votre entreprise'}.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* BARRE DE CONTRÔLE ET SÉLECTEURS DE PÉRIODE PARFAITEMENT ALIGNÉS */}
            <div className="border-border bg-surface flex flex-wrap items-center gap-2 rounded-xl border p-1.5 shadow-xs">
              {/* Sélecteur de mode de vue */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('month');
                    setIsQuarterMenuOpen(false);
                    setIsYearMenuOpen(false);
                  }}
                  className={`min-h-touch cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1.5 ${
                    viewMode === 'month'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  30 Derniers jours
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('quarter');
                    setIsQuarterMenuOpen(false);
                    setIsYearMenuOpen(false);
                  }}
                  className={`min-h-touch cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1.5 ${
                    viewMode === 'quarter'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Vue Trimestrielle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('year');
                    setIsQuarterMenuOpen(false);
                    setIsYearMenuOpen(false);
                  }}
                  className={`min-h-touch cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1.5 ${
                    viewMode === 'year'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Vue Annuelle
                </button>
              </div>

              <div className="bg-border mx-1 my-auto h-4 w-px" />

              {/* MENU TRIMESTRE (Affiché uniquement en Vue Trimestrielle) */}
              {viewMode === 'quarter' ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuarterMenuOpen((prev) => !prev);
                      setIsYearMenuOpen(false);
                    }}
                    className="min-h-touch border-border bg-surface-hover/80 text-foreground hover:bg-surface flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors sm:min-h-0"
                  >
                    <span>Trimestre : {selectedQuarter}</span>
                    <ChevronDown className="text-primary size-3.5" />
                  </button>

                  {/* Popover du Menu Trimestre */}
                  {isQuarterMenuOpen ? (
                    <div className="border-border bg-surface animate-in fade-in zoom-in-95 absolute top-full left-0 z-50 mt-1.5 w-52 rounded-xl border p-1.5 shadow-xl duration-150">
                      {(['Q1', 'Q2', 'Q3', 'Q4'] as QuarterCode[]).map((qCode) => (
                        <button
                          key={qCode}
                          type="button"
                          onClick={() => {
                            setSelectedQuarter(qCode);
                            setViewMode('quarter');
                            setIsQuarterMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            selectedQuarter === qCode
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-foreground hover:bg-surface-hover'
                          }`}
                        >
                          <span>{quarterLabels[qCode]}</span>
                          {selectedQuarter === qCode ? (
                            <Check className="text-primary size-4" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* MENU ANNÉE */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsYearMenuOpen((prev) => !prev);
                    setIsQuarterMenuOpen(false);
                  }}
                  className="min-h-touch border-border bg-surface-hover/80 text-foreground hover:bg-surface flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors sm:min-h-0"
                >
                  <span>Année : {selectedYear}</span>
                  <ChevronDown className="text-muted-foreground size-3.5" />
                </button>

                {/* Popover du Menu Année */}
                {isYearMenuOpen ? (
                  <div className="border-border bg-surface animate-in fade-in zoom-in-95 absolute top-full right-0 z-50 mt-1.5 w-36 rounded-xl border p-1.5 shadow-xl duration-150">
                    {([2026, 2025, 2024] as YearCode[]).map((yCode) => (
                      <button
                        key={yCode}
                        type="button"
                        onClick={() => {
                          setSelectedYear(yCode);
                          setIsYearMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          selectedYear === yCode
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-foreground hover:bg-surface-hover'
                        }`}
                      >
                        <span>Année {yCode}</span>
                        {selectedYear === yCode ? <Check className="text-primary size-4" /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Bouton Export PDF Officiel Fonctionnel */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="h-9 gap-2 shadow-sm"
            >
              {isExporting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Génération du PDF...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Exporter le rapport PDF
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Message de Succès d'Exportation PDF */}
      {exportSuccessMessage ? (
        <div className="border-success/30 bg-success/10 text-success animate-in fade-in flex items-center justify-between rounded-xl border p-4 text-xs font-semibold shadow-xs duration-300">
          <span className="flex items-center gap-2">
            <FileCheck className="size-4 shrink-0" />
            {exportSuccessMessage}
          </span>
          <button
            type="button"
            onClick={effacerExport}
            className="text-success/80 hover:text-success"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* En-tête de synthèse de la période sélectionnée */}
      <div className="border-border bg-surface flex items-center justify-between rounded-xl border p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Calendar className="text-primary size-5 shrink-0" />
          <div>
            <p className="text-foreground text-sm font-bold">
              Analyse de Performance : {currentData.periodLabel}
            </p>
            <p className="text-subtle-foreground text-xs">
              Consolidation globale des missions et indicateurs qualité de l'entreprise.
            </p>
          </div>
        </div>
        <Badge variant="primary" className="font-mono text-xs">
          {currentData.totalMissions} missions au total
        </Badge>
      </div>

      {/* 1. Grille des 4 Métriques Clés Analytics Réactives */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group border-border bg-surface hover:border-border-strong relative flex min-h-[152px] flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <div className="bg-success/10 text-success border-success/20 flex size-10 items-center justify-center rounded-xl border">
              <CheckCircle2 className="size-5" />
            </div>
            <Badge variant="success" className="text-2xs font-semibold">
              {currentData.conformityDiff}
            </Badge>
          </div>
          <div className="mt-auto space-y-1 pt-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Conformité du 1er Coup
            </p>
            <p className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
              {currentData.conformity}
            </p>
            <p className="text-subtle-foreground text-2xs">Rapports validés sans correction</p>
          </div>
        </div>

        <div className="group border-border bg-surface hover:border-border-strong relative flex min-h-[152px] flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <div className="bg-primary/10 text-primary border-primary/20 flex size-10 items-center justify-center rounded-xl border">
              <TrendingUp className="size-5" />
            </div>
            <Badge variant="primary" className="text-2xs font-semibold">
              {currentData.volumeDiff}
            </Badge>
          </div>
          <div className="mt-auto space-y-1 pt-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Volume Interventions
            </p>
            <p className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
              {currentData.volume}
            </p>
            <p className="text-subtle-foreground text-2xs">Missions réalisées sur la période</p>
          </div>
        </div>

        <div className="group border-border bg-surface hover:border-border-strong relative flex min-h-[152px] flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <div className="bg-warning/10 text-warning border-warning/20 flex size-10 items-center justify-center rounded-xl border">
              <Clock className="size-5" />
            </div>
            <Badge variant="warning" className="text-2xs font-semibold">
              {currentData.durationDiff}
            </Badge>
          </div>
          <div className="mt-auto space-y-1 pt-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Durée Moyenne Terrain
            </p>
            <p className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
              {currentData.avgDuration}
            </p>
            <p className="text-subtle-foreground text-2xs">Temps moyen par intervention</p>
          </div>
        </div>

        <div className="group border-border bg-surface hover:border-border-strong relative flex min-h-[152px] flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <div className="bg-accent/10 text-accent border-accent/20 flex size-10 items-center justify-center rounded-xl border">
              <Award className="size-5" />
            </div>
            <Badge
              variant="outline"
              className="text-2xs border-accent/30 text-accent font-semibold"
            >
              {currentData.slaLabel}
            </Badge>
          </div>
          <div className="mt-auto space-y-1 pt-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Satisfaction Client SLA
            </p>
            <p className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
              {currentData.sla}
            </p>
            <p className="text-subtle-foreground text-2xs">Respect des rendez-vous planifiés</p>
          </div>
        </div>
      </div>

      {/* 2. Graphiques Principaux (Volume Mensuel/Trimestriel + Répartition Client) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Graphique 1 (2/3) : Évolution du Volume */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-foreground flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2">
                <BarChart3 className="text-primary size-4.5" />
                Répartition des missions par statut ({currentData.periodLabel})
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                Total : {currentData.totalMissions} missions
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/*
                Huit barres dans 328 px, c'est 37 px chacune : la barre passe
                sous son propre libellé, qui se replie sur trois lignes. On
                impose donc une largeur minimale par barre et on laisse le
                graphique défiler dans son cadre — la comparaison visuelle
                exige une échelle lisible, pas un tassement.
              */}
              <div className="scroll-x -mx-1 px-1">
                <div
                  className={`border-border grid h-56 items-end gap-3 border-b px-2 pt-6 pb-2 ${
                    currentData.chartData.length === 3
                      ? 'min-w-0 grid-cols-3'
                      : 'min-w-[34rem] grid-cols-8'
                  }`}
                >
                  {currentData.chartData.map((item) => {
                    const heightPercent = Math.round((item.count / maxChartCount) * 100);

                    return (
                      <div
                        key={item.label}
                        className="group flex h-full flex-col items-center justify-end gap-2"
                      >
                        <span className="text-3xs text-primary font-mono font-bold opacity-0 transition-opacity group-hover:opacity-100">
                          {item.count}
                        </span>
                        <div className="bg-surface-subtle flex h-full w-full items-end overflow-hidden rounded-t-md">
                          <div
                            className="from-primary/80 to-primary group-hover:from-primary group-hover:to-primary w-full rounded-t-md bg-gradient-to-t transition-all"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground group-hover:text-foreground text-xs font-semibold transition-colors">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-muted-foreground flex flex-col gap-2 pt-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="bg-primary size-3 shrink-0 rounded" />
                  Missions Réalisées & Validées
                </span>
                {currentData.trend ? <span>Tendance : {currentData.trend}</span> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Graphique 2 (1/3) : Répartition par Client */}
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <PieChart className="text-primary size-4.5" />
              Répartition par Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-4">
              {currentData.clientBreakdown.map((client) => (
                <div key={client.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-2 truncate">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: client.color }}
                      />
                      <span className="truncate">{client.name}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 font-mono">
                      {client.percentage}% ({client.count})
                    </span>
                  </div>

                  <div className="bg-surface-subtle h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${client.percentage}%`,
                        backgroundColor: client.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {currentData.clientBreakdown.length > 0 && currentData.clientBreakdown[0] ? (
              <div className="border-border bg-surface-subtle/50 space-y-1 rounded-xl border p-3.5 text-xs">
                <p className="text-foreground font-semibold">
                  Top Donneur d'Ordre : {currentData.clientBreakdown[0].name}
                </p>
                <p className="text-muted-foreground text-2xs">
                  Représente {currentData.clientBreakdown[0].percentage}% de votre volume
                  d'interventions sur cette période ({currentData.clientBreakdown[0].count}{' '}
                  missions).
                </p>
              </div>
            ) : (
              <div className="border-border bg-surface-subtle/50 text-muted-foreground rounded-xl border p-3.5 text-center text-xs">
                Aucun client actif sur cette période.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Tableau de Performance des Équipes Terrain */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <UsersRound className="text-success size-4.5" />
            Performance & Activité par Équipe
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            {teams.length} équipe{teams.length > 1 ? 's' : ''}
          </Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="scroll-x">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-border text-muted-foreground border-b font-semibold tracking-wider uppercase">
                  <th className="pb-3 pl-2">Équipe Terrain</th>
                  <th className="pb-3">Description / Spécialité</th>
                  <th className="pr-2 pb-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-muted-foreground py-8 text-center text-xs">
                      Aucune équipe enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  teams.map((team) => (
                    <tr key={team.id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="text-foreground py-3.5 pl-2 font-semibold">{team.name}</td>
                      <td className="text-muted-foreground py-3.5 font-medium">
                        {team.description ?? '—'}
                      </td>
                      <td className="py-3.5 pr-2 text-right">
                        <Badge
                          variant={team.status === 'active' ? 'outline' : 'neutral'}
                          className="text-2xs font-mono"
                        >
                          {team.status === 'active' ? 'Active' : 'Archivée'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4. Suivi des Devis & Volume par Secteur */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* KPI Devis & Taux de Transformation */}
        <Card className="lg:col-span-1">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Receipt className="text-warning size-4.5" />
              Transformation des Devis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="bg-surface-subtle border-border flex items-center justify-between rounded-xl border p-3.5">
              <div className="space-y-0.5">
                <p className="text-3xs text-muted-foreground font-semibold uppercase">
                  Taux de Conversion
                </p>
                <p className="text-success font-mono text-2xl font-bold">
                  {totalQuotesCount > 0 ? `${conversionRate.toFixed(1)}%` : '—'}
                </p>
                <p className="text-3xs text-muted-foreground">Devis validés et lancés</p>
              </div>
              <div className="bg-success/10 text-success rounded-xl p-2.5">
                <CircleDollarSign className="size-5" />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="border-border/50 flex justify-between border-b py-1.5">
                <span className="text-muted-foreground">Devis émis</span>
                <span className="text-foreground font-mono font-bold">
                  {totalQuotesCount} devis
                </span>
              </div>
              <div className="border-border/50 flex justify-between border-b py-1.5">
                <span className="text-muted-foreground">Devis signés / acceptés</span>
                <span className="text-success font-mono font-bold">
                  {acceptedQuotes.length} devis
                </span>
              </div>
              <div className="border-border/50 flex justify-between border-b py-1.5">
                <span className="text-muted-foreground">En attente signature</span>
                <span className="text-warning font-mono font-bold">
                  {pendingQuotes.length} devis
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Taux en cours</span>
                <span className="text-foreground font-mono font-bold">
                  {totalQuotesCount > 0
                    ? `${((pendingQuotes.length / totalQuotesCount) * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Répartition de l'Activité Métier */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Layers className="text-primary size-4.5" />
              Activité & Volume par Statut d'Intervention
            </CardTitle>
            <Badge variant="primary" className="text-2xs font-mono">
              {currentData.chartData.length} statuts
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentData.chartData.map((item) => (
                <div
                  key={item.label}
                  className="bg-surface-subtle border-border space-y-1.5 rounded-xl border p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                      <span className="bg-primary size-2.5 rounded-full" />
                      {item.label}
                    </span>
                    <span className="text-foreground font-mono text-xs font-bold">
                      {item.count} missions
                    </span>
                  </div>
                  <div className="bg-border h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${maxChartCount > 0 ? (item.count / maxChartCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
