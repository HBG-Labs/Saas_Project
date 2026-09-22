import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_DOCUMENT_OPTIONS } from '../document-options';
import { DocumentOptionsPanel } from './DocumentOptionsPanel';

describe('DocumentOptionsPanel', () => {
  it('ne propose plus une traduction qui ne fonctionne pas', () => {
    render(
      <DocumentOptionsPanel
        kind="quote"
        value={DEFAULT_DOCUMENT_OPTIONS}
        onChange={() => undefined}
      />,
    );

    expect(screen.queryByText('Langue')).not.toBeInTheDocument();
    expect(screen.queryByText('Traduire')).not.toBeInTheDocument();
  });

  it('propose le format électronique sur un devis sans le présenter comme un Factur-X', () => {
    render(
      <DocumentOptionsPanel
        kind="quote"
        value={DEFAULT_DOCUMENT_OPTIONS}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText('Format électronique')).toBeInTheDocument();
    expect(screen.getByText(/conversion Factur‑X/)).toBeInTheDocument();
  });

  it('active les informations nécessaires en mode complet', async () => {
    const onChange = vi.fn();
    render(
      <DocumentOptionsPanel kind="quote" value={DEFAULT_DOCUMENT_OPTIONS} onChange={onChange} />,
    );

    await userEvent.click(screen.getByLabelText('Complet'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'complete',
        showDeliveryAddress: true,
        showRegistrationNumber: true,
        showVatNumber: true,
        showBankDetails: true,
        showTitle: true,
        showFreeField: true,
        showGlobalDiscount: true,
        showAcceptanceTerms: true,
        showSignature: true,
      }),
    );
  });

  it('réinitialise réellement le document quand on revient au mode rapide', async () => {
    const onChange = vi.fn();
    render(
      <DocumentOptionsPanel
        kind="quote"
        value={{
          ...DEFAULT_DOCUMENT_OPTIONS,
          mode: 'complete',
          showDeliveryAddress: true,
          showRegistrationNumber: true,
          showVatNumber: true,
          showBankDetails: true,
          showTitle: true,
          showFreeField: true,
          showSignature: true,
          showAcceptanceTerms: true,
          showGlobalDiscount: true,
        }}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByLabelText('Rapide'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'quick',
        showDeliveryAddress: false,
        showRegistrationNumber: false,
        showVatNumber: false,
        showBankDetails: false,
        showTitle: false,
        showFreeField: false,
        showSignature: false,
        showAcceptanceTerms: false,
        showGlobalDiscount: false,
      }),
    );
  });

  it('bascule chaque option directement depuis la barre latérale', async () => {
    const onChange = vi.fn();
    render(
      <DocumentOptionsPanel kind="invoice" value={DEFAULT_DOCUMENT_OPTIONS} onChange={onChange} />,
    );

    await userEvent.click(screen.getByLabelText('Coordonnées bancaires'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showBankDetails: true }));
  });
});
