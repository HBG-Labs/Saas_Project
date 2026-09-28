import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { AssetDefinition } from '../contracts/asset.ts';
import { clone, loadFixtureAssets, resolvedInk } from '../test-support.ts';
import { fitImage, ImageFitError, resolveTreatment } from './image-fit.ts';

const moon = loadFixtureAssets().registry.get('night_moon')!;
const EPS = 1e-6;

describe('cadrage d’image', () => {
  it('cover : recadrage au ratio exact de la boîte, dans l’image, centré au plus près du point focal', () => {
    const fit = fitImage({ asset: moon, box: { x: 0, y: 0, w: 400, h: 400 }, fit: 'cover', align_x: 'center', align_y: 'center' });
    expect(fit.crop.w / fit.crop.h).toBeCloseTo(1, 9);
    expect(fit.crop.w).toBe(720);
    // Centré sur le point focal (0,66 × 1280), sans sortir de l'image.
    expect(fit.crop.y + fit.crop.h / 2).toBeCloseTo(moon.focal_point.y * 1280, 6);
    expect(fit.box).toEqual({ x: 0, y: 0, w: 400, h: 400 });
  });

  it('cover sur une région : la région reste entière quand elle tient', () => {
    const fit = fitImage({ asset: moon, box: { x: 0, y: 0, w: 540, h: 200 }, fit: 'cover', focus: { region: 'moon' }, align_x: 'center', align_y: 'center' });
    const region = { x: 0.4236 * 720, y: 0.5391 * 1280, w: 0.4306 * 720, h: 0.2422 * 1280 };
    expect(fit.focus_region_cropped).toBe(true); // 310 px de haut dans un recadrage de 266 px : signalé
    const wide = fitImage({ asset: moon, box: { x: 0, y: 0, w: 300, h: 300 }, fit: 'cover', focus: { region: 'moon' }, align_x: 'center', align_y: 'center' });
    expect(wide.focus_region_cropped).toBe(false);
    expect(wide.crop.x).toBeLessThanOrEqual(region.x + EPS);
    expect(wide.crop.x + wide.crop.w).toBeGreaterThanOrEqual(region.x + region.w - EPS);
    expect(wide.crop.y).toBeLessThanOrEqual(region.y + EPS);
    expect(wide.crop.y + wide.crop.h).toBeGreaterThanOrEqual(region.y + region.h - EPS);
  });

  it('fill : recadrage serré, la région remplit le cadre', () => {
    const loose = fitImage({ asset: moon, box: { x: 0, y: 0, w: 300, h: 300 }, fit: 'cover', focus: { region: 'moon' }, align_x: 'center', align_y: 'center' });
    const tight = fitImage({ asset: moon, box: { x: 0, y: 0, w: 300, h: 300 }, fit: 'cover', focus: { region: 'moon', fill: true }, align_x: 'center', align_y: 'center' });
    expect(tight.crop.w).toBeLessThan(loose.crop.w);
    expect(tight.crop.w).toBeCloseTo(Math.max(0.4306 * 720, 0.2422 * 1280), 6);
    expect(tight.regions['moon']!.w).toBeGreaterThan(loose.regions['moon']!.w);
  });

  it('contain : image entière, ratio d’origine, alignée dans la boîte', () => {
    const fit = fitImage({ asset: moon, box: { x: 10, y: 20, w: 400, h: 400 }, fit: 'contain', align_x: 'end', align_y: 'center' });
    expect(fit.crop).toEqual({ x: 0, y: 0, w: 720, h: 1280 });
    expect(fit.box.w / fit.box.h).toBeCloseTo(720 / 1280, 9);
    expect(fit.box.h).toBeCloseTo(400, 9);
    expect(fit.box.x + fit.box.w).toBeCloseTo(410, 9);
  });

  it('projette les régions sémantiques sur le canevas, découpées à la zone dessinée', () => {
    const fit = fitImage({ asset: moon, box: { x: 0, y: 0, w: 540, h: 960 }, fit: 'cover', align_x: 'center', align_y: 'center' });
    const sky = fit.regions['sky']!;
    const expected = { x: 0.04 * 540, y: 0.05 * 960, w: 0.92 * 540, h: 0.38 * 960 };
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(sky[k]).toBeCloseTo(expected[k], 9);
    const crop = fitImage({ asset: moon, box: { x: 0, y: 0, w: 300, h: 100 }, fit: 'cover', focus: { region: 'moon' }, align_x: 'center', align_y: 'center' });
    // Le ciel est hors du recadrage serré autour de la lune : il disparaît au lieu d'être inventé.
    expect(crop.regions['sky']).toBeUndefined();
  });

  it('refuse une région inconnue', () => {
    expect(() => fitImage({ asset: moon, box: { x: 0, y: 0, w: 10, h: 10 }, fit: 'cover', focus: { region: 'sea' }, align_x: 'center', align_y: 'center' })).toThrowError(ImageFitError);
  });

  it('propriété : en cover, le recadrage est toujours dans l’image et au ratio de la boîte', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 16, max: 2000 }),
        fc.integer({ min: 16, max: 2000 }),
        fc.record({ x: fc.double({ min: 0, max: 1, noNaN: true }), y: fc.double({ min: 0, max: 1, noNaN: true }) }),
        fc.boolean(),
        (w, h, point, fill) => {
          const asset: AssetDefinition = clone(moon);
          const fit = fitImage({
            asset,
            box: { x: 0, y: 0, w, h },
            fit: 'cover',
            focus: fill ? { region: 'moon', fill: true } : { point },
            align_x: 'center',
            align_y: 'center',
          });
          expect(fit.crop.x).toBeGreaterThanOrEqual(-EPS);
          expect(fit.crop.y).toBeGreaterThanOrEqual(-EPS);
          expect(fit.crop.x + fit.crop.w).toBeLessThanOrEqual(720 + EPS);
          expect(fit.crop.y + fit.crop.h).toBeLessThanOrEqual(1280 + EPS);
          expect(fit.crop.w / fit.crop.h).toBeCloseTo(w / h, 6);
          for (const r of Object.values(fit.regions)) {
            expect(r.x).toBeGreaterThanOrEqual(-EPS);
            expect(r.x + r.w).toBeLessThanOrEqual(w + EPS);
          }
        },
      ),
      { seed: 20260928, numRuns: 300 },
    );
  });
});

describe('traitement d’image', () => {
  it('ne contient aucune valeur cachée : tout vient du style', () => {
    const ink = resolvedInk();
    const t = resolveTreatment(ink.style, (ref) => ink.style.palette[ref.slice(ref.indexOf('.') + 1)]!);
    expect(t.grayscale).toBe(0); // « cool » garde la couleur
    expect(t.contrast).toBeCloseTo(1 + ink.style.image_treatment.contrast, 9);
    expect(t.tint).toEqual({ color: ink.style.palette['surface.primary'], opacity: ink.style.image_treatment.tint!.opacity });
  });
});
