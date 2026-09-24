import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MissionStatusBadge } from './MissionBadges';

describe('MissionStatusBadge', () => {
  it('expose le statut réel au parcours visuel sans dépendre de la couleur', () => {
    render(<MissionStatusBadge status="in_progress" />);

    expect(screen.getByText('En cours')).toHaveAttribute('data-state', 'in_progress');
  });
});
