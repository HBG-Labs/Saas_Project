import type { MissionWithRelations } from '@/types/domain';
import { MISSION_STATUS_LABELS } from '../workflow';

/**
 * Exporte une liste de missions au format CSV compatible Excel (UTF-8 avec BOM et séparateur point-virgule).
 */
export function exportMissionsToCsv(
  missions: readonly MissionWithRelations[],
  filename = 'missions-export.csv',
) {
  const headers = [
    'Référence',
    'Titre',
    'Client',
    'Téléphone',
    'Ville',
    'Adresse',
    'Statut',
    'Priorité',
    'Date début planifiée',
    'Date fin',
  ];

  const rows = missions.map((m) => {
    const ref = m.reference ?? '';
    const title = m.title.replace(/"/g, '""');
    const customer = (m.customer?.name ?? m.customer_name ?? '').replace(/"/g, '""');
    const phone = m.customer_phone ?? '';
    const city = (m.city ?? m.site?.city ?? '').replace(/"/g, '""');
    const address = (m.address_line1 ?? m.location_label ?? '').replace(/"/g, '""');
    const status = MISSION_STATUS_LABELS[m.status] ?? m.status;
    const priority = m.priority;
    const start = m.scheduled_start
      ? new Date(m.scheduled_start).toLocaleString('fr-FR')
      : '';
    const end = m.actual_end
      ? new Date(m.actual_end).toLocaleString('fr-FR')
      : m.scheduled_end
        ? new Date(m.scheduled_end).toLocaleString('fr-FR')
        : '';

    return [
      `"${ref}"`,
      `"${title}"`,
      `"${customer}"`,
      `"${phone}"`,
      `"${city}"`,
      `"${address}"`,
      `"${status}"`,
      `"${priority}"`,
      `"${start}"`,
      `"${end}"`,
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
