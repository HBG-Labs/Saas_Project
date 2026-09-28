import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { COMPILER_VERSION } from './compiler/compile.ts';
import { MANIFEST_VERSION } from './contracts/manifest.ts';
import { MOTION_SPEC_VERSION } from './contracts/motion-spec.ts';
import { RENDER_PLAN_VERSION } from './contracts/render-plan.ts';
import { BEHAVIOR_REGISTRY_VERSION } from './motion/registry.ts';
import { CORE_ROOT } from './test-support.ts';
import { ENGINE_NAME, ENGINE_VERSION } from './version.ts';

describe('cohérence des versions', () => {
  it('la version du moteur écrite dans les manifestes est celle du paquet', () => {
    const pkg = JSON.parse(readFileSync(path.join(CORE_ROOT, 'package.json'), 'utf8')) as { name: string; version: string };
    expect(ENGINE_NAME).toBe(pkg.name);
    expect(ENGINE_VERSION).toBe(pkg.version);
  });

  it('versions publiées du moteur 0.2.0 (clôture P1.3)', () => {
    // Toute évolution d'un de ces contrats impose d'incrémenter sa version ici,
    // et de documenter la migration s'il s'agit d'un document persistant.
    expect({
      engine: ENGINE_VERSION,
      compiler: COMPILER_VERSION,
      spec: MOTION_SPEC_VERSION,
      render_plan: RENDER_PLAN_VERSION,
      manifest: MANIFEST_VERSION,
      behavior_registry: BEHAVIOR_REGISTRY_VERSION,
    }).toEqual({ engine: '0.2.0', compiler: '0.3.0', spec: '0.2.0', render_plan: '0.3.0', manifest: '0.3.0', behavior_registry: '1.0.0' });
  });
});
