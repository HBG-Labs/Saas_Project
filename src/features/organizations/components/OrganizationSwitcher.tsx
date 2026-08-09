import { Building2, Plus } from 'lucide-react';
import { Link } from 'react-router';

import {
  DropdownCheckboxItem,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import { ROUTES } from '@/config/routes';

import { useCurrentOrganization } from '../hooks/useCurrentOrganization';

/**
 * Bascule d'organisation, à insérer dans le menu du compte.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DANS CE MENU PLUTÔT QUE DANS L'EN-TÊTE
 *
 * Le sélecteur permanent des outils SaaS (Linear, Vercel) se justifie quand
 * changer d'espace est une action quotidienne. Ici, un technicien appartient à
 * une entreprise et n'en changera jamais ; un prestataire en aura deux ou trois.
 * Occuper en permanence une place dans une barre déjà chargée pour une action
 * rare serait un mauvais échange — d'autant que le nom de l'entreprise
 * n'apporte aucune information à qui n'en a qu'une.
 *
 * Ce composant rend donc des ÉLÉMENTS de menu, pas un menu : il se compose dans
 * le `Dropdown` existant sans en créer un second.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function OrganizationSwitcher() {
  const { organizations, organization, select, status } = useCurrentOrganization();

  // Hors organisation, on propose d'en créer une plutôt que de n'afficher
  // qu'un intitulé surmontant le vide.
  if (status === 'none' || organizations.length === 0) {
    return (
      <>
        <DropdownItem asChild>
          <Link to={ROUTES.organizationNew}>
            <Plus />
            Créer une entreprise
          </Link>
        </DropdownItem>
        <DropdownSeparator />
      </>
    );
  }

  // Une seule entreprise : afficher son nom informe (on sait où l'on travaille),
  // mais un sélecteur à un choix est du bruit.
  if (organizations.length === 1) {
    return (
      <>
        <DropdownLabel>
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3" aria-hidden="true" />
            {organization?.name}
          </span>
        </DropdownLabel>
        <DropdownSeparator />
      </>
    );
  }

  return (
    <>
      <DropdownLabel>Entreprise</DropdownLabel>
      {organizations.map((candidate) => (
        <DropdownCheckboxItem
          key={candidate.id}
          checked={candidate.id === organization?.id}
          // Radix appelle le gestionnaire même en décochant. Ignorer ce cas
          // évite de se retrouver sans organisation sélectionnée en cliquant sur
          // celle qui l'est déjà.
          onCheckedChange={(checked) => {
            if (checked) select(candidate.id);
          }}
        >
          {candidate.name}
        </DropdownCheckboxItem>
      ))}
      <DropdownSeparator />
    </>
  );
}
