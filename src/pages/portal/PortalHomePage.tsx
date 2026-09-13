import { ChevronRight, FileText, FolderOpen, MessageSquare, Receipt, Wrench } from 'lucide-react';
import { Link, useOutletContext } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  formatDateFr,
  formatEuros,
  invoiceIsDue,
  PortalPageHeader,
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
    <div className="space-y-6">
      <PortalPageHeader
        title={`Bonjour${context.contact_first_name ? ` ${context.contact_first_name}` : ''}`}
        description={`Votre espace client chez ${context.organization_name}.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {context.features.missions ? (
          <>
            <Kpi label="Interventions en cours" value={missions.isPending ? null : String(enCours)} icon={Wrench} to={ROUTES.portalMissions} />
            <Kpi label="Interventions réalisées" value={missions.isPending ? null : String(realisees)} icon={Wrench} to={ROUTES.portalMissions} />
          </>
        ) : null}
        {context.features.invoicing ? (
          <>
            <Kpi label="Factures à régler" value={invoices.isPending ? null : String(dues.length)} icon={Receipt} to={ROUTES.portalInvoices} />
            <Kpi label="Montant dû" value={invoices.isPending ? null : formatEuros(montantDu)} icon={Receipt} to={ROUTES.portalInvoices} />
          </>
        ) : null}
        <Kpi label="Messages non lus" value={conversations.isPending ? null : String(nonLus)} icon={MessageSquare} to={ROUTES.portalMessages} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {context.features.missions ? (
          <Section title="Dernières interventions" to={ROUTES.portalMissions} icon={Wrench} query={missions}>
            {missionList.slice(0, 4).map((m) => (
              <Row key={m.id} to={ROUTES.portalMission(m.id)} title={m.title} subtitle={`${m.reference} · ${formatDateFr(m.scheduled_start)}`}>
                <StatusBadge status={m.status} kind="mission" />
              </Row>
            ))}
          </Section>
        ) : null}

        {context.features.invoicing ? (
          <Section title="Dernières factures" to={ROUTES.portalInvoices} icon={Receipt} query={invoices}>
            {invoiceList.slice(0, 4).map((i) => (
              <Row key={i.id} to={ROUTES.portalInvoices} title={i.reference} subtitle={`${formatDateFr(i.issued_at)} · ${formatEuros(i.total_cents)}`}>
                <StatusBadge status={i.status} kind="invoice" />
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

function Kpi({ label, value, icon: Icon, to }: { label: string; value: string | null; icon: typeof Wrench; to: string }) {
  return (
    <Link to={to} className="border-border bg-surface hover:border-primary/50 block rounded-xl border p-3 transition-colors sm:p-4">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="text-foreground mt-1 text-2xl font-bold tracking-tight">{value}</p>
      )}
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="text-primary size-4" aria-hidden="true" />
          {title}
        </CardTitle>
        <Link to={to} className="text-primary flex items-center gap-0.5 text-xs font-semibold hover:underline">
          Tout voir
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {query.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : empty ? (
          <p className="text-muted-foreground py-3 text-xs">Rien pour le moment.</p>
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
      <Link to={to} className="hover:bg-surface-hover -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{title}</p>
          <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
        </div>
        {children}
      </Link>
    </li>
  );
}
