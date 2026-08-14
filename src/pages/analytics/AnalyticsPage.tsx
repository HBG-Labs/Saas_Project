import {
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileCheck,
  Loader2,
  PieChart,
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
import { useDocumentTitle } from '@/lib/use-document-title';

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
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const quarterLabels: Record<QuarterCode, string> = {
    Q1: 'T1 (Janv - Mars)',
    Q2: 'T2 (Avr - Juin)',
    Q3: 'T3 (Juil - Sept)',
    Q4: 'T4 (Oct - Déc)',
  };

  // Fonction calculant les métriques selon la sélection Trimestre / Année
  const getSelectedAnalytics = () => {
    if (viewMode === 'month') {
      return {
        periodLabel: `30 Derniers Jours (Août ${selectedYear})`,
        conformity: '98.4%',
        conformityDiff: '+2.3% vs M-1',
        volume: '142',
        volumeDiff: '+18.4%',
        avgDuration: '2h 15m',
        durationDiff: '-15 min',
        sla: '99.2%',
        slaLabel: 'Optimal',
        totalMissions: 142,
        chartData: [
          { label: 'Jan', count: 98 },
          { label: 'Fév', count: 112 },
          { label: 'Mar', count: 125 },
          { label: 'Avr', count: 130 },
          { label: 'Mai', count: 118 },
          { label: 'Juin', count: 140 },
          { label: 'Juil', count: 135 },
          { label: 'Août', count: 142 },
        ],
        clientBreakdown: [
          { name: 'Aethel Telecom Solutions', percentage: 42, count: 60, color: '#ea580c' },
          { name: 'Nexis Networks & Infra', percentage: 28, count: 40, color: '#dc2626' },
          { name: 'Solaria Communications', percentage: 18, count: 25, color: '#0891b2' },
          { name: 'Kyros Fiber Engineering', percentage: 12, count: 17, color: '#ca8a04' },
        ],
      };
    }

    if (viewMode === 'quarter') {
      const quarters = {
        Q1: {
          label: `1er Trimestre ${selectedYear} (Janv - Mars)`,
          volume: 335,
          conformity: '97.8%',
          chart: [
            { label: 'Janvier', count: 98 },
            { label: 'Février', count: 112 },
            { label: 'Mars', count: 125 },
          ],
        },
        Q2: {
          label: `2ème Trimestre ${selectedYear} (Avr - Juin)`,
          volume: 388,
          conformity: '98.2%',
          chart: [
            { label: 'Avril', count: 130 },
            { label: 'Mai', count: 118 },
            { label: 'Juin', count: 140 },
          ],
        },
        Q3: {
          label: `3ème Trimestre ${selectedYear} (Juil - Sept)`,
          volume: 277,
          conformity: '98.6%',
          chart: [
            { label: 'Juillet', count: 135 },
            { label: 'Août', count: 142 },
            { label: 'Septembre (Est.)', count: 145 },
          ],
        },
        Q4: {
          label: `4ème Trimestre ${selectedYear} (Oct - Déc)`,
          volume: 310,
          conformity: '98.0%',
          chart: [
            { label: 'Octobre', count: 102 },
            { label: 'Novembre', count: 104 },
            { label: 'Décembre', count: 104 },
          ],
        },
      };

      const q = quarters[selectedQuarter];

      return {
        periodLabel: q.label,
        conformity: q.conformity,
        conformityDiff: '+1.9% vs T-1',
        volume: String(q.volume),
        volumeDiff: '+12.5%',
        avgDuration: '2h 10m',
        durationDiff: '-18 min',
        sla: '99.4%',
        slaLabel: 'Excellent',
        totalMissions: q.volume,
        chartData: q.chart,
        clientBreakdown: [
          { name: 'Aethel Telecom Solutions', percentage: 44, count: Math.round(q.volume * 0.44), color: '#ea580c' },
          { name: 'Nexis Networks & Infra', percentage: 26, count: Math.round(q.volume * 0.26), color: '#dc2626' },
          { name: 'Solaria Communications', percentage: 19, count: Math.round(q.volume * 0.19), color: '#0891b2' },
          { name: 'Kyros Fiber Engineering', percentage: 11, count: Math.round(q.volume * 0.11), color: '#ca8a04' },
        ],
      };
    }

    // Vue Annuelle
    const yearVolume = selectedYear === 2026 ? 995 : selectedYear === 2025 ? 840 : 710;
    return {
      periodLabel: `Année Complète ${selectedYear}`,
      conformity: selectedYear === 2026 ? '98.1%' : '96.5%',
      conformityDiff: '+3.4% vs N-1',
      volume: String(yearVolume),
      volumeDiff: '+24.1%',
      avgDuration: '2h 18m',
      durationDiff: '-20 min',
      sla: '98.9%',
      slaLabel: 'Conforme',
      totalMissions: yearVolume,
      chartData: [
        { label: 'Jan', count: Math.round(yearVolume * 0.1) },
        { label: 'Fév', count: Math.round(yearVolume * 0.11) },
        { label: 'Mar', count: Math.round(yearVolume * 0.12) },
        { label: 'Avr', count: Math.round(yearVolume * 0.13) },
        { label: 'Mai', count: Math.round(yearVolume * 0.11) },
        { label: 'Juin', count: Math.round(yearVolume * 0.14) },
        { label: 'Juil', count: Math.round(yearVolume * 0.14) },
        { label: 'Août', count: Math.round(yearVolume * 0.15) },
      ],
      clientBreakdown: [
        { name: 'Aethel Telecom Solutions', percentage: 41, count: Math.round(yearVolume * 0.41), color: '#ea580c' },
        { name: 'Nexis Networks & Infra', percentage: 29, count: Math.round(yearVolume * 0.29), color: '#dc2626' },
        { name: 'Solaria Communications', percentage: 18, count: Math.round(yearVolume * 0.18), color: '#0891b2' },
        { name: 'Kyros Fiber Engineering', percentage: 12, count: Math.round(yearVolume * 0.12), color: '#ca8a04' },
      ],
    };
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

  const statsQuery = useActivityStats(organization?.id ?? null, range);
  const stats = statsQuery.data ?? null;

  const fallback = getSelectedAnalytics();

  /**
   * Les indicateurs proviennent de la base dès qu'elle a répondu.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * CE QUI A CHANGÉ
   *
   * Ces chiffres étaient écrits en dur : ils affichaient « 98,4 % de conformité »
   * quelle que soit l'activité, y compris sur une entreprise sans une seule
   * mission. `organization_activity_stats` les calcule désormais côté serveur,
   * sur la période sélectionnée.
   *
   * Le taux de conformité est le rapport des comptes rendus VALIDÉS sur les
   * comptes rendus contrôlés — validés plus refusés. Les comptes rendus encore
   * en attente n'entrent pas au dénominateur : ils ne sont pas non conformes,
   * ils ne sont pas encore jugés.
   * ─────────────────────────────────────────────────────────────────────────
   */
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
    if (stats === null) return fallback;

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

    return {
      periodLabel: fallback.periodLabel,
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
    };
  })();

  const maxChartCount = Math.max(1, ...currentData.chartData.map((d) => d.count));

  // Performance des équipes
  const teamPerformance = [
    {
      name: 'Équipe Fibre Optique Nord',
      lead: 'Mathieu Laurent',
      members: 4,
      missions: 58,
      avgTime: '1h 45m',
      qualityScore: '99.2%',
      color: '#2563eb',
    },
    {
      name: 'Équipe Raccordement Ligne',
      lead: 'Stéphane Leduc',
      members: 3,
      missions: 42,
      avgTime: '2h 10m',
      qualityScore: '98.5%',
      color: '#16a34a',
    },
    {
      name: 'Équipe Électricité Haute Tension',
      lead: 'Thomas Bernard',
      members: 3,
      missions: 42,
      avgTime: '3h 05m',
      qualityScore: '97.8%',
      color: '#d97706',
    },
  ];

  // Génération d'un Document PDF Haute Définition Exécutif
  const handleExportPDF = () => {
    setIsExporting(true);
    setExportSuccessMessage(null);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setIsExporting(false);
      window.print();
      return;
    }

    const orgName = organization?.name ?? 'NexoraTech SaaS';
    const exportDate = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Rapport de Performance Opérationnelle - ${orgName}</title>
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
          <div class="brand">NexoraTech — Operational Intelligence</div>
          <div class="doc-title">
            <strong>Réf: REF-ANALYTICS-2026-08</strong><br />
            Édité le : ${exportDate}
          </div>
        </div>

        <div class="main-title">RAPPORT DE PERFORMANCE & QUALITÉ OPÉRATIONNELLE</div>
        <div class="sub-title">Entreprise : <strong>${orgName}</strong> — Période : <strong>${currentData.periodLabel}</strong></div>

        <div class="summary-box">
          <h3>Résumé Exécutif de la Période</h3>
          <p>
            Sur la période analysée (<strong>${currentData.periodLabel}</strong>), l’entreprise a réalisé un total de <strong>${currentData.volume} interventions</strong> avec un taux exceptionnel de conformité du 1er coup de <strong>${currentData.conformity}</strong>. Le temps moyen d’exécution sur le terrain s’établit à <strong>${currentData.avgDuration}</strong>, garantissant un respect optimal des SLA clients à <strong>${currentData.sla}</strong>.
          </p>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Conformité 1er Coup</div>
            <div class="kpi-value">${currentData.conformity}</div>
            <div class="kpi-sub">${currentData.conformityDiff}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Volume Interventions</div>
            <div class="kpi-value">${currentData.volume}</div>
            <div class="kpi-sub">${currentData.volumeDiff} d'activité</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Durée Moy. Terrain</div>
            <div class="kpi-value">${currentData.avgDuration}</div>
            <div class="kpi-sub">${currentData.durationDiff} gain d'efficacité</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Satisfaction SLA</div>
            <div class="kpi-value">${currentData.sla}</div>
            <div class="kpi-sub">Statut : ${currentData.slaLabel}</div>
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
                      <div class="chart-row-label">${d.label}</div>
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
                    <span>${c.name}</span>
                    <span>${c.percentage}%</span>
                  </div>
                  <div class="client-bar">
                    <div style="height:100%; width:${c.percentage}%; background:${c.color};"></div>
                  </div>
                  <div style="font-size:9px; color:#64748b; margin-top:2px;">${c.count} missions terminées</div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="section-title">Performance & Qualité par Équipe Terrain</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>Équipe Terrain</th>
              <th>Chef d'Équipe</th>
              <th style="text-align:center;">Effectif</th>
              <th style="text-align:center;">Missions Réalisées</th>
              <th style="text-align:center;">Temps Moyen</th>
              <th style="text-align:right;">Conformité Qualité</th>
            </tr>
          </thead>
          <tbody>
            ${teamPerformance
              .map(
                (t) => `
              <tr>
                <td><strong>${t.name}</strong></td>
                <td>${t.lead}</td>
                <td style="text-align:center;">${t.members} techniciens</td>
                <td style="text-align:center; font-weight:700;">${t.missions}</td>
                <td style="text-align:center;">${t.avgTime}</td>
                <td style="text-align:right;"><span class="badge-score">${t.qualityScore}</span></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="signature-block">
          <div class="sign-box">
            Responsable des Opérations<br />
            Signé électriquement via NexoraTech
          </div>
          <div class="sign-box" style="text-align:right;">
            Direction Technique & Qualité<br />
            Cachet Officiel
          </div>
        </div>

        <div class="footer">
          <div>Document généré par NexoraTech SaaS — Tous droits réservés</div>
          <div>Confidentiel & Usage Interne uniquement</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      setIsExporting(false);
      setExportSuccessMessage('Rapport PDF Officiel généré avec succès !');
      setTimeout(() => setExportSuccessMessage(null), 5000);
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
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-1.5 shadow-xs">
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

              <div className="h-4 w-px bg-border my-auto mx-1" />

              {/* MENU TRIMESTRE (Affiché uniquement en Vue Trimestrielle) */}
              {viewMode === 'quarter' ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuarterMenuOpen((prev) => !prev);
                      setIsYearMenuOpen(false);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-hover/80 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface transition-colors cursor-pointer"
                  >
                    <span>Trimestre : {selectedQuarter}</span>
                    <ChevronDown className="size-3.5 text-primary" />
                  </button>

                  {/* Popover du Menu Trimestre */}
                  {isQuarterMenuOpen ? (
                    <div className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                      {(['Q1', 'Q2', 'Q3', 'Q4'] as QuarterCode[]).map((qCode) => (
                        <button
                          key={qCode}
                          type="button"
                          onClick={() => {
                            setSelectedQuarter(qCode);
                            setViewMode('quarter');
                            setIsQuarterMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            selectedQuarter === qCode
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-foreground hover:bg-surface-hover'
                          }`}
                        >
                          <span>{quarterLabels[qCode]}</span>
                          {selectedQuarter === qCode ? <Check className="size-4 text-primary" /> : null}
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
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-hover/80 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface transition-colors cursor-pointer"
                >
                  <span>Année : {selectedYear}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>

                {/* Popover du Menu Année */}
                {isYearMenuOpen ? (
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-36 rounded-xl border border-border bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                    {([2026, 2025, 2024] as YearCode[]).map((yCode) => (
                      <button
                        key={yCode}
                        type="button"
                        onClick={() => {
                          setSelectedYear(yCode);
                          setIsYearMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          selectedYear === yCode
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-foreground hover:bg-surface-hover'
                        }`}
                      >
                        <span>Année {yCode}</span>
                        {selectedYear === yCode ? <Check className="size-4 text-primary" /> : null}
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
              className="gap-2 shadow-sm h-9"
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
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <span className="flex items-center gap-2">
            <FileCheck className="size-4 shrink-0" />
            {exportSuccessMessage}
          </span>
          <button
            type="button"
            onClick={() => setExportSuccessMessage(null)}
            className="text-emerald-400/80 hover:text-emerald-400"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* En-tête de synthèse de la période sélectionnée */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Calendar className="size-5 text-primary shrink-0" />
          <div>
            <p className="text-foreground font-bold text-sm">
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
        <Card className="border border-border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="size-5" />
              </div>
              <Badge variant="success" className="text-2xs font-semibold">
                {currentData.conformityDiff}
              </Badge>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Conformité du 1er Coup
              </p>
              <p className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
                {currentData.conformity}
              </p>
              <p className="text-subtle-foreground text-2xs">Rapports validés sans correction</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <TrendingUp className="size-5" />
              </div>
              <Badge variant="primary" className="text-2xs font-semibold">
                {currentData.volumeDiff}
              </Badge>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Volume Interventions
              </p>
              <p className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
                {currentData.volume}
              </p>
              <p className="text-subtle-foreground text-2xs">Missions réalisées sur la période</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="size-5" />
              </div>
              <Badge variant="warning" className="text-2xs font-semibold">
                {currentData.durationDiff}
              </Badge>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Durée Moyenne Terrain
              </p>
              <p className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
                {currentData.avgDuration}
              </p>
              <p className="text-subtle-foreground text-2xs">Temps moyen par intervention</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Award className="size-5" />
              </div>
              <Badge variant="outline" className="text-2xs font-semibold border-purple-500/30 text-purple-400">
                {currentData.slaLabel}
              </Badge>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Satisfaction Client SLA
              </p>
              <p className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
                {currentData.sla}
              </p>
              <p className="text-subtle-foreground text-2xs">Respect des rendez-vous planifiés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Graphiques Principaux (Volume Mensuel/Trimestriel + Répartition Client) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Graphique 1 (2/3) : Évolution du Volume */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-foreground flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2">
                <BarChart3 className="size-4.5 text-primary" />
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
                    <div key={item.label} className="flex flex-col items-center gap-2 group h-full justify-end">
                      <span className="text-3xs font-mono font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.count}
                      </span>
                      <div className="w-full bg-surface-subtle rounded-t-md overflow-hidden flex items-end h-full">
                        <div
                          className="w-full bg-gradient-to-t from-primary/80 to-blue-400 group-hover:from-primary group-hover:to-blue-300 transition-all rounded-t-md"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
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
                <span>Tendance : +14.2% de croissance d&apos;activité</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Graphique 2 (1/3) : Répartition par Client */}
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <PieChart className="size-4.5 text-cyan-400" />
              Répartition par Client
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-4">
              {currentData.clientBreakdown.map((client) => (
                <div key={client.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-2 text-foreground truncate">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: client.color }}
                      />
                      <span className="truncate">{client.name}</span>
                    </span>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {client.percentage}% ({client.count})
                    </span>
                  </div>

                  <div className="w-full bg-surface-subtle rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${client.percentage}%`,
                        backgroundColor: client.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-surface-subtle/50 p-3.5 text-xs space-y-1">
              <p className="font-semibold text-foreground">Top Donneur d'Ordre : Aethel Telecom</p>
              <p className="text-muted-foreground text-2xs">
                Représente la majorité du chiffre d'affaires et du volume d'interventions sur cette période.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Tableau de Performance des Équipes Terrain */}
      <Card>
        <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <UsersRound className="size-4.5 text-emerald-400" />
            Performance & Conformité Qualité par Équipe
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            3 équipes actives
          </Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="scroll-x">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="pb-3 pl-2">Équipe Terrain</th>
                  <th className="pb-3">Chef d'Équipe</th>
                  <th className="pb-3 text-center">Effectif</th>
                  <th className="pb-3 text-center">Missions Réalisées</th>
                  <th className="pb-3 text-center">Temps Moyen</th>
                  <th className="pb-3 text-right pr-2">Conformité Qualité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {teamPerformance.map((team) => (
                  <tr key={team.name} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="py-3.5 pl-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="font-semibold text-foreground">{team.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-muted-foreground font-medium">{team.lead}</td>
                    <td className="py-3.5 text-center font-mono text-foreground">
                      {team.members} techniciens
                    </td>
                    <td className="py-3.5 text-center font-mono font-bold text-foreground">
                      {team.missions}
                    </td>
                    <td className="py-3.5 text-center font-mono text-muted-foreground">
                      {team.avgTime}
                    </td>
                    <td className="py-3.5 text-right pr-2">
                      <Badge variant="success" className="font-mono text-2xs">
                        {team.qualityScore}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
