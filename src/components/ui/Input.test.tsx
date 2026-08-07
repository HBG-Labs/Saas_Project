import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

/**
 * Ces tests vérifient l'ACCESSIBILITÉ du champ, pas son apparence : ce sont les
 * associations libellé/aide/erreur qui se cassent silencieusement lors des
 * refontes visuelles.
 */
describe('Input', () => {
  it('associe le libellé au champ', () => {
    render(<Input label="Adresse e-mail" />);

    // getByLabelText échoue si l'association htmlFor/id est rompue.
    expect(screen.getByLabelText('Adresse e-mail')).toBeInstanceOf(HTMLInputElement);
  });

  it('conserve le libellé pour les lecteurs d’écran quand il est masqué', () => {
    render(<Input label="Rechercher" hideLabel placeholder="Rechercher…" />);
    expect(screen.getByLabelText('Rechercher')).toBeInTheDocument();
  });

  it('relie le texte d’aide au champ via aria-describedby', () => {
    render(<Input label="Mot de passe" hint="8 caractères minimum." />);

    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription(
      '8 caractères minimum.',
    );
  });

  it('marque le champ invalide et annonce l’erreur', () => {
    render(<Input label="E-mail" error="Adresse invalide." />);

    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Adresse invalide.');
    expect(screen.getByRole('alert')).toHaveTextContent('Adresse invalide.');
  });

  it('masque l’aide lorsqu’une erreur est présente', () => {
    render(
      <Input label="E-mail" hint="Votre adresse professionnelle." error="Adresse invalide." />,
    );

    // Afficher les deux disperserait l'attention au moment où l'utilisateur
    // doit corriger quelque chose.
    expect(screen.queryByText('Votre adresse professionnelle.')).not.toBeInTheDocument();
  });
});
