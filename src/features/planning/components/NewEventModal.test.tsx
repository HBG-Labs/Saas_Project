import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { MemberWithProfile, Team } from '@/types/domain';

import { NewEventModal } from './NewEventModal';

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    setPointerCapture: { configurable: true, value: () => undefined },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
  });
});

const TEAM = {
  id: 'team-1',
  name: 'Équipe Fibre Nord',
} as Team;

const MEMBER = {
  id: 'member-1',
  job_title: 'Technicien fibre',
  profile: {
    id: 'profile-1',
    display_name: 'Alex Martin',
    avatar_id: null,
  },
} as MemberWithProfile;

function renderModal(onSubmit = vi.fn()) {
  render(
    <NewEventModal
      open
      onOpenChange={vi.fn()}
      teams={[TEAM]}
      members={[MEMBER]}
      submitting={false}
      error={null}
      initialDate="2026-09-07"
      onSubmit={onSubmit}
    />,
  );

  return onSubmit;
}

describe('NewEventModal', () => {
  it('sépare clairement les équipes des intervenants', async () => {
    const user = userEvent.setup();
    renderModal();

    const assignment = screen.getByRole('combobox', { name: 'Affectation' });
    await user.click(assignment);

    expect(screen.getByText('Équipes')).toBeInTheDocument();
    expect(screen.getByText('Intervenants')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: TEAM.name })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alex Martin' })).toBeInTheDocument();
  });

  it('transmet exclusivement l’équipe sélectionnée à la création', async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    fireEvent.change(screen.getByLabelText(/intitulé/i), {
      target: { value: 'Maintenance armoire réseau' },
    });
    await user.click(screen.getByRole('combobox', { name: 'Affectation' }));
    await user.click(screen.getByRole('option', { name: TEAM.name }));
    await user.click(screen.getByRole('button', { name: 'Planifier la mission' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTeamId: TEAM.id,
        assignedMemberId: null,
      }),
    );
  });
});
