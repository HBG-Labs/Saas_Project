import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './ErrorState';
import { LoadingScreen } from './LoadingScreen';

describe('états de feedback', () => {
  it('annonce un chargement sans exposer l’animation aux lecteurs d’écran', () => {
    const { container } = render(<LoadingScreen label="Préparation du tableau de bord…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Préparation du tableau de bord…');
    expect(container.querySelector('[data-status-visual="loading"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('conserve une erreur sûre et une action de reprise explicite', () => {
    const retry = vi.fn();
    const { container } = render(
      <ErrorState error={new Error('table_interne: secret')} onRetry={retry} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent("Une erreur inattendue s'est produite.");
    expect(screen.queryByText(/table_interne/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-status-visual="error"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('signale et verrouille une nouvelle tentative tant qu’elle est en cours', async () => {
    let termine: (() => void) | undefined;
    const retry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          termine = resolve;
        }),
    );

    render(<ErrorState error={new Error('indisponible')} onRetry={retry} />);

    const button = screen.getByRole('button', { name: /Réessayer/ });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAccessibleName(/Nouvelle tentative en cours/);

    await act(async () => {
      termine?.();
      await Promise.resolve();
    });

    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });
});
