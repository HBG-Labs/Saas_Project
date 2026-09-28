import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BEHAVIORS, checkVersionLock, collectVersionedDocuments, loadVersionLock } from '@motion-engine/core';

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

describe('renderer stupide : il exécute le plan, il ne décide rien', () => {
  const rendererSources = [...sources(path.join(RENDERER, 'src')), ...sources(path.join(RENDERER, 'test'))];

  it('aucune source du renderer ne connaît un identifiant de comportement', () => {
    const ids = BEHAVIORS.ids();
    expect(ids.length).toBeGreaterThan(0);
    const hits = rendererSources.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return ids.filter((id) => new RegExp(`\\b${id}\\b`).test(text)).map((id) => `${path.relative(RENDERER, file)} : ${id}`);
    });
    expect(hits).toEqual([]);
  });

  it('ni courbe, ni ressort, ni interpolation Remotion : temps et trajectoires viennent du plan', () => {
    const hits = rendererSources.filter((file) => {
      const text = readFileSync(file, 'utf8');
      return (
        /\b(interpolate|interpolateColors|spring|measureSpring|Easing)\b/.test(text) ||
        /from\s+['"]@remotion\/(transitions|motion-blur|noise|paths|shapes)/.test(text)
      );
    });
    expect(hits.map((f) => path.relative(RENDERER, f))).toEqual([]);
  });

  it('la composition ne lit les pistes que par l’échantillonneur du cœur', () => {
    for (const file of sources(path.join(RENDERER, 'src', 'composition'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\.tracks\b|\.keys\b|\bease\b|\bbeats?\b|_ms\b|\.voice_only\b/);
    }
    const frameState = readFileSync(path.join(RENDERER, 'src', 'frame-state.ts'), 'utf8');
    expect(frameState).toMatch(/import \{ sampleProperty \} from '@motion-engine\/core\/runtime'/);
    expect(frameState).not.toMatch(/\.keys\b|\bease\b|Math\.(sin|cos|pow|exp)/);
  });
});

describe('verrou de versions de l’espace de travail', () => {
  it('exemples et packs : aucun contenu publié modifié sans nouvelle version', () => {
    const generic = path.join(WORKSPACE, 'packs', 'patterns', 'generic');
    const files = [
      ...['control_nocturne/style.json', 'rezo360/style.json', 'rezo360/brand.json'].map((f) => path.join(WORKSPACE, 'examples', f)),
      ...readdirSync(generic)
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(generic, f)),
    ];
    const issues = checkVersionLock(collectVersionedDocuments(...files), loadVersionLock(path.join(WORKSPACE, 'versions.lock.json')));
    expect(issues.map((i) => `${i.code} ${i.message}`)).toEqual([]);
  });
});
