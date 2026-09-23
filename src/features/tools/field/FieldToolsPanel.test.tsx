import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FieldToolsPanel } from './FieldToolsPanel';

vi.mock('./flashlight/FlashlightTool', () => ({
  default: () => <div>Lampe active</div>,
}));
vi.mock('./magnifier/MagnifierTool', () => ({
  default: () => <div>Loupe active</div>,
}));
vi.mock('./compass/CompassTool', () => ({
  default: () => <div>Boussole active</div>,
}));
vi.mock('./level/LevelTool', () => ({
  default: () => <div>Niveau actif</div>,
}));
vi.mock('./stopwatch/StopwatchTool', () => ({
  default: () => <div>Chronomètre actif</div>,
}));
vi.mock('./voice-recorder/VoiceRecorderTool', () => ({
  default: () => <div>Dictaphone actif</div>,
}));

describe('FieldToolsPanel', () => {
  it('annonce l’instrument actif et permet d’en changer', async () => {
    const user = userEvent.setup();

    render(<FieldToolsPanel initialTool="stopwatch" />);

    const stopwatch = screen.getByRole('button', { name: 'Chrono' });
    const compass = screen.getByRole('button', { name: 'Boussole' });

    expect(stopwatch).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Chronomètre actif')).toBeInTheDocument();

    await user.click(compass);

    expect(compass).toHaveAttribute('aria-pressed', 'true');
    expect(stopwatch).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByText('Boussole active')).toBeInTheDocument();
    const content = screen.getByRole('region', { name: 'Boussole & Cap' });
    expect(content).toHaveClass('min-h-0', 'overflow-y-auto');
    expect(content.parentElement).toHaveClass('min-h-0', 'flex-1');
  });

  it('expose une action de fermeture explicite', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<FieldToolsPanel onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Fermer les instruments de terrain' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
