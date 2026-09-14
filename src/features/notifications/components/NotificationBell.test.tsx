import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationBell } from './NotificationBell';

const mockNotifications = [
  {
    id: 'leave_1',
    type: 'leave_request' as const,
    category: 'hr' as const,
    severity: 'warning' as const,
    title: 'Demande de congé en attente',
    description: 'Alexandre Tech a déposé une demande de congé.',
    timestamp: new Date().toISOString(),
    read: false,
    link: '/planning',
  },
];

const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockDismissNotification = vi.fn();

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: 1,
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    dismissNotification: mockDismissNotification,
  }),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le bouton cloche avec le badge non lu', () => {
    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>,
    );

    const bellBtn = screen.getByRole('button', { name: /Notifications d'activité/i });
    expect(bellBtn).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('ouvre le panneau de notifications lors du clic et affiche la liste', () => {
    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>,
    );

    const bellBtn = screen.getByRole('button', { name: /Notifications d'activité/i });
    fireEvent.click(bellBtn);

    expect(screen.getByText('Demande de congé en attente')).toBeInTheDocument();
    expect(screen.getByText(/Alexandre Tech/)).toBeInTheDocument();
    expect(screen.getByText('Tout marquer lu')).toBeInTheDocument();
  });

  it('garde le panneau dans la largeur de l’écran sur mobile', () => {
    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Notifications d'activité/i }));

    expect(screen.getByRole('dialog', { name: 'Centre de notifications' })).toHaveClass(
      'w-[calc(100vw-1.5rem)]',
      'sm:w-96',
      'max-h-[calc(100dvh-5rem)]',
    );
  });

  it('permet de tout marquer comme lu', () => {
    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>,
    );

    const bellBtn = screen.getByRole('button', { name: /Notifications d'activité/i });
    fireEvent.click(bellBtn);

    const markAllBtn = screen.getByText('Tout marquer lu');
    fireEvent.click(markAllBtn);

    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });

  it('s’ouvre au clavier, se ferme avec Échap et restitue le focus', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>,
    );
    const trigger = screen.getByRole('button', { name: /Notifications d'activité/i });

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Centre de notifications' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('sépare la navigation et la suppression d’une notification', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Notifications d'activité/i }));
    await user.click(
      screen.getByRole('button', {
        name: /Masquer la notification « Demande de congé en attente »/i,
      }),
    );

    expect(mockDismissNotification).toHaveBeenCalledWith('leave_1');
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });
});
