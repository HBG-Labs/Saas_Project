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
    <div className="space-y-4 animate-in fade-in">
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Building2 className="size-3.5 text-primary" />
            <span>Entreprise & Facturation</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Gérez l'identité légale de votre entreprise, votre métier, l'équipe et vos factures.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0 space-y-3">
          <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface border border-border">
            <div>
              <h4 className="text-xs font-bold text-foreground">
                {organization?.name ?? 'Entreprise'}
              </h4>
              <p className="text-3xs text-muted-foreground">
                Métier actif : <strong className="text-foreground">{industryLabel}</strong>
              </p>
            </div>

            <NavLink
              to={ROUTES.organization}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <span>Paramètres Entreprise</span>
              <ChevronRight className="size-3.5" />
            </NavLink>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <NavLink
              to={ROUTES.organizationBilling}
              className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:border-primary/40 hover:bg-surface-hover transition-all group"
            >
              <div>
                <h5 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  Abonnement & Facturation
                </h5>
                <p className="text-3xs text-muted-foreground">
                  Changer de formule, gérer les sièges et factures Stripe.
                </p>
              </div>
              <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </NavLink>

            <NavLink
              to={ROUTES.organizationMembers}
              className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:border-primary/40 hover:bg-surface-hover transition-all group"
            >
              <div>
                <h5 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  Équipe & Techniciens
                </h5>
                <p className="text-3xs text-muted-foreground">
                  Gérer les membres, les invitations et les rôles.
                </p>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </NavLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
