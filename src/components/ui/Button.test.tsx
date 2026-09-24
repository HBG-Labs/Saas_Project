import { render, screen } from '@testing-library/react';
import { Send } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('remplace l’icône d’action et annonce précisément une opération en cours', () => {
    const { container } = render(
      <Button
        isLoading
        loadingLabel="Envoi du message au client"
        leadingIcon={<Send data-testid="action-icon" />}
      >
        Envoyer
      </Button>,
    );

    const button = screen.getByRole('button', { name: /Envoi du message au client/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('action-icon')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
