import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { PortalConversation, PortalMessage } from '@/features/portal';
import PortalMessagesPage from '@/pages/portal/PortalMessagesPage';
import type { PortalContext } from '@/types/database';

const state = vi.hoisted(
  (): {
    conversations: Array<PortalConversation & { unread_count: number }>;
    messages: PortalMessage[];
    markRead: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  } => ({ conversations: [], messages: [], markRead: vi.fn(), send: vi.fn() }),
);

vi.mock('@/features/portal', async (importActual) => {
  const actual = await importActual<typeof import('@/features/portal')>();
  return {
    ...actual,
    usePortalConversations: () => ({
      data: state.conversations,
      error: null,
      isError: false,
      isPending: false,
      isSuccess: true,
      refetch: vi.fn(),
    }),
    usePortalMessages: () => ({
      data: state.messages,
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    }),
    useMarkReadByClient: () => ({ isPending: false, mutate: state.markRead }),
    useSendPortalMessage: () => ({ isPending: false, mutate: state.send }),
    usePortalFileUrl: () => ({ isPending: false, mutate: vi.fn() }),
  };
});

const CONTEXT: PortalContext = {
  organization_id: 'organization-1',
  organization_name: 'Atelier Démonstration',
  contact_id: 'contact-1',
  contact_first_name: 'Marie',
  contact_last_name: 'Client',
  contact_email: 'marie@example.com',
  customer_id: 'customer-1',
  customer_name: 'Client Exemple',
  allow_client_initiated: true,
  features: {
    missions: true,
    interventions: true,
    quotes: true,
    invoicing: true,
    documents: true,
  },
};

const CONVERSATION: PortalConversation & { unread_count: number } = {
  id: 'conversation-1',
  organization_id: 'organization-1',
  customer_id: 'customer-1',
  contact_id: 'contact-1',
  subject: 'Question sur le rendez-vous',
  status: 'open',
  initiated_by: 'client',
  mission_id: null,
  quote_id: null,
  invoice_id: null,
  last_message_at: '2026-09-14T10:00:00Z',
  created_by: null,
  created_at: '2026-09-14T09:00:00Z',
  updated_at: '2026-09-14T10:00:00Z',
  unread_count: 1,
};

const MESSAGE: PortalMessage = {
  id: 'message-1',
  organization_id: 'organization-1',
  conversation_id: 'conversation-1',
  direction: 'outbound',
  channel: 'portal',
  author_user_id: 'user-1',
  sender_email: null,
  recipient_email: null,
  subject: null,
  body_text: 'Bonjour, le technicien passera à 9 h.',
  body_html: null,
  resend_email_id: null,
  internet_message_id: null,
  in_reply_to: null,
  references_header: null,
  status: 'sent',
  error: null,
  sent_at: '2026-09-14T10:00:00Z',
  delivered_at: null,
  received_at: null,
  read_by_client_at: null,
  read_by_staff_at: null,
  created_at: '2026-09-14T10:00:00Z',
  attachments: [],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/portail',
        element: <Outlet context={CONTEXT} />,
        children: [{ path: 'messages', element: <PortalMessagesPage /> }],
      },
    ],
    { initialEntries: ['/portail/messages'] },
  );

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

describe('PortalMessagesPage', () => {
  it('ouvre un fil non lu et conserve l’envoi d’une réponse', async () => {
    state.conversations = [CONVERSATION];
    state.messages = [MESSAGE];
    state.markRead.mockReset();
    state.send.mockReset();
    const { user } = renderPage();

    expect(screen.getByText('1 conversation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /question sur le rendez-vous/i }));

    expect(screen.getByText('Bonjour, le technicien passera à 9 h.')).toBeInTheDocument();
    expect(state.markRead).toHaveBeenCalledWith('conversation-1');

    await user.type(
      screen.getByRole('textbox', { name: 'Votre message' }),
      'Merci pour la confirmation.',
    );
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(state.send).toHaveBeenCalledWith(
      { conversationId: 'conversation-1', body: 'Merci pour la confirmation.' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('rend une conversation close lisible et empêche la réponse', async () => {
    state.conversations = [{ ...CONVERSATION, status: 'closed', unread_count: 0 }];
    state.messages = [MESSAGE];
    const { user } = renderPage();

    await user.click(screen.getByRole('button', { name: /question sur le rendez-vous/i }));

    expect(screen.getByText('Conversation close')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Votre message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });
});
