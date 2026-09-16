import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';

const { getMessageTemplateForSector } = vi.hoisted(() => ({
  getMessageTemplateForSector: vi.fn(),
}));

vi.mock('../api/prospecting.api', async () => {
  const actual = await vi.importActual<typeof import('../api/prospecting.api')>('../api/prospecting.api');
  return { ...actual, getMessageTemplateForSector };
});

import { ProspectMessageDraft } from './ProspectMessageDraft';

const TEMPLATE = {
  id: 'template-1',
  sector_id: 'sector-1',
  opening_variant: 'Félicitations pour le lancement de votre activité de plomberie.',
  features: ['centraliser vos clients', 'planifier vos interventions'],
  body_template: "Je me permets de vous contacter car j'ai développé REZO360.\n\n{{FEATURES}}{{TERRITOIRE}}",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProspectMessageDraft', () => {
  it('explique l’absence de brouillon quand le prospect n’a pas de secteur', () => {
    renderWithProviders(<ProspectMessageDraft sectorId={null} createdOn={null} commune={null} />);

    expect(screen.getByText(/pas de secteur reconnu/)).toBeInTheDocument();
    expect(getMessageTemplateForSector).not.toHaveBeenCalled();
  });

  it('explique l’absence de gabarit plutôt que d’inventer un brouillon générique', async () => {
    getMessageTemplateForSector.mockResolvedValueOnce(null);

    renderWithProviders(<ProspectMessageDraft sectorId="sector-1" createdOn={null} commune={null} />);

    expect(await screen.findByText(/pas encore d’argumentaire configuré/)).toBeInTheDocument();
  });

  it('affiche un brouillon assemblé depuis le gabarit du secteur', async () => {
    getMessageTemplateForSector.mockResolvedValueOnce(TEMPLATE);

    renderWithProviders(<ProspectMessageDraft sectorId="sector-1" createdOn={null} commune="Fort-de-France" />);

    const textarea = await screen.findByLabelText('Brouillon de message');
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toContain('centraliser vos clients');
    });
    expect((textarea as HTMLTextAreaElement).value).toContain('à Fort-de-France');
  });

  it('ne perd jamais une modification manuelle lors d’un nouveau rendu', async () => {
    getMessageTemplateForSector.mockResolvedValue(TEMPLATE);

    renderWithProviders(<ProspectMessageDraft sectorId="sector-1" createdOn={null} commune={null} />);

    const textarea = await screen.findByLabelText('Brouillon de message');
    fireEvent.change(textarea, { target: { value: 'Texte modifié à la main.' } });

    expect((textarea as HTMLTextAreaElement).value).toBe('Texte modifié à la main.');
    expect(screen.getByRole('button', { name: 'Revenir au brouillon d’origine' })).toBeInTheDocument();
  });
});
