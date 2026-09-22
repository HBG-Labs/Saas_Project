import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';

describe('contours des champs', () => {
  it('utilise le filet discret sur toutes les primitives de saisie', () => {
    render(
      <div>
        <Input label="Intitulé" />
        <Textarea label="Description" />
        <Select label="Priorité" options={[{ value: 'normal', label: 'Normale' }]} />
        <Input label="Date" type="date" />
      </div>,
    );

    const fields = [
      screen.getByRole('textbox', { name: 'Intitulé' }),
      screen.getByRole('textbox', { name: 'Description' }),
      screen.getByRole('combobox', { name: 'Priorité' }),
      screen.getByRole('button', { name: 'Date' }),
    ];

    for (const field of fields) {
      expect(field).toHaveClass('border-border');
      expect(field).not.toHaveClass('border-border-strong');
    }
  });

  it('conserve le contour rouge en cas d’erreur', () => {
    render(<Input label="Intitulé" error="Champ obligatoire" />);

    expect(screen.getByRole('textbox', { name: 'Intitulé' })).toHaveClass('border-error');
  });
});
