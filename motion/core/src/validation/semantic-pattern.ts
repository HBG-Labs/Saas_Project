import type { PatternDefinition } from '../contracts/pattern.ts';
import { IssueCollector } from './issues.ts';
import type { ValidationIssue } from './issues.ts';

export function validatePatternSemantics(pattern: PatternDefinition): ValidationIssue[] {
  const c = new IssueCollector();
  const axes = pattern.variation_axes;

  for (const [name, a] of Object.entries(axes) as [string, { values: readonly string[]; default: string }][]) {
    if (!a.values.includes(a.default)) c.error('pattern.axis_default', `variation_axes.${name}`, `défaut « ${a.default} » hors des valeurs`);
    if (new Set(a.values).size !== a.values.length) c.error('pattern.axis_duplicate', `variation_axes.${name}`, 'valeurs en double');
  }
  const cover = (axis: string, values: readonly string[], table: Record<string, unknown>, section: string) => {
    for (const value of values) {
      if (!table[value]) c.error('pattern.axis_uncovered', section, `la valeur « ${value} » de ${axis} n'a pas de définition`);
    }
  };
  cover('layout_variant', axes.layout_variant.values, pattern.layouts, 'layouts');
  cover('motion_variant', axes.motion_variant.values, pattern.motions, 'motions');
  cover('hierarchy_variant', axes.hierarchy_variant.values, pattern.hierarchies, 'hierarchies');

  const usedSlots = [pattern.elements.statement.slot, ...(pattern.elements.rule ? [pattern.elements.rule.slot] : [])];
  for (const [layoutId, layout] of Object.entries(pattern.layouts)) {
    const path = `layouts.${layoutId}`;
    for (const slot of usedSlots) {
      if (!layout.slots[slot]) c.error('pattern.slot_missing', path, `slot « ${slot} » absent de la mise en page`);
    }
    for (const [name, geometry] of Object.entries(layout.slots)) {
      if (geometry.kind === 'region') {
        if (geometry.x[0] >= geometry.x[1] || geometry.y[0] >= geometry.y[1]) {
          c.error('pattern.slot_empty', `${path}.slots.${name}`, 'région vide ou inversée');
        }
        continue;
      }
      // Chaîne « follow » : elle doit aboutir à une région, sans boucle.
      const seen = new Set<string>([name]);
      let cursor: string | undefined = geometry.of;
      while (cursor !== undefined) {
        if (seen.has(cursor)) {
          c.error('pattern.slot_cycle', `${path}.slots.${name}`, `cycle de placement : ${[...seen, cursor].join(' → ')}`);
          break;
        }
        seen.add(cursor);
        const next: (typeof layout.slots)[string] | undefined = layout.slots[cursor];
        if (!next) {
          c.error('pattern.slot_unknown', `${path}.slots.${name}.of`, `slot « ${cursor} » inexistant`);
          break;
        }
        cursor = next.kind === 'follow' ? next.of : undefined;
      }
    }
  }
  return c.issues;
}
