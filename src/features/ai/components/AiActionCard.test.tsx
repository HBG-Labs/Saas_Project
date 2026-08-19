import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AiProposedAction } from '../types/ai.types';

import { AiActionCard } from './AiActionCard';

describe('AiActionCard — composant d’action IA sécurisée', () => {
  it('affiche le titre et la description de l’action', () => {
    const action: AiProposedAction = {
      id: 'act-1',
      title: 'Vérifier les interventions en retard',
      description: 'Accéder à la file de revue des rapports.',
      actionType: 'view_late_interventions',
      requiresConfirmation: false,
      status: 'idle',
    };

    render(<AiActionCard action={action} onExecute={vi.fn()} />);

    expect(screen.getByText('Vérifier les interventions en retard')).toBeInTheDocument();
    expect(screen.getByText('Accéder à la file de revue des rapports.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accéder/ })).toBeInTheDocument();
  });

  it('exige une confirmation explicite si requiresConfirmation est true', async () => {
    const user = userEvent.setup();
    const handleExecute = vi.fn();

    const action: AiProposedAction = {
      id: 'act-2',
      title: 'Générer un rapport brouillon',
      description: 'Action sensible de création de document.',
      actionType: 'draft_intervention_report',
      requiresConfirmation: true,
      status: 'idle',
    };

    render(<AiActionCard action={action} onExecute={handleExecute} />);

    expect(screen.getByText(/Confirmation requise/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmer l’action/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refuser/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirmer l’action/ }));
    expect(handleExecute).toHaveBeenCalledWith('act-2', true);
  });
});
