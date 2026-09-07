import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SelectField } from './SelectField';

/**
 * Le champ étiqueté doit rester UN bloc.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QUE CES CAS INTERDISENT
 *
 * `SelectField` posait `display: contents` sur son conteneur en toutes
 * circonstances. Le conteneur disparaissant de la mise en page, l'étiquette et
 * le déclencheur devenaient deux enfants DIRECTS du parent : dans une
 * `grid-cols-2`, ils tombaient dans deux cellules différentes — l'étiquette
 * « Dossier » en haut à droite, son menu à la ligne suivante sous le champ
 * voisin.
 *
 * Personne ne l'avait vu parce que les écrans plus anciens enveloppent chaque
 * champ dans leur propre `<div>`, qui absorbe la dissolution. Le défaut
 * n'apparaît que quand `SelectField` est posé directement dans une grille —
 * l'usage naturel.
 *
 * `contents` reste nécessaire SANS étiquette visible : les barres de filtres
 * héritées posent `flex-1` sur ce qui était un `<select>` nu et comptent sur
 * le déclencheur comme élément flex du parent.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('SelectField', () => {
  it('groupe étiquette et menu dans un seul bloc quand l’étiquette est visible', () => {
    const { container } = render(
      <SelectField label="Dossier" value="a">
        <option value="a">Fibre</option>
      </SelectField>,
    );

    const bloc = container.firstElementChild;
    expect(bloc).not.toBeNull();
    expect(bloc?.className).not.toContain('contents');

    // L'étiquette et le déclencheur vivent DANS ce bloc, pas à côté de lui :
    // c'est ce qui en fait une seule cellule de grille.
    expect(bloc?.contains(screen.getByText('Dossier'))).toBe(true);
    expect(bloc?.contains(screen.getByRole('combobox'))).toBe(true);
  });

  it('se dissout quand l’étiquette est masquée, pour les barres de filtres', () => {
    const { container } = render(
      <SelectField label="Dossier" hideLabel value="a">
        <option value="a">Fibre</option>
      </SelectField>,
    );

    expect(container.firstElementChild?.className).toContain('contents');
  });

  it('se dissout aussi en l’absence totale d’étiquette', () => {
    const { container } = render(
      <SelectField value="a">
        <option value="a">Fibre</option>
      </SelectField>,
    );

    expect(container.firstElementChild?.className).toContain('contents');
  });
});
