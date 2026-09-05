import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeInvoice } from '@/test/fixtures/invoice';
import {
  CreateCreditNotePanel,
  CreditNoteDraftEditor,
  CreditNoteOrigin,
} from './CreditNoteWorkflow';

const mocks = vi.hoisted(() => ({
  related: {
    data: [] as ReturnType<typeof completeInvoice>[],
    isPending: false,
    isError: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  creditable: {
    data: [] as Array<{
      invoice_item_id: string;
      description: string;
      unit: string;
      unit_price_cents: number;
      vat_rate: number;
      vat_category: 'S';
      vat_exemption_reason: null;
      line_position: number;
      original_quantity: number;
      credited_quantity: number;
      available_quantity: number;
    }>,
    isPending: false,
    isError: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  create: { isPending: false, error: null, mutate: vi.fn(), reset: vi.fn() },
  save: { isPending: false, error: null, mutate: vi.fn() },
}));
vi.mock('../hooks/useInvoices', () => ({
  useRelatedCreditNotes: () => mocks.related,
  useCreditableInvoiceLines: () => mocks.creditable,
  useCreateCreditNoteDraft: () => mocks.create,
  useSaveFullCreditNoteDraft: () => mocks.save,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.related.data = [];
  mocks.related.isPending = false;
  mocks.related.isError = false;
  mocks.related.error = null;
  mocks.create.isPending = false;
  mocks.creditable.data = [
    {
      invoice_item_id: 'line-1',
      description: 'Pose & contrôle <électrique>',
      unit: 'h',
      unit_price_cents: 1234,
      vat_rate: 20,
      vat_category: 'S',
      vat_exemption_reason: null,
      line_position: 0,
      original_quantity: 2,
      credited_quantity: 0,
      available_quantity: 2,
    },
  ];
  mocks.creditable.isPending = false;
  mocks.creditable.isError = false;
  mocks.creditable.error = null;
});
const source = () => ({ ...completeInvoice(), status: 'paid' as const });
const credit = () => ({
  ...completeInvoice(),
  id: 'credit-test',
  status: 'draft' as const,
  document_type: 'credit_note' as const,
  credit_note_scope: 'full' as const,
  corrects_invoice_id: 'invoice-test',
  credit_note_reason: 'Annulation de la prestation',
  corrected_invoice_reference: 'FAC-2026-00001',
  corrected_invoice_issued_at: '2026-09-04T12:00:00Z',
});

describe('préparation d’un avoir', () => {
  it('prépare par défaut un avoir total avec toutes les quantités disponibles', async () => {
    const invoice = source();
    const before = JSON.stringify(invoice);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreateCreditNotePanel invoice={invoice} canManage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Préparer un avoir' }));
    expect(mocks.create.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Créer le brouillon d’avoir' })).toBeDisabled();
    expect(screen.getByText(/Aucun remboursement ni aucune émission/)).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Motif de l’avoir' }),
      'Annulation complète',
    );
    await user.click(screen.getByRole('button', { name: 'Créer le brouillon d’avoir' }));
    expect(mocks.create.mutate).toHaveBeenCalledWith(
      {
        invoiceId: invoice.id,
        expectedUpdatedAt: invoice.updated_at,
        reason: 'Annulation complète',
        scope: 'full',
        lines: [{ invoiceItemId: 'line-1', quantity: 2 }],
      },
      expect.any(Object),
    );
    expect(JSON.stringify(invoice)).toBe(before);
  });
  it('permet de choisir une quantité partielle et affiche le montant estimé', async () => {
    const invoice = source();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreateCreditNotePanel invoice={invoice} canManage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Préparer un avoir' }));
    const quantity = screen.getByRole('spinbutton', { name: 'Quantité à créditer' });
    await user.clear(quantity);
    await user.type(quantity, '0.5');
    expect(screen.getByText(/Montant estimé à créditer/)).toHaveTextContent(/7,40\s€/);
    await user.type(screen.getByRole('textbox', { name: 'Motif de l’avoir' }), 'Geste commercial');
    await user.click(screen.getByRole('button', { name: 'Créer le brouillon d’avoir' }));
    expect(mocks.create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'partial',
        lines: [{ invoiceItemId: 'line-1', quantity: 0.5 }],
      }),
      expect.any(Object),
    );
  });
  it('retrouve le brouillon existant et empêche une deuxième préparation', () => {
    mocks.related.data = [credit()];
    render(
      <MemoryRouter>
        <CreateCreditNotePanel invoice={source()} canManage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Ouvrir le brouillon d’avoir' })).toHaveAttribute(
      'href',
      '/factures/credit-test',
    );
    expect(screen.queryByRole('button', { name: 'Préparer un avoir' })).not.toBeInTheDocument();
  });
  it('ne propose pas de création pendant la vérification ou sans permission', () => {
    mocks.related.isPending = true;
    const { rerender } = render(
      <MemoryRouter>
        <CreateCreditNotePanel invoice={source()} canManage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Préparer un avoir' })).toBeDisabled();
    rerender(
      <MemoryRouter>
        <CreateCreditNotePanel invoice={source()} canManage={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Préparer un avoir' })).not.toBeInTheDocument();
  });
  it('bloque la création si le contrôle des avoirs existants échoue et propose de réessayer', async () => {
    mocks.related.isError = true;
    mocks.related.error = new Error('Lecture indisponible');
    render(
      <MemoryRouter>
        <CreateCreditNotePanel invoice={source()} canManage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Préparer un avoir' })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(mocks.related.refetch).toHaveBeenCalledOnce();
  });
  it('affiche les avoirs émis et bloque une quantité entièrement créditée', () => {
    const emitted = { ...credit(), status: 'issued' as const, reference: 'AV-2026-00001' };
    mocks.related.data = [emitted];
    mocks.creditable.data = [
      { ...mocks.creditable.data[0]!, credited_quantity: 2, available_quantity: 0 },
    ];
    render(
      <MemoryRouter>
        <CreateCreditNotePanel invoice={source()} canManage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /AV-2026-00001 · total/ })).toBeInTheDocument();
    expect(screen.getByText(/Toutes les quantités/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Préparer un avoir' })).toBeDisabled();
  });
  it('affiche la référence, la date et le motif sur le document lisible', () => {
    render(
      <MemoryRouter>
        <CreditNoteOrigin invoice={credit()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Avoir total sur FAC-2026-00001 du 04\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Motif : Annulation de la prestation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir la facture d’origine' })).toHaveAttribute(
      'href',
      '/factures/invoice-test',
    );
  });
  it('modifie les modalités sans proposer de changer le client ou les lignes', async () => {
    const invoice = credit();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreditNoteDraftEditor invoice={invoice} open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Enregistrer le brouillon' })).toBeDisabled();
    expect(screen.queryByLabelText('Nom du client')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter une ligne/ })).not.toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Motif de l’avoir' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Motif de l’avoir' }),
      'Prestation annulée par le client',
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(mocks.save.mutate).toHaveBeenCalledWith(
      {
        invoiceId: invoice.id,
        expectedUpdatedAt: invoice.updated_at,
        reason: 'Prestation annulée par le client',
        dueDate: invoice.due_date,
        paymentTerms: invoice.payment_terms,
      },
      expect.any(Object),
    );
  });
});
