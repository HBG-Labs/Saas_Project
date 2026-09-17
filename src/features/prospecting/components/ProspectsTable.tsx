import { ArrowDown, ArrowUp, ArrowUpDown, Radar } from 'lucide-react';
import { Link } from 'react-router';

import { Card } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { formatRelativeTime } from '@/lib/format';
import type { ProspectListRow } from '@/types/domain';

import type { ProspectSortColumn } from '../api/prospecting.api';

import { ProspectScoreBadge } from './ProspectScoreBadge';
import { ProspectStatusBadge } from './ProspectStatusBadge';

export interface ProspectSort {
  column: ProspectSortColumn;
  direction: 'asc' | 'desc';
}

const COLUMN_LABELS: Record<ProspectSortColumn, string> = {
  raison_sociale: 'Entreprise',
  sector: 'Secteur',
  zone: 'Zone',
  created_on: 'Ancienneté',
  opportunity_score: 'Score',
  status: 'Statut',
};

/**
 * Bascule croissant/décroissant sur la colonne déjà triée ; sinon repart
 * décroissant — c'est le sens le plus utile pour toutes ces colonnes (score,
 * date, alphabétique) au premier clic.
 */
function nextDirection(column: ProspectSortColumn, current: ProspectSort | undefined): 'asc' | 'desc' {
  if (current?.column !== column) return 'desc';
  return current.direction === 'desc' ? 'asc' : 'desc';
}

function SortableHeader({
  column,
  sort,
  onSortChange,
  className,
}: {
  column: ProspectSortColumn;
  sort: ProspectSort | undefined;
  onSortChange: (sort: ProspectSort) => void;
  className?: string;
}) {
  const isActive = sort?.column === column;
  const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSortChange({ column, direction: nextDirection(column, sort) })}
        className={`hover:text-foreground inline-flex items-center gap-1 transition-colors ${
          isActive ? 'text-foreground' : ''
        }`}
        aria-label={`Trier par ${COLUMN_LABELS[column]}${isActive ? (sort.direction === 'asc' ? ', croissant' : ', décroissant') : ''}`}
      >
        {COLUMN_LABELS[column]}
        <Icon className={`size-3 shrink-0 ${isActive ? '' : 'opacity-40'}`} aria-hidden="true" />
      </button>
    </th>
  );
}

/**
 * Cartes sur mobile, table sur desktop — même patron que `ConsumablesTable`
 * (`src/features/stock/components/ConsumablesTable.tsx`) : un seul composant,
 * les deux balisages, la bascule se fait en CSS (`md:hidden` / `md:table`),
 * jamais en JS. Lecture seule : qualifier/noter/relancer est la Phase 7.
 *
 * Le tri (§ demande explicite) se fait CÔTÉ BASE, pas seulement sur la page
 * affichée : `sort`/`onSortChange` remontent à `ProspectingListPage`, qui
 * relance `listProspects` avec la colonne demandée — trier seulement les 25
 * lignes déjà chargées aurait été trompeur sur une liste paginée.
 */
export function ProspectsTable({
  rows,
  sort,
  onSortChange,
}: {
  rows: ProspectListRow[];
  sort?: ProspectSort | undefined;
  onSortChange: (sort: ProspectSort) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card className="border-border/80 bg-surface p-12 text-center shadow-xs">
        <div className="bg-surface-sunken mx-auto flex size-11 items-center justify-center rounded-2xl">
          <Radar className="text-muted-foreground size-5" aria-hidden="true" />
        </div>
        <p className="text-foreground mt-3 text-sm font-semibold">Aucun prospect trouvé</p>
        <p className="text-subtle-foreground mx-auto mt-1 max-w-sm text-xs">
          Modifiez vos filtres, ou attendez le prochain passage du radar.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 bg-surface overflow-x-auto shadow-xs">
      {/* Cartes mobile */}
      <div className="divide-border divide-y md:hidden">
        {rows.map((prospect) => (
          <Link
            key={prospect.siren}
            to={ROUTES.prospect(prospect.siren)}
            className="hover:bg-surface-hover/50 block space-y-2.5 p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-foreground truncate text-sm font-bold">
                  {prospect.nom_commercial ?? prospect.raison_sociale}
                </h3>
                <p className="text-muted-foreground text-3xs mt-0.5">
                  {prospect.sector?.label ?? prospect.ape_code} · {prospect.commune ?? prospect.departement ?? '—'}
                </p>
              </div>
              <ProspectScoreBadge score={prospect.opportunity_score} />
            </div>
            <p className="text-subtle-foreground text-3xs">
              {prospect.created_on ? `Créée ${formatRelativeTime(prospect.created_on)}` : 'Date de création inconnue'}
            </p>
            <ProspectStatusBadge status={prospect.status} />
          </Link>
        ))}
      </div>

      {/* Table desktop */}
      <table className="hidden w-full min-w-[760px] border-collapse text-left text-xs md:table">
        <thead>
          <tr className="border-border bg-surface-raised/50 text-muted-foreground text-3xs border-b font-bold tracking-wider uppercase">
            <SortableHeader column="raison_sociale" className="px-3 py-2.5 sm:px-4" sort={sort} onSortChange={onSortChange} />
            <SortableHeader column="sector" className="px-3 py-2.5" sort={sort} onSortChange={onSortChange} />
            <SortableHeader column="zone" className="px-3 py-2.5" sort={sort} onSortChange={onSortChange} />
            <SortableHeader column="created_on" className="px-3 py-2.5" sort={sort} onSortChange={onSortChange} />
            <SortableHeader column="opportunity_score" className="px-3 py-2.5" sort={sort} onSortChange={onSortChange} />
            <SortableHeader column="status" className="px-3 py-2.5 sm:px-4" sort={sort} onSortChange={onSortChange} />
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((prospect) => (
            <tr key={prospect.siren} className="hover:bg-surface-hover/50 group transition-colors">
              <td className="px-3 py-3 sm:px-4">
                <Link to={ROUTES.prospect(prospect.siren)} className="hover:underline">
                  <p className="text-foreground text-xs leading-snug font-semibold">
                    {prospect.nom_commercial ?? prospect.raison_sociale}
                  </p>
                  <p className="text-3xs text-subtle-foreground mt-0.5 font-mono">{prospect.siren}</p>
                </Link>
              </td>
              <td className="px-3 py-3">{prospect.sector?.label ?? prospect.ape_code}</td>
              <td className="px-3 py-3">{prospect.zone?.label ?? prospect.departement ?? '—'}</td>
              <td className="text-3xs text-subtle-foreground px-3 py-3">
                {prospect.created_on ? formatRelativeTime(prospect.created_on) : '—'}
              </td>
              <td className="px-3 py-3">
                <ProspectScoreBadge score={prospect.opportunity_score} />
              </td>
              <td className="px-3 py-3 sm:px-4">
                <ProspectStatusBadge status={prospect.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
