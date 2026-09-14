import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DownloadAppModal } from './DownloadAppModal';

const installPwa = vi.fn();
const usePwaInstall = vi.fn();

vi.mock('@/components/feedback/usePwaInstall', () => ({
  usePwaInstall: () => usePwaInstall(),
}));

describe('DownloadAppModal', () => {
  beforeEach(() => {
    installPwa.mockReset();
    usePwaInstall.mockReset();
    usePwaInstall.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installPwa,
    });
  });

  it("présente un parcours d'installation nommé et adapté à chaque appareil", () => {
    render(<DownloadAppModal isOpen onClose={vi.fn()} />);

    expect(
      screen.getByRole('dialog', { name: 'Installer REZO360 sur votre appareil' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Android — Chrome' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'iPhone / iPad — Safari' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ordinateur' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR code vers rezo360.com' })).toBeInTheDocument();
  });

  it("ferme la fenêtre après l'acceptation de l'installation native", async () => {
    const onClose = vi.fn();
    installPwa.mockResolvedValue(true);
    render(<DownloadAppModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Installer maintenant' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("affiche l'aide du navigateur si l'installation native est indisponible", async () => {
    installPwa.mockResolvedValue(false);
    render(<DownloadAppModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Installer maintenant' }));

    expect(await screen.findByRole('status')).toHaveTextContent("icône d'installation");
  });

  it("confirme l'installation existante sans proposer une seconde installation", () => {
    usePwaInstall.mockReturnValue({
      isInstallable: false,
      isInstalled: true,
      installPwa,
    });

    render(<DownloadAppModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('déjà installé');
    expect(screen.queryByRole('button', { name: 'Installer maintenant' })).not.toBeInTheDocument();
  });

  it('se ferme avec la touche Échap', async () => {
    const onClose = vi.fn();
    render(<DownloadAppModal isOpen onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
