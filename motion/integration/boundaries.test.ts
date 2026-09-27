import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CORE, WORKSPACE } from './support.ts';

const RENDERER = path.join(WORKSPACE, 'renderer-remotion');
const readPkg = (dir: string) =>
  JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
    name: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('frontière cœur / renderer', () => {
  it('le renderer dépend du cœur', () => {
    expect(readPkg(RENDERER).dependencies?.['@motion-engine/core']).toBeDefined();
  });

  it('le cœur ne dépend ni du renderer ni de Remotion, ni en production ni en développement', () => {
    const pkg = readPkg(CORE);
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).filter((d) => d.includes('remotion') || d === 'react' || d === 'react-dom')).toEqual([]);
  });

  it('aucune source du cœur n’importe Remotion, React ou le renderer', () => {
    const hits = sources(path.join(CORE, 'src')).filter((file) =>
      /from\s+['"](remotion|@remotion\/|react|@motion-engine\/renderer)/.test(readFileSync(file, 'utf8')),
    );
    expect(hits).toEqual([]);
  });

  it('le point d’entrée « runtime » du cœur est utilisable dans un navigateur (ni Node, ni zod)', () => {
    const runtime = sources(path.join(CORE, 'src', 'runtime')).filter((f) => !f.endsWith('.test.ts'));
    for (const file of runtime) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/from\s+['"]node:/);
      expect(text, file).not.toMatch(/^import\s+(?!type)[^;]*from\s+['"]zod['"]/m);
    }
  });

  it('la copie de test du pattern générique est identique au pack', () => {
    const pack = readFileSync(path.join(WORKSPACE, 'packs', 'patterns', 'generic', 'statement.interrupt.json'), 'utf8');
    const fixture = readFileSync(path.join(CORE, 'test-fixtures', 'patterns', 'statement.interrupt.json'), 'utf8');
    expect(fixture).toBe(pack);
  });
});
