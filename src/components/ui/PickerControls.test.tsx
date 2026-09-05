import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Input } from './Input';
import { SelectField } from './SelectField';

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    setPointerCapture: { configurable: true, value: () => undefined },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
  });
});

describe('champs de sélection REZO360', () => {
  it('remplace une liste native tout en conservant la valeur transmise', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <div>
        <label htmlFor="test-unit">Unité</label>
        <SelectField id="test-unit" value="m" onChange={onChange}>
          <option value="">Aucune</option>
          <option value="m">Mètre</option>
          <option value="cm">Centimètre</option>
        </SelectField>
      </div>,
    );

    await user.click(screen.getByRole('combobox', { name: 'Unité' }));
    await user.click(screen.getByRole('option', { name: 'Centimètre' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: 'cm' }) }),
    );
  });

  it('ouvre un calendrier interne et restitue une date ISO', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Input label="Date" type="date" value="2026-09-05" onChange={onChange} />);

    expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Date' }));
    await user.click(screen.getByRole('button', { name: '15/09/2026' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2026-09-15' }) }),
    );
  });

  it('affiche la date initiale fournie par un formulaire', () => {
    function RegisteredDate() {
      const { register } = useForm({ defaultValues: { date: '2026-09-03' } });
      return <Input label="Échéance" type="date" {...register('date')} />;
    }

    render(<RegisteredDate />);

    expect(screen.getByRole('button', { name: 'Échéance' })).toHaveTextContent('03/09/2026');
  });
});
