import type { LeaveType } from '@/types/database';

import type { TimesheetMonthRow } from './api/timesheet.api';

/**
 * L'export du mois : un CSV fabriqué ici, à partir des lignes de
 * `timesheet_month`. Arbitrage E (20/09/2026) : aucun format propriétaire de
 * logiciel de paie — un tableau lisible, que l'expert-comptable importe ou
 * relit. Séparateur point-virgule et virgule décimale : ce qu'Excel en
 * français ouvre sans assistant.
 */

export interface TimesheetExportMember {
  memberId: string;
  displayName: string;
}

const LEAVE_LABELS: Record<LeaveType, string> = {
  paid_leave: 'Congé payé',
  rtt: 'RTT',
  sick_leave: 'Arrêt maladie',
  unpaid: 'Sans solde',
  family: 'Événement familial',
  recovery: 'Récupération',
};

/** `525` → `8,75`. Des heures décimales, ce que la paie additionne. */
export function minutesToDecimalHours(minutes: number): string {
  return (Math.round((minutes / 60) * 100) / 100).toFixed(2).replace('.', ',');
}

/** `525` → `8h45`. Ce qu'un humain lit. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h)}h${String(m).padStart(2, '0')}`;
}

function cellule(valeur: string): string {
  return /[;"\n]/.test(valeur) ? `"${valeur.replace(/"/g, '""')}"` : valeur;
}

/**
 * Une ligne par membre et par jour, puis une ligne de total par membre.
 * Les lignes arrivent triées par membre puis par jour — c'est l'ordre de la
 * fonction SQL, on ne le refait pas.
 */
export function buildTimesheetCsv(
  rows: readonly TimesheetMonthRow[],
  members: readonly TimesheetExportMember[],
): string {
  const noms = new Map(members.map((m) => [m.memberId, m.displayName]));
  const entete = [
    'Membre',
    'Jour',
    'Intervention (h)',
    'Hors intervention (h)',
    'Total (h)',
    'Congé',
    'Mois clos',
  ];
  const lignes: string[][] = [entete];

  let courant: string | null = null;
  let totaux = { intervention: 0, autre: 0, total: 0, conges: 0 };
  const cloreMembre = () => {
    if (courant === null) return;
    lignes.push([
      `${noms.get(courant) ?? courant} — total`,
      '',
      minutesToDecimalHours(totaux.intervention),
      minutesToDecimalHours(totaux.autre),
      minutesToDecimalHours(totaux.total),
      `${String(totaux.conges)} jour(s)`,
      '',
    ]);
  };

  for (const row of rows) {
    if (row.member_id !== courant) {
      cloreMembre();
      courant = row.member_id;
      totaux = { intervention: 0, autre: 0, total: 0, conges: 0 };
    }
    totaux.intervention += row.intervention_minutes;
    totaux.autre += row.other_minutes;
    totaux.total += row.total_minutes;
    if (row.on_leave) totaux.conges += 1;
    lignes.push([
      noms.get(row.member_id) ?? row.member_id,
      row.day,
      minutesToDecimalHours(row.intervention_minutes),
      minutesToDecimalHours(row.other_minutes),
      minutesToDecimalHours(row.total_minutes),
      row.on_leave ? (row.leave_type ? LEAVE_LABELS[row.leave_type] : 'Oui') : '',
      row.closed ? 'Oui' : 'Non',
    ]);
  }
  cloreMembre();

  // BOM : sans lui, Excel ouvre l'UTF-8 en Latin-1 et « Congé » devient « CongÃ© ».
  return '\u{FEFF}' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n') + '\r\n';
}
