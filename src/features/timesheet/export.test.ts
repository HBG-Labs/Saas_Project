import { describe, expect, it } from 'vitest';

import { buildTimesheetCsv, formatMinutes, minutesToDecimalHours } from './export';

const ligne = (
  member_id: string,
  day: string,
  minutes: [number, number],
  extra: Partial<{ on_leave: boolean; leave_type: 'paid_leave'; closed: boolean }> = {},
) => ({
  member_id,
  day,
  intervention_minutes: minutes[0],
  other_minutes: minutes[1],
  total_minutes: minutes[0] + minutes[1],
  on_leave: extra.on_leave ?? false,
  leave_type: extra.leave_type ?? null,
  closed: extra.closed ?? false,
});

describe("export de la feuille d'heures", () => {
  it('convertit des minutes en heures décimales à la virgule, et en lecture humaine', () => {
    expect(minutesToDecimalHours(525)).toBe('8,75');
    expect(minutesToDecimalHours(0)).toBe('0,00');
    expect(minutesToDecimalHours(50)).toBe('0,83');
    expect(formatMinutes(525)).toBe('8h45');
    expect(formatMinutes(5)).toBe('0h05');
  });

  it('produit une ligne par jour et un total par membre, dans l’ordre reçu', () => {
    const csv = buildTimesheetCsv(
      [
        ligne('a', '2026-08-03', [480, 45]),
        ligne('a', '2026-08-10', [0, 0], { on_leave: true, leave_type: 'paid_leave' }),
        ligne('b', '2026-08-20', [0, 60], { closed: true }),
      ],
      [
        { memberId: 'a', displayName: 'Alice Martin' },
        { memberId: 'b', displayName: 'Bob; "Le Grand"' },
      ],
    );
    const lignes = csv
      .replace(/^\u{FEFF}/u, '')
      .trimEnd()
      .split('\r\n');
    expect(lignes[0]).toBe(
      'Membre;Jour;Intervention (h);Hors intervention (h);Total (h);Congé;Mois clos',
    );
    expect(lignes[1]).toBe('Alice Martin;2026-08-03;8,00;0,75;8,75;;Non');
    expect(lignes[2]).toBe('Alice Martin;2026-08-10;0,00;0,00;0,00;Congé payé;Non');
    expect(lignes[3]).toBe('Alice Martin — total;;8,00;0,75;8,75;1 jour(s);');
    // Le point-virgule et les guillemets du nom sont protégés.
    expect(lignes[4]).toBe('"Bob; ""Le Grand""";2026-08-20;0,00;1,00;1,00;;Oui');
    expect(lignes[5]).toBe('"Bob; ""Le Grand"" — total";;0,00;1,00;1,00;0 jour(s);');
    expect(lignes).toHaveLength(6);
  });

  it('commence par le BOM UTF-8, pour Excel', () => {
    expect(buildTimesheetCsv([], []).charCodeAt(0)).toBe(0xfeff);
  });
});
