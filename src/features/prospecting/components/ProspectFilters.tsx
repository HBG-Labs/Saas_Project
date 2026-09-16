import { Search } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import type { ProspectStatus } from '@/types/database';

import { PROSPECT_STATUS_LABELS } from '../lib/prospect-display';
import type { ProspectFilters as Filters } from '../api/prospecting.api';
import { useProspectingSectors, useProspectingZones } from '../hooks/useProspecting';

const PROSPECT_STATUSES: ProspectStatus[] = [
  'nouveau',
  'a_qualifier',
  'a_contacter',
  'contacte',
  'a_relancer',
  'interesse',
  'essai',
  'converti',
  'refuse',
  'ignore',
  'ne_plus_contacter',
];

/**
 * §15 du cahier des charges. Un sous-ensemble volontaire : les filtres
 * « email/téléphone/site disponible » n'apparaissent pas — aucune source
 * d'enrichissement n'est branchée en V1 (`prospect_contacts` reste vide),
 * les proposer afficherait un filtre qui ne fait jamais rien.
 */
export interface ProspectFiltersBarProps {
  value: Filters;
  onChange: (value: Filters) => void;
}

export function ProspectFiltersBar({ value, onChange }: ProspectFiltersBarProps) {
  const { data: zones } = useProspectingZones();
  const { data: sectors } = useProspectingSectors();

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch, page: 0 });

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex-1 sm:min-w-[220px]">
        <Input
          label="Rechercher un prospect"
          hideLabel
          placeholder="Raison sociale, nom commercial, SIREN…"
          value={value.search ?? ''}
          onChange={(e) => set({ search: e.target.value })}
          leadingIcon={<Search aria-hidden="true" />}
        />
      </div>

      <SelectField
        value={value.status ?? 'all'}
        onChange={(e) => set({ status: e.target.value === 'all' ? undefined : (e.target.value as ProspectStatus) })}
        aria-label="Filtrer par statut"
      >
        <option value="all">Tous statuts</option>
        {PROSPECT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PROSPECT_STATUS_LABELS[status]}
          </option>
        ))}
      </SelectField>

      <SelectField
        value={value.zoneId ?? 'all'}
        onChange={(e) => set({ zoneId: e.target.value === 'all' ? undefined : e.target.value })}
        aria-label="Filtrer par zone"
      >
        <option value="all">Toutes zones</option>
        {(zones ?? []).map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        value={value.sectorId ?? 'all'}
        onChange={(e) => set({ sectorId: e.target.value === 'all' ? undefined : e.target.value })}
        aria-label="Filtrer par secteur"
      >
        <option value="all">Tous secteurs</option>
        {(sectors ?? []).map((sector) => (
          <option key={sector.id} value={sector.id}>
            {sector.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        value={value.priority ?? 'all'}
        onChange={(e) =>
          set({ priority: e.target.value === 'all' ? undefined : (e.target.value as Filters['priority']) })
        }
        aria-label="Filtrer par priorité"
      >
        <option value="all">Toutes priorités</option>
        <option value="haute">Haute</option>
        <option value="normale">Normale</option>
        <option value="basse">Basse</option>
      </SelectField>
    </div>
  );
}
