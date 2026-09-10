import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AiMessage } from '../types/ai.types';

import { AiMessageItem } from './AiMessageItem';

function assistantMessage(content: string): AiMessage {
  return {
    id: 'message-1',
    role: 'assistant',
    content,
    timestamp: '2026-09-09T12:00:00.000Z',
  };
}

describe('AiMessageItem', () => {
  it('affiche le HTML provenant de l’IA comme du texte inoffensif', () => {
    render(
      <AiMessageItem
        message={assistantMessage('<img src=x onerror="window.__pwned=true">')}
        onExecuteAction={vi.fn()}
      />,
    );

    expect(screen.getByText('<img src=x onerror="window.__pwned=true">')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('conserve le formatage markdown autorisé sans interpréter son contenu en HTML', () => {
    render(
      <AiMessageItem
        message={assistantMessage('**Important** : utilisez `<script>alert(1)</script>`.')}
        onExecuteAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Important').tagName).toBe('STRONG');
    expect(screen.getByText('<script>alert(1)</script>').tagName).toBe('CODE');
    expect(document.querySelector('script')).toBeNull();
  });
});
