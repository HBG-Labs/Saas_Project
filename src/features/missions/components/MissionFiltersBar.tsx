import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCustomers } from '@/features/customers';
import { memberDisplayName, useMembers } from '@/features/organizations';
import { useTeams } from '@/features/teams';

import { MISSION_STATUS_LABELS } from '../workflow';
import {
  ANY,
  ANY_STATUS,
  EMPTY_MISSION_FILTERS,
  countActiveFilters,
  type MissionListFilters,
} from '../mission-filters';

export interface MissionFiltersBarProps {
  organizationId: string | null;
  value: MissionListFilters;
  onChange: (filters: MissionListFilters) => void;
  /**
   * Faux pour un intervenant. Les critères avancés portent sur des listes que
   * la RLS ne lui sert pas — il verrait trois sélecteurs vides pour filtrer une
   * liste qui ne contient déjà que ses propres missions.
   */
  showAdvanced: boolean;
}

export function MissionFiltersBar({
  organizationId,
  value,
  onChange,
  showAdvanced,
}: MissionFiltersBarProps) {
  const [expanded, setExpanded] = useState(false);

  const set = <K extends keyof MissionListFilters>(key: K, next: MissionListFilters[K]) => {
    onChange({ ...value, [key]: next });
  };

  const activeCount = countActiveFilters(value);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          label="Rechercher"
          hideLabel
          placeholder="Intitulé, référence ou client…"
          value={value.search}
          onChange={(event) => {
            set('search', event.target.value);
          }}
        />

        <div className="flex gap-2">
          <Select
            className="w-full sm:w-56"
            options={[
              { value: ANY_STATUS, label: 'En cours (par défaut)' },
              ...Object.entries(MISSION_STATUS_LABELS).map(([status, label]) => ({
                value: status,
                label,
              })),
            ]}
            value={value.status}
            onValueChange={(next) => {
              set('status', next);
            }}
            label="Statut"
            hideLabel
          />

          {showAdvanced ? (
            <Button
              variant={expanded ? 'secondary' : 'outline'}
              size="sm"
              className="shrink-0"
              aria-expanded={expanded}
              onClick={() => {
                setExpanded((open) => !open);
              }}
            >
              <SlidersHorizontal className="size-4" />
              <span className="hidden sm:inline">Filtres</span>
              {/*
                Le compte reste visible même repliés : sans lui, une liste courte
                se lit comme une absence de travail alors qu'un filtre oublié la
                réduit.
              */}
              {activeCount > 0 ? <Badge variant="primary">{activeCount}</Badge> : null}
            </Button>
          ) : null}
        </div>
      </div>

      {showAdvanced && expanded ? (
        <div className="border-border bg-surface-sunken space-y-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CustomerFilter
              organizationId={organizationId}
              value={value.customerId}
              onChange={(next) => {
                set('customerId', next);
              }}
            />

            <TeamFilter
              organizationId={organizationId}
              value={value.teamId}
              onChange={(next) => {
                set('teamId', next);
              }}
            />

            <MemberFilter
              organizationId={organizationId}
              value={value.memberId}
              onChange={(next) => {
                set('memberId', next);
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Planifiée à partir du"
              type="date"
              value={value.from}
              onChange={(event) => {
                set('from', event.target.value);
              }}
            />

            <Input
              label="Jusqu’au"
              type="date"
              value={value.to}
              onChange={(event) => {
                set('to', event.target.value);
              }}
            />
          </div>

          {activeCount > 0 ? (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(EMPTY_MISSION_FILTERS);
                }}
              >
                <X className="size-4" />
                Tout réinitialiser
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CustomerFilter({
  organizationId,
  value,
  onChange,
}: {
  organizationId: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const customers = useCustomers(organizationId);

  return (
    <Select
      label="Client"
      options={[
        { value: ANY, label: 'Tous les clients' },
        ...(customers.data ?? []).map((customer) => ({
          value: customer.id,
          label: customer.name,
        })),
      ]}
      value={value}
      onValueChange={onChange}
      disabled={customers.isPending}
    />
  );
}

function TeamFilter({
  organizationId,
  value,
  onChange,
}: {
  organizationId: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const teams = useTeams(organizationId);

  return (
    <Select
      label="Équipe"
      options={[
        { value: ANY, label: 'Toutes les équipes' },
        ...(teams.data ?? []).map((team) => ({ value: team.id, label: team.name })),
      ]}
      value={value}
      onValueChange={onChange}
      disabled={teams.isPending}
    />
  );
}

function MemberFilter({
  organizationId,
  value,
  onChange,
}: {
  organizationId: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const members = useMembers(organizationId);

  return (
    <Select
      label="Intervenant"
      // `assigned_user_id` référence `organization_members.id`, pas
      // `auth.users.id` : c'est l'appartenance à l'entreprise qui est affectée,
      // et elle survit au départ du compte.
      options={[
        { value: ANY, label: 'Tous les intervenants' },
        ...(members.data ?? []).map((member) => ({
          value: member.id,
          label: memberDisplayName(member),
        })),
      ]}
      value={value}
      onValueChange={onChange}
      disabled={members.isPending}
    />
  );
}
