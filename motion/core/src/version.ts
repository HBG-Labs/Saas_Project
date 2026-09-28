/**
 * Identité du moteur, écrite dans chaque manifeste. Doit rester égale à la
 * version de package.json (vérifié par test) : le manifeste n'invente rien.
 *
 * 0.2.0 : cœur temporel (P1.3) — registre de comportements, moteur temporel,
 * manifeste 0.3.0, Render Plan 0.3.0.
 * 0.3.0 : cœur visuel (P1.4) — mesure HarfBuzz, typographie de locale,
 * ajustement, images, masques, régions sémantiques ; Render Plan 0.4.0.
 */
export const ENGINE_NAME = '@motion-engine/core';
export const ENGINE_VERSION = '0.3.0';
