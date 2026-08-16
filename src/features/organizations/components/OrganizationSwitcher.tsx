import { Building2, Plus, Wrench, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import {
  DropdownCheckboxItem,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import { ROUTES } from '@/config/routes';
import { useCurrentIndustry } from '@/features/industries';

import { useCurrentOrganization } from '../hooks/useCurrentOrganization';

/**
 * Composant de sélection et d'accès aux paramètres de l'organisation dans le menu utilisateur.
 */
export function OrganizationSwitcher() {
  const { organizations, organization, select, status } = useCurrentOrganization();
  const industry = useCurrentIndustry();

  // Hors organisation, on propose d'en créer une
  if (status === 'none' || organizations.length === 0) {
    return (
      <>
        <DropdownItem asChild>
          <Link to={ROUTES.organizationNew}>
            <Plus className="size-4" />
            <span>Créer une entreprise</span>
          </Link>
        </DropdownItem>
        <DropdownSeparator />
      </>
    );
  }

  // Une seule entreprise : afficher son nom + son métier avec lien direct vers les réglages
  if (organizations.length === 1) {
    return (
      <>
        <DropdownItem asChild>
          <Link
            to={ROUTES.organization}
            className="flex items-center justify-between gap-2 py-2 group hover:bg-surface-hover/80"
            title="Modifier le nom et le secteur d'activité de l'entreprise"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <Building2 className="size-3.5" aria-hidden="true" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {organization?.name ?? 'Entreprise'}
                </p>
                <p className="text-3xs text-muted-foreground truncate flex items-center gap-1">
                  <Wrench className="size-2.5 shrink-0 text-primary" />
                  <span>{industry.isResolved ? industry.label : 'Général'}</span>
                </p>
              </div>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </Link>
        </DropdownItem>
        <DropdownSeparator />
      </>
    );
  }

  // Multiples entreprises : liste sélectionnable + lien de configuration
  return (
    <>
      <DropdownLabel className="flex items-center justify-between text-3xs uppercase tracking-wider text-muted-foreground">
        <span>Entreprise active</span>
        <Link
          to={ROUTES.organization}
          className="text-primary hover:underline lowercase font-medium text-3xs flex items-center gap-0.5"
        >
          <span>modifier</span>
          <ChevronRight className="size-2.5" />
        </Link>
      </DropdownLabel>

      {organizations.map((candidate) => (
        <DropdownCheckboxItem
          key={candidate.id}
          checked={candidate.id === organization?.id}
          onCheckedChange={(checked) => {
            if (checked) select(candidate.id);
          }}
        >
          {candidate.name}
        </DropdownCheckboxItem>
      ))}

      <DropdownItem asChild>
        <Link to={ROUTES.organization} className="text-xs font-medium text-primary gap-2">
          <Wrench className="size-3.5" />
          <span>Modifier le métier ({industry.isResolved ? industry.label : 'Général'})</span>
        </Link>
      </DropdownItem>

      <DropdownSeparator />
    </>
  );
}
