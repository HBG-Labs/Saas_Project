import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MemberWithProfile } from '@/types/domain';

import { NewLeaveModal } from './NewLeaveModal';

vi.mock('../hooks/usePlanning', () => ({
  useLeaveDaysPreview: () => ({
    data: [{ day: '2026-09-14', value: 1, counted: true, reason: null }],
    isLoading: false,
    isError: false,
  }),
}));

const MEMBER = {
  id: 'member-1',
  role: 'technician',
  job_title: 'Technicien',
  profile: {
    id: 'profile-1',
    display_name: 'Alex Martin',
    avatar_id: null,
  },
} as MemberWithProfile;

describe('NewLeaveModal', () => {
  it('soumet une absence pour le membre présélectionné', () => {
    const onSubmit = vi.fn();

    render(
      <NewLeaveModal
        open
        onOpenChange={vi.fn()}
        members={[MEMBER]}
        defaultMemberId={MEMBER.id}
        canRequestForOthers={false}
        territory="FR"
        submitting={false}
        error={null}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Poser un congé ou une absence' })).toBeVisible();
    expect(screen.getByText('1 jour(s)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Commentaire/), {
      target: { value: 'Rendez-vous médical' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’absence' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: MEMBER.id,
        type: 'paid_leave',
        reason: 'Rendez-vous médical',
      }),
    );
  });
});
