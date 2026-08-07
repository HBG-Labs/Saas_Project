import { lazy } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getTool,
  hasTool,
  listTools,
  listToolsByCategory,
  registerTool,
  resetRegistry,
} from './registry';
import { reconcileRegistryWithCatalog } from './reconcile';
import { defineTool, type ToolDefinition } from './types';

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return defineTool({
    slug: 'ohms-law',
    category: 'electrical',
    title: "Loi d'Ohm",
    description: 'Calcule tension, courant et résistance.',
    keywords: ['ohm'],
    icon: 'zap',
    Component: lazy(() => Promise.resolve({ default: () => null })),
    ...overrides,
  });
}

beforeEach(() => {
  resetRegistry();
});

describe('registry', () => {
  it('enregistre puis retrouve un outil par son slug', () => {
    registerTool(makeTool());

    expect(hasTool('ohms-law')).toBe(true);
    expect(getTool('ohms-law')?.title).toBe("Loi d'Ohm");
    expect(getTool('inconnu')).toBeUndefined();
  });

  it('refuse deux outils partageant le même slug', () => {
    registerTool(makeTool());
    expect(() => registerTool(makeTool())).toThrow(/slug « ohms-law »/);
  });

  it('refuse un slug qui ne respecte pas le kebab-case', () => {
    expect(() => registerTool(makeTool({ slug: 'Ohms_Law' }))).toThrow(/Slug d'outil invalide/);
  });

  it('filtre par catégorie', () => {
    registerTool(makeTool());
    registerTool(makeTool({ slug: 'cidr', category: 'networking', title: 'CIDR' }));

    expect(listToolsByCategory('electrical').map((t) => t.slug)).toEqual(['ohms-law']);
    expect(listTools()).toHaveLength(2);
  });
});

describe('reconcileRegistryWithCatalog', () => {
  it('signale les divergences entre le code et la base', () => {
    registerTool(makeTool());

    const report = reconcileRegistryWithCatalog(['ohms-law', 'budget-optique']);

    // Publié en base, mais aucun dossier src/tools/budget-optique/.
    expect(report.missingImplementation).toEqual(['budget-optique']);
    expect(report.missingCatalogEntry).toEqual([]);
  });

  it('signale un outil implémenté mais absent du catalogue', () => {
    registerTool(makeTool());

    expect(reconcileRegistryWithCatalog([]).missingCatalogEntry).toEqual(['ohms-law']);
  });
});
