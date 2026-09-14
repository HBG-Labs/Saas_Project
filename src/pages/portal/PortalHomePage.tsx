import { ChevronRight, FileText, FolderOpen, MessageSquare, Receipt, Sparkles, Wrench } from 'lucide-react';
import { Link, useOutletContext } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  formatDateFr,
  formatEuros,
  invoiceIsDue,
  StatusBadge,
  usePortalConversations,
  usePortalDocuments,
  usePortalInvoices,
  usePortalMissions,
} from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { PortalContext } from '@/types/database';

/**
 * Accueil : quatre repères, puis les dernières interventions, factures,
 * échanges et documents. Chaque bloc n'apparaît que si le module existe chez
 * l'entreprise — un client n'a pas à voir un bloc « Factures » vide parce que
 * son prestataire facture ailleurs.
 */
export default function PortalHomePage() {
  useDocumentTitle('Accueil — Espace client');
  const context = useOutletContext<PortalContext>();
  const missions = usePortalMissions();
  const invoices = usePortalInvoices();
  const conversations = usePortalConversations();
  const documents = usePortalDocuments();

  const missionList = missions.data ?? [];
  const invoiceList = invoices.data ?? [];
  const enCours = missionList.filter((m) => m.status === 'in_progress' || m.status === 'assigned' || m.status === 'accepted').length;
  const realisees = missionList.filter((m) => m.status === 'completed').length;
  const dues = invoiceList.filter((i) => invoiceIsDue(i.status));
  const montantDu = dues.reduce((sum, i) => sum + i.total_cents, 0);
  const nonLus = (conversations.data ?? []).reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="space-y-4">
      {/* Bandeau d'accueil : la touche de couleur de la page, tout le reste est calme. */}
      <section className="from-primary via-primary text-primary-foreground relative overflow-hidden rounded-2xl bg-gradient-to-br to-blue-500 p-4 shadow-md sm:p-5">
        <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 size-48 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/25">
          <Sparkles className="size-3" aria-hidden="true" />
          Espace client
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
          Bonjour{context.contact_first_name ? ` ${context.contact_first_name}` : ''} 👋
        </h1>
        <p className="mt-1 max-w-xl text-sm text-white/85">
          Retrouvez ici tout ce que {context.organization_name} partage avec vous : interventions, devis,
          factures, documents et échanges — au même endroit, à jour.
        </p>
      </section>

      <section aria-labelledby="portal-priorities-title" className="space-y-2">
        <div>
          <h2 id="portal-priorities-title" className="text-sm font-bold text-foreground">
            À suivre
          </h2>
          <p className="text-xs text-muted-foreground">Vos échéances et activités essentielles.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {context.features.invoicing ? (
          <Kpi
            label={dues.length > 0 ? `${String(dues.length)} facture${dues.length > 1 ? 's' : ''} à régler` : 'Aucune facture à régler'}
            value={invoices.isPending ? null : formatEuros(montantDu)}
            icon={Receipt}
            tone={montantDu > 0 ? 'warning' : 'success'}
            to={ROUTES.portalInvoices}
          />
        ) : null}
        {context.features.missions ? (
          <Kpi
            label="Interventions en cours"
            value={missions.isPending ? null : String(enCours)}
            icon={Wrench}
            tone="primary"
            to={ROUTES.portalMissions}
          />
        ) : null}
        <Kpi
          label="Messages non lus"
          value={conversations.isPending ? null : String(nonLus)}
          icon={MessageSquare}
          tone={nonLus > 0 ? 'accent' : 'info'}
          to={ROUTES.portalMessages}
        />
        {context.features.missions ? (
          <Kpi
            label="Interventions réalisées"
            value={missions.isPending ? null : String(realisees)}
            icon={Wrench}
            tone="success"
            to={ROUTES.portalMissions}
          />
        ) : null}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {context.features.invoicing ? (
          <Section title="Dernières factures" to={ROUTES.portalInvoices} icon={Receipt} query={invoices}>
            {invoiceList.slice(0, 4).map((i) => (
              <Row key={i.id} to={ROUTES.portalInvoices} title={i.reference} subtitle={`${formatDateFr(i.issued_at)} · ${formatEuros(i.total_cents)}`}>
                <StatusBadge status={i.status} kind="invoice" />
              </Row>
            ))}
          </Section>
        ) : null}

        {context.features.missions ? (
          <Section title="Dernières interventions" to={ROUTES.portalMissions} icon={Wrench} query={missions}>
            {missionList.slice(0, 4).map((m) => (
              <Row key={m.id} to={ROUTES.portalMission(m.id)} title={m.title} subtitle={`${m.reference} · ${formatDateFr(m.scheduled_start)}`}>
                <StatusBadge status={m.status} kind="mission" />
              </Row>
            ))}
          </Section>
        ) : null}

        <Section title="Derniers échanges" to={ROUTES.portalMessages} icon={MessageSquare} query={conversations}>
          {(conversations.data ?? []).slice(0, 4).map((c) => (
            <Row key={c.id} to={ROUTES.portalMessages} title={c.subject} subtitle={formatDateFr(c.last_message_at, true)}>
              {c.unread_count > 0 ? (
                <span className="bg-primary text-primary-foreground rounded-full px-2 text-xs font-bold">{c.unread_count}</span>
              ) : null}
            </Row>
          ))}
        </Section>

        {context.features.documents ? (
          <Section title="Documents récents" to={ROUTES.portalDocuments} icon={FolderOpen} query={documents}>
            {(documents.data ?? []).slice(0, 4).map((d) => (
              <Row key={d.id} to={ROUTES.portalDocuments} title={d.name} subtitle={formatDateFr(d.created_at)}>
                <FileText className="text-muted-foreground size-4" aria-hidden="true" />
              </Row>
            ))}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

type KpiTone = 'primary' | 'success' | 'warning' | 'info' | 'accent';

const KPI_TONES: Record<KpiTone, string> = {
  primary: 'bg-primary-subtle text-primary',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  info: 'bg-info-subtle text-info',
  accent: 'bg-accent-subtle text-accent',
};

function Kpi({ label, value, icon: Icon, tone, to }: { label: string; value: string | null; icon: typeof Wrench; tone: KpiTone; to: string }) {
  return (
    <Link
      to={to}
      className="border-border bg-surface hover:border-primary/40 flex min-h-[4.75rem] items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-xs transition-[border-color,box-shadow] duration-150 hover:shadow-md"
    >
      <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${KPI_TONES[tone]}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        {value === null ? (
          <Skeleton className="h-5 w-12" />
        ) : (
          <span className="text-foreground block truncate text-lg leading-tight font-bold tracking-tight">{value}</span>
        )}
        <span className="text-muted-foreground block text-3xs leading-tight">{label}</span>
      </span>
    </Link>
  );
}

function Section({
  title,
  to,
  icon: Icon,
  query,
  children,
}: {
  title: string;
  to: string;
  icon: typeof Wrench;
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: unknown[] | undefined };
  children: React.ReactNode;
}) {
  const empty = !query.isPending && !query.isError && (query.data?.length ?? 0) === 0;
  return (
    <Card className="rounded-xl shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="text-primary size-4" aria-hidden="true" />
          {title}
        </CardTitle>
        <Link to={to} className="text-primary flex items-center gap-0.5 text-xs font-semibold hover:underline">
          Tout voir
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-3">
        {query.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : empty ? (
          <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-3 py-2.5 text-center text-xs">
            Rien pour le moment.
          </p>
        ) : (
          <ul className="divide-border divide-y">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ to, title, subtitle, children }: { to: string; title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="hover:bg-surface-hover -mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{title}</p>
          <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
        </div>
        {children}
      </Link>
    </li>
  );
}
