import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { ReceivedInvoice } from '@/types/domain';

import { ReceivedInvoicesTable } from './ReceivedInvoicesTable';

/*
  Même patron que `ProspectsTable.test.tsx` : les deux balisages (cartes
  mobile, table desktop) sont rendus simultanément en jsdom — seule la classe
  CSS `md:hidden`/`md:table` les distingue, ce test ne vérifie donc pas la
  bascule visuelle, seulement que le contenu attendu est bien présent.
*/

function receivedInvoice(overrides: Partial<ReceivedInvoice> = {}): ReceivedInvoice {
  return {
    id: 'inv-1',
    organization_id: 'org-1',
    provider_code: 'superpdp',
    provider_invoice_id: '555',
    internal_status: 'new',
    regulatory_status: null,
    supplier_name: 'Fournisseur Antilles',
    supplier_siren: '852322915',
    supplier_identifier: '852322915',
    currency_code: 'EUR',
    amount_without_vat: 100,
    amount_vat: 20,
    amount_with_vat: 120,
    issue_date: '2026-09-01',
    payment_due_date: '2026-10-01',
    received_at: '2026-09-02T00:00:00Z',
    last_error_code: null,
    last_error_message: null,
    created_at: '2026-09-02T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
    ...overrides,
  };
}

describe('ReceivedInvoicesTable', () => {
  it('affiche un état vide explicite en l’absence de résultats', () => {
    render(<ReceivedInvoicesTable rows={[]} onSortChange={() => {}} />);

    expect(screen.getByText('Aucune facture reçue')).toBeInTheDocument();
  });

  it('affiche chaque facture, avec son fournisseur et son montant TTC', () => {
    renderWithProviders(
      <ReceivedInvoicesTable rows={[receivedInvoice()]} onSortChange={() => {}} />,
    );

    // Deux fois : carte mobile + ligne desktop, jsdom rend les deux balisages.
    expect(screen.getAllByText('Fournisseur Antilles').length).toBeGreaterThan(0);
    expect(screen.getAllByText('120.00 EUR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nouvelle').length).toBeGreaterThan(0);
  });

  it('un fournisseur inconnu ne casse pas l’affichage', () => {
    renderWithProviders(
      <ReceivedInvoicesTable
        rows={[receivedInvoice({ supplier_name: null })]}
        onSortChange={() => {}}
      />,
    );

    expect(screen.getAllByText('Fournisseur inconnu').length).toBeGreaterThan(0);
  });

  it('premier clic sur une colonne : tri décroissant', () => {
    const onSortChange = vi.fn();
    renderWithProviders(
      <ReceivedInvoicesTable rows={[receivedInvoice()]} onSortChange={onSortChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Trier par Échéance/ }));

    expect(onSortChange).toHaveBeenCalledWith({ column: 'payment_due_date', direction: 'desc' });
  });

  it('un second clic sur la même colonne déjà triée bascule croissant/décroissant', () => {
    const onSortChange = vi.fn();
    renderWithProviders(
      <ReceivedInvoicesTable
        rows={[receivedInvoice()]}
        sort={{ column: 'received_at', direction: 'desc' }}
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Trier par Reçue le/ }));

    expect(onSortChange).toHaveBeenCalledWith({ column: 'received_at', direction: 'asc' });
  });

  it('cliquer une autre colonne repart décroissant, peu importe le tri précédent', () => {
    const onSortChange = vi.fn();
    renderWithProviders(
      <ReceivedInvoicesTable
        rows={[receivedInvoice()]}
        sort={{ column: 'received_at', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Trier par Montant TTC/ }));

    expect(onSortChange).toHaveBeenCalledWith({ column: 'amount_with_vat', direction: 'desc' });
  });
});
