import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageShell } from './PageShell';

describe('PageShell', () => {
  it('impose un rythme vertical unique', () => {
    // Vingt-neuf pages portaient leur propre combinaison d'espacement et de
    // marge basse — `space-y-4` contre `space-y-6`, `pb-6` contre `pb-16` —
    // sans qu'aucune de ces variations ne corresponde à une décision.
    render(<PageShell data-testid="coque">Contenu</PageShell>);

    const coque = screen.getByTestId('coque');
    expect(coque).toHaveClass('space-y-6', 'pb-12', 'mx-auto');
  });

  it('laisse la largeur réglable, car elle, elle se décide', () => {
    // Une fiche ne se lit pas comme un tableau de bord : au-delà d'une
    // certaine largeur, l'œil perd le début de la ligne suivante.
    render(
      <PageShell width="3xl" data-testid="coque">
        Formulaire
      </PageShell>,
    );

    expect(screen.getByTestId('coque')).toHaveClass('max-w-3xl');
    expect(screen.getByTestId('coque')).not.toHaveClass('max-w-6xl');
  });

  it('retient la largeur des listes par défaut', () => {
    render(<PageShell data-testid="coque">Liste</PageShell>);

    expect(screen.getByTestId('coque')).toHaveClass('max-w-6xl');
  });
});
