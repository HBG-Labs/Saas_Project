import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToolErrorBoundary } from './ToolErrorBoundary';

/**
 * Vérifie l'exigence d'isolation : le crash d'un outil ne doit emporter ni la
 * navigation, ni le reste de l'application, et doit rester récupérable.
 */

function Exploding({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('division par zéro dans le calcul');
  return <p>Résultat : 42</p>;
}

/** Reproduit la structure réelle : chrome applicatif + zone outil isolée. */
function AppLike() {
  const [shouldThrow, setShouldThrow] = useState(true);

  return (
    <div>
      <header>
        <nav aria-label="Navigation principale">
          <a href="/tools">Outils</a>
        </nav>
      </header>

      <ToolErrorBoundary toolSlug="ohms-law" toolTitle="Loi d'Ohm">
        <Exploding shouldThrow={shouldThrow} />
      </ToolErrorBoundary>

      <button type="button" onClick={() => setShouldThrow(false)}>
        Corriger la cause
      </button>
    </div>
  );
}

beforeEach(() => {
  // React journalise toute erreur capturée : bruit attendu, on le neutralise.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ToolErrorBoundary', () => {
  it("confine l'erreur à la zone de l'outil, sans toucher à la navigation", () => {
    render(<AppLike />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Loi d'Ohm.*erreur/s);

    // Le reste de l'application reste opérationnel : c'est tout l'objet de
    // placer la frontière au niveau de l'outil et non de la page.
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Outils' })).toBeInTheDocument();
  });

  it("n'expose pas le message technique de l'erreur", () => {
    render(<AppLike />);
    expect(screen.getByRole('alert')).not.toHaveTextContent('division par zéro');
  });

  it('remonte l’outil après correction de la cause', async () => {
    const user = userEvent.setup();
    render(<AppLike />);

    await user.click(screen.getByRole('button', { name: 'Corriger la cause' }));
    await user.click(screen.getByRole('button', { name: /relancer l'outil/i }));

    expect(screen.getByText('Résultat : 42')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('se réinitialise automatiquement au changement d’outil', () => {
    const { rerender } = render(
      <ToolErrorBoundary toolSlug="ohms-law">
        <Exploding shouldThrow />
      </ToolErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Naviguer vers un autre outil ne doit pas conserver l'erreur du précédent.
    rerender(
      <ToolErrorBoundary toolSlug="cidr">
        <Exploding shouldThrow={false} />
      </ToolErrorBoundary>,
    );

    expect(screen.getByText('Résultat : 42')).toBeInTheDocument();
  });
});
