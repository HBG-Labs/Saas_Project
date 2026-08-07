import { computeExample } from './compute';

/**
 * Interface de l'outil — présentation uniquement.
 *
 * Ce composant est chargé paresseusement : son code ne fait pas partie du
 * bundle initial. Toute la logique métier reste dans `compute.ts`.
 */
export default function TemplateTool() {
  const { product } = computeExample({ value: 6, factor: 7 });

  return (
    <section aria-labelledby="template-tool-title" className="space-y-2">
      <h2 id="template-tool-title" className="text-lg font-semibold">
        Gabarit d&apos;outil
      </h2>
      <p className="text-content-muted text-sm">
        Copiez ce dossier pour créer un nouvel outil. Résultat de démonstration : {product}
      </p>
    </section>
  );
}
