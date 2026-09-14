import { Building2, ChevronRight, ExternalLink } from 'lucide-react';
import { NavLink } from 'react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useCurrentIndustry } from '@/features/industries';
import { useCurrentOrganization } from '@/features/organizations';

export function OrganizationBillingSettingsTab() {
  const { organization } = useCurrentOrganization();
  const { label: industryLabel } = useCurrentIndustry();

  return (
    <div className="animate-in fade-in space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Entreprise & facturation</CardTitle>
              <CardDescription>
                Gérez l'identité légale de votre entreprise, votre métier, l'équipe et vos factures.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 sm:pt-5">
          <div className="border-primary/20 bg-primary/[0.04] flex flex-col items-stretch justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h4 className="text-foreground truncate text-sm font-semibold">
                {organization?.name ?? 'Entreprise'}
              </h4>
              <p className="text-muted-foreground mt-1 text-xs">
                Métier actif : <strong className="text-foreground">{industryLabel}</strong>
              </p>
            </div>

            <NavLink
              to={ROUTES.organization}
              className="min-h-touch text-primary hover:bg-primary/10 flex items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold sm:min-h-0 sm:justify-start"
            >
              <span>Paramètres Entreprise</span>
              <ChevronRight className="size-3.5" />
            </NavLink>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <NavLink
              to={ROUTES.organizationBilling}
              className="group border-border bg-surface-raised hover:border-primary/40 hover:bg-surface-hover hover:shadow-raised flex min-h-24 items-center justify-between rounded-xl border p-4 transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              <div>
                <h5 className="text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
                  Abonnement & Facturation
                </h5>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Changer de formule, gérer les sièges et factures Stripe.
                </p>
              </div>
              <ExternalLink className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors" />
            </NavLink>

            <NavLink
              to={ROUTES.organizationMembers}
              className="group border-border bg-surface-raised hover:border-primary/40 hover:bg-surface-hover hover:shadow-raised flex min-h-24 items-center justify-between rounded-xl border p-4 transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              <div>
                <h5 className="text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
                  Équipe & Techniciens
                </h5>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Gérer les membres, les invitations et les rôles.
                </p>
              </div>
              <ChevronRight className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors" />
            </NavLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
