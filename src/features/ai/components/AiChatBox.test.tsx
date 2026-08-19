import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AiMessage, AiSearchHistoryItem, AiSuggestion } from '../types/ai.types';

import { AiChatBox } from './AiChatBox';

describe('AiChatBox', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  const mockMessages: AiMessage[] = [
    {
      id: 'm1',
      role: 'assistant',
      content: 'Bonjour ! Comment puis-je vous aider ?',
      timestamp: new Date().toISOString(),
    },
  ];

  const mockSuggestions: AiSuggestion[] = [
    {
      id: 's1',
      label: 'Retards',
      category: 'interventions',
      prompt: 'Quelles sont les interventions en retard ?',
    },
  ];

  const mockHistory: AiSearchHistoryItem[] = [
    {
      id: 'h1',
      query: 'Câbles fibre optique',
      timestamp: new Date().toISOString(),
    },
  ];

  it('affiche le flux de messages, le bouton historique et la barre de saisie', () => {
    render(
      <AiChatBox
        messages={mockMessages}
        isGenerating={false}
        error={null}
        suggestions={mockSuggestions}
        searchHistory={mockHistory}
        onSendMessage={vi.fn()}
        onExecuteAction={vi.fn()}
        onClear={vi.fn()}
        onSelectSuggestion={vi.fn()}
      />,
    );

    expect(screen.getByText('Assistant REZO360 IA')).toBeInTheDocument();
    expect(screen.getByText('Bonjour ! Comment puis-je vous aider ?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Historique/ })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Poser une question sur vos interventions/),
    ).toBeInTheDocument();
  });

  it('affiche les recherches récentes et permet la suppression rapide d’un élément', async () => {
    const user = userEvent.setup();
    const handleRemoveHistory = vi.fn();
    const handleSelectHistory = vi.fn();

    render(
      <AiChatBox
        messages={mockMessages}
        isGenerating={false}
        error={null}
        suggestions={mockSuggestions}
        searchHistory={mockHistory}
        onSendMessage={vi.fn()}
        onExecuteAction={vi.fn()}
        onClear={vi.fn()}
        onSelectSuggestion={vi.fn()}
        onSelectSearchHistory={handleSelectHistory}
        onRemoveSearchHistoryItem={handleRemoveHistory}
      />,
    );

    expect(screen.getByText('Câbles fibre optique')).toBeInTheDocument();

    const quickDelete = screen.getByRole('button', { name: 'Supprimer cette recherche' });
    await user.click(quickDelete);

    expect(handleRemoveHistory).toHaveBeenCalledWith('h1');
  });

  it('ouvre le volet d’historique au clic sur le bouton Historique', async () => {
    const user = userEvent.setup();

    render(
      <AiChatBox
        messages={mockMessages}
        isGenerating={false}
        error={null}
        suggestions={mockSuggestions}
        searchHistory={mockHistory}
        onSendMessage={vi.fn()}
        onExecuteAction={vi.fn()}
        onClear={vi.fn()}
        onSelectSuggestion={vi.fn()}
      />,
    );

    const historyBtn = screen.getByRole('button', { name: /Historique/ });
    await user.click(historyBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Historique des recherches')).toBeInTheDocument();
  });
});
