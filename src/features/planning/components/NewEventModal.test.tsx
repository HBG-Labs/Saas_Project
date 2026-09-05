import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MemberWithProfile, Team } from '@/types/domain';

import { NewEventModal } from './NewEventModal';

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
  it('sépare clairement les équipes des intervenants', () => {
    renderModal();

    const assignment = screen.getByRole('combobox', { name: 'Affectation' });
    expect(assignment.querySelector('optgroup[label="Équipes"]')).toBeInTheDocument();
    expect(assignment.querySelector('optgroup[label="Intervenants"]')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: TEAM.name })).toHaveValue(`team:${TEAM.id}`);
    expect(screen.getByRole('option', { name: 'Alex Martin' })).toHaveValue(
      `member:${MEMBER.id}`,
    );
  });

  it('transmet exclusivement l’équipe sélectionnée à la création', () => {
    const onSubmit = renderModal();

    fireEvent.change(screen.getByLabelText(/intitulé/i), {
      target: { value: 'Maintenance armoire réseau' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Affectation' }), {
      target: { value: `team:${TEAM.id}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Planifier la mission' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTeamId: TEAM.id,
        assignedMemberId: null,
      }),
    );
  });
});
