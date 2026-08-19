/**
 * Utilitaire d'export CSV pour REZO360.
 *
 * Règles :
 * - Séparateur point-virgule (`;`) adapté aux logiciels tableurs francophones (Excel, LibreOffice).
 * - En-tête BOM UTF-8 (`\uFEFF`) pour préserver les accents et caractères spéciaux à l'ouverture directe dans Excel.
 * - Échappement conforme RFC 4180 : entouré de guillemets si la valeur contient un point-virgule, un retour à la ligne ou des guillemets.
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

/**
 * Échappe une valeur pour le format CSV.
 */
export function escapeCsvValue(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Génère le contenu textuel d'un CSV à partir de colonnes et de données.
 */
export function generateCsvContent<T>(columns: CsvColumn<T>[], data: T[]): string {
  const headerRow = columns.map((col) => escapeCsvValue(col.header)).join(';');
  const rows = data.map((item) =>
    columns.map((col) => escapeCsvValue(col.accessor(item))).join(';')
  );

  return '\uFEFF' + [headerRow, ...rows].join('\r\n');
}

/**
 * Déclenche le téléchargement du fichier CSV dans le navigateur.
 */
export function exportToCsv<T>(filename: string, columns: CsvColumn<T>[], data: T[]): void {
  const csvContent = generateCsvContent(columns, data);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
