import { fireEvent, render, screen } from '@testing-library/react';
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
});
