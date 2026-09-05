import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import type { InvoiceWithItems } from '@/types/domain';
import { InvoiceDraftEditor } from './InvoiceDraftEditor';

const state = vi.hoisted(() => ({ save: vi.fn(), error: null as Error | null }));
vi.mock('../hooks/useInvoices', () => ({
  useSaveInvoiceDraft: () => ({ mutateAsync: state.save, error: state.error }),
}));
vi.mock('@/features/customers', () => ({
  useCustomer: () => ({
    data: {
      name: 'Fiche actuelle',
      legal_name: null,
      customer_type: 'individual',
      address_line1: '12 rue Neuve',
      address_line2: 'Bâtiment B',
      city: 'Le Marin',
      postal_code: '97290',
      country: 'FR',
    },
    isFetching: false,
    isError: false,
  }),
}));
const invoice = {
  id: 'invoice-1',
  customer_id: 'customer-1',
  status: 'draft',
  updated_at: '2026-09-03T08:00:00Z',
  customer_name: 'Nom sur le brouillon',
  customer_type: 'individual',
  customer_country: 'FR',
  payment_terms: 'À réception',
  due_date: '2026-10-03',
  items: [
    {
      id: 'line-1',
      description: 'Installation',
      unit: 'h',
      quantity: 2,
      unit_price_cents: 12345,
      vat_rate: 8.5,
      vat_category: 'S',
      vat_exemption_reason: null,
    },
  ],
} as InvoiceWithItems;
const close = vi.fn();
const renderEditor = () =>
  render(<InvoiceDraftEditor invoice={invoice} open onOpenChange={close} />);

beforeEach(() => {
  vi.clearAllMocks();
  state.error = null;
  state.save.mockResolvedValue(invoice);
});

describe('correction d’un brouillon', () => {
  it('signale immédiatement les identifiants invalides tout en conservant un brouillon', async () => {
    render(
      <InvoiceDraftEditor
        invoice={{
          ...invoice,
          customer_type: 'company',
          customer_registration_number: '109198440054594',
          customer_vat_number: '0919191951',
        }}
        open
        onOpenChange={close}
      />,
    );
    expect(screen.getByLabelText('SIRET / identifiant du client')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('N° TVA du client')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Vous pouvez enregistrer ce brouillon/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nom du client'), {
      target: { value: 'Nom sur le brouillon en cours' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({ customer_registration_number: '109198440054594' }),
        }),
      ),
    );
  });
  it('retire les alertes après correction ou changement de pays', () => {
    render(
      <InvoiceDraftEditor
        invoice={{
          ...invoice,
          customer_type: 'company',
          customer_registration_number: '123',
          customer_vat_number: 'BE0123456789',
        }}
        open
        onOpenChange={close}
      />,
    );
    fireEvent.change(screen.getByLabelText('SIRET / identifiant du client'), {
      target: { value: '123 456 789' },
    });
    expect(screen.getByLabelText('SIRET / identifiant du client')).not.toHaveAttribute(
      'aria-invalid',
    );
    fireEvent.change(screen.getByLabelText('Pays'), { target: { value: 'BE' } });
    expect(screen.getByLabelText('N° TVA du client')).not.toHaveAttribute('aria-invalid');
  });
  it('enregistre la date, la nature de l’opération et les conditions d’escompte', async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    renderEditor();
    fireEvent.change(screen.getByLabelText('Date de prestation ou de livraison'), {
      target: { value: '2026-09-02' },
    });
    screen.getByRole('combobox', { name: 'Nature de l’opération' }).focus();
    await user.keyboard('{ArrowDown}p{Enter}');
    fireEvent.change(screen.getByLabelText('Conditions d’escompte'), {
      target: { value: 'Escompte : néant' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({
            service_date: '2026-09-02',
            operation_type: 'services',
            early_payment_terms: 'Escompte : néant',
          }),
        }),
      ),
    );
  });

  it('propose les valeurs certaines et permet de les confirmer sans saisie artificielle', () => {
    renderEditor();
    expect(screen.getByRole('combobox', { name: 'Nature de l’opération' })).toHaveTextContent(
      'Prestation de services',
    );
    expect(screen.getByLabelText('Conditions d’escompte')).toHaveValue(
      'Escompte pour paiement anticipé : néant.',
    );
    expect(screen.getByText(/Des valeurs sûres ont été proposées/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer le brouillon' })).toBeEnabled();
    expect(state.save).not.toHaveBeenCalled();
  });

  it('enregistre le destinataire et les montants avec la version ouverte du brouillon', async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText('Nom du client'), {
      target: { value: 'Nom corrigé' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedUpdatedAt: invoice.updated_at,
          patch: expect.objectContaining({
            customer_name: 'Nom corrigé',
            customer_type: 'individual',
          }),
          items: [expect.objectContaining({ priceEuros: 123.45, quantity: 2, vatRate: 8.5 })],
        }),
      ),
    );
    expect(close).toHaveBeenCalledWith(false);
  });
  it('reprend explicitement la fiche client et son complément d’adresse', async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(screen.getByLabelText('Nom du client')).toHaveValue('Nom sur le brouillon');
    await user.click(screen.getByRole('button', { name: 'Reprendre la fiche client' }));
    expect(screen.getByLabelText('Nom du client')).toHaveValue('Fiche actuelle');
    expect(state.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({
            customer_name: 'Fiche actuelle',
            customer_address_line2: 'Bâtiment B',
          }),
        }),
      ),
    );
  });
  it('garde la saisie et l’éditeur ouverts après un conflit d’enregistrement', async () => {
    state.error = new AppError('conflict', 'Ce brouillon a été modifié.');
    state.save.mockRejectedValue(state.error);
    renderEditor();
    fireEvent.change(screen.getByLabelText('Nom du client'), {
      target: { value: 'Nom sur le brouillon corrigé' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nom du client')).toHaveValue('Nom sur le brouillon corrigé');
    expect(screen.getByText('Ce brouillon a été modifié.')).toBeInTheDocument();
  });
});
