import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeCreditNote, completeInvoice } from '@/test/fixtures/invoice';
import { ExportUblPanel } from './ExportUblPanel';
import { downloadFacturX, downloadTestFacturX } from '../api/facturx.api';
import { emetteurFacture } from '../validation/invoice';
import type { Organization } from '@/types/domain';

vi.mock('../api/facturx.api', () => ({ downloadFacturX: vi.fn(), downloadTestFacturX: vi.fn() }));

const createUrl = vi.fn<(blob: Blob | MediaSource) => string>(() => 'blob:test');
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(createUrl);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('téléchargement électronique', () => {
  it('propose les trois exports sur un avoir émis, sans exiger le compte bancaire du vendeur', async () => {
    const invoice = completeCreditNote();
    vi.mocked(downloadFacturX).mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    render(<ExportUblPanel invoice={invoice} organization={null} />);
    expect(screen.getByRole('button', { name: 'Télécharger le fichier UBL' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Télécharger les données CII' })).toBeEnabled();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Télécharger le PDF Factur-X' }));
    expect(downloadFacturX).toHaveBeenCalledWith(invoice.id);
    expect(await screen.findByRole('status')).toHaveTextContent('conservé avec cet avoir');
  });
  it('propose une simulation d’avoir en conservant le brouillon', async () => {
    const invoice = completeCreditNote();
    const organization = emetteurFacture(invoice, null) as Organization;
    invoice.status = 'draft';
    invoice.issued_at = null;
    invoice.due_date = '2099-01-01';
    vi.mocked(downloadTestFacturX).mockResolvedValue(
      new Blob(['pdf'], { type: 'application/pdf' }),
    );
    render(<ExportUblPanel invoice={invoice} organization={organization} />);
    expect(
      screen.queryByRole('button', { name: 'Télécharger le PDF Factur-X' }),
    ).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Simuler l’émission' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Aucun avoir n’a été émis');
    expect(downloadFacturX).not.toHaveBeenCalled();
    expect(invoice.status).toBe('draft');
  });
  it('simule depuis un brouillon puis télécharge un fichier TEST sans appeler le téléchargement définitif', async () => {
    const invoice = completeInvoice();
    invoice.payment_method = 'CB';
    invoice.due_date = '2099-01-01';
    const organization = emetteurFacture(invoice, null) as Organization;
    invoice.status = 'draft';
    invoice.issued_at = null;
    const before = JSON.stringify(invoice);
    vi.mocked(downloadTestFacturX).mockResolvedValue(
      new Blob(['%PDF-test'], { type: 'application/pdf' }),
    );
    render(<ExportUblPanel invoice={invoice} organization={organization} />);
    expect(screen.getByRole('heading', { name: 'Mode test' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Télécharger le PDF Factur-X' }),
    ).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Simuler l’émission' }));
    expect(downloadTestFacturX).toHaveBeenCalledWith(invoice.id, invoice.updated_at);
    expect(downloadFacturX).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Aucune facture n’a été émise');
    expect(JSON.stringify(invoice)).toBe(before);
  });
  it('bloque la simulation avec des données invalides', () => {
    const invoice = completeInvoice();
    const organization = emetteurFacture(invoice, null) as Organization;
    invoice.status = 'draft';
    invoice.customer_registration_number = '123';
    render(<ExportUblPanel invoice={invoice} organization={organization} />);
    expect(screen.getByRole('button', { name: 'Simuler l’émission' })).toBeDisabled();
    expect(downloadTestFacturX).not.toHaveBeenCalled();
  });
  it('produit un fichier XML sans modifier le statut ni prétendre à un envoi', async () => {
    const invoice = completeInvoice();
    const user = userEvent.setup();
    render(<ExportUblPanel invoice={invoice} organization={null} />);
    expect(screen.queryByRole('button', { name: 'Simuler l’émission' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Télécharger le fichier UBL' }));
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(createUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(invoice.status).toBe('issued');
    expect(screen.getByRole('status')).toHaveTextContent('Aucune facture n’a été envoyée');
  });
  it('propose le CII comme donnée préparant Factur-X, sans le présenter comme un PDF', async () => {
    const invoice = completeInvoice();
    invoice.seller_iban = 'FR7612345987650123456789014';
    const user = userEvent.setup();
    render(<ExportUblPanel invoice={invoice} organization={null} />);
    expect(screen.getByText(/PDF Factur-X est conservé/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Télécharger les données CII' }));
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Données CII préparées');
  });
  it('télécharge le PDF conservé par le serveur sans modifier la facture', async () => {
    const invoice = completeInvoice();
    invoice.seller_iban = 'FR7612345987650123456789014';
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    vi.mocked(downloadFacturX).mockResolvedValue(blob);
    render(<ExportUblPanel invoice={invoice} organization={null} />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Télécharger le PDF Factur-X' }));
    expect(downloadFacturX).toHaveBeenCalledWith(invoice.id);
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(invoice.status).toBe('issued');
    expect(await screen.findByRole('status')).toHaveTextContent('aucun envoi n’a été effectué');
  });
  it('affiche un refus du serveur sans télécharger un document de remplacement', async () => {
    const invoice = completeInvoice();
    invoice.payment_method = 'CB';
    vi.mocked(downloadFacturX).mockRejectedValue(new Error('Facture inaccessible.'));
    render(<ExportUblPanel invoice={invoice} organization={null} />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Télécharger le PDF Factur-X' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Facture inaccessible.');
    expect(createUrl).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Télécharger le PDF Factur-X' })).toBeEnabled();
  });
  it('explique un IBAN manquant avant de proposer Factur-X', () => {
    render(<ExportUblPanel invoice={completeInvoice()} organization={null} />);
    expect(screen.getByRole('button', { name: 'Télécharger le PDF Factur-X' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Télécharger les données CII' })).toBeDisabled();
    expect(screen.getByText(/IBAN de l’émetteur est requis/)).toBeInTheDocument();
  });
  it('refuse le téléchargement si les totaux sont incohérents', () => {
    const invoice = completeInvoice();
    invoice.totals!.total_cents += 1;
    render(<ExportUblPanel invoice={invoice} organization={null} />);
    expect(screen.getByRole('button', { name: 'Télécharger le fichier UBL' })).toBeDisabled();
    expect(createUrl).not.toHaveBeenCalled();
    expect(screen.getByText(/totaux de la facture ne concordent/)).toBeInTheDocument();
  });

  it('explique clairement la limite du premier export pour un particulier', () => {
    const invoice = completeInvoice();
    invoice.customer_type = 'individual';
    invoice.customer_registration_number = null;
    render(<ExportUblPanel invoice={invoice} organization={null} />);
    expect(screen.getByRole('button', { name: 'Export UBL non disponible' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Télécharger les données CII' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('adressée à un particulier');
    expect(screen.queryByText(/Préparation de l’export/)).not.toBeInTheDocument();
  });
});
