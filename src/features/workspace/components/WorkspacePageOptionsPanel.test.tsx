import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { WorkspacePage } from '../api/workspace.api';
import { WorkspacePageOptionsPanel } from './WorkspacePageOptionsPanel';

const page = {
  id: 'page-1',
  font_family: 'sans',
  small_text: false,
  text_spacing: 'normal',
  full_width: false,
  locked: false,
  accent_color: 'blue',
  wiki_mode: false,
} as WorkspacePage;

function createProps() {
  return {
    page,
    canEdit: true,
    canAi: true,
    notificationLevel: 'mentions' as const,
    connectionCount: 2,
    onClose: vi.fn(),
    onPresentationChange: vi.fn(),
    onCopyLink: vi.fn(),
    onCopyContent: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onArchive: vi.fn(),
    onCustomize: vi.fn(),
    onUseAi: vi.fn(),
    onTranslate: vi.fn(),
    onImport: vi.fn(),
    onExport: vi.fn(),
    onToggleWiki: vi.fn(),
    onHistory: vi.fn(),
    onNotifications: vi.fn(),
    onConnections: vi.fn(),
  };
}

describe('WorkspacePageOptionsPanel', () => {
  it('regroupe les actions premium et exécute la personnalisation', () => {
    const props = createProps();
    render(<WorkspacePageOptionsPanel {...props} />);

    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Utiliser avec l'IA" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connexions' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser la page' }));
    expect(props.onCustomize).toHaveBeenCalledOnce();
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('filtre toutes les actions et conserve les réglages de présentation', () => {
    const props = createProps();
    render(<WorkspacePageOptionsPanel {...props} />);

    fireEvent.change(screen.getByLabelText('Rechercher des actions'), {
      target: { value: 'traduction' },
    });
    expect(screen.getByRole('button', { name: 'Traduire' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copier le lien' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rechercher des actions'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Sérif/ }));
    expect(props.onPresentationChange).toHaveBeenCalledWith({ font_family: 'serif' });
    fireEvent.click(screen.getByRole('switch', { name: 'Pleine largeur' }));
    expect(props.onPresentationChange).toHaveBeenCalledWith({ full_width: true });
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
    expect(props.onPresentationChange).toHaveBeenCalledWith({ text_spacing: 'compact' });
  });

  it('bloque les réglages concurrents pendant leur enregistrement', () => {
    const props = createProps();
    render(<WorkspacePageOptionsPanel {...props} presentationPending />);

    expect(screen.getByRole('button', { name: /Sérif/ })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Pleine largeur' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Verrouiller la page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aéré' })).toBeDisabled();
  });
});
