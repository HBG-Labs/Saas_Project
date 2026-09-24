import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { MemberWithProfile } from '@/types/domain';

import type { PlanningCalendarEvent } from '../types';
import { MobilePlanningView } from './MobilePlanningView';

const EVENTS: PlanningCalendarEvent[] = [
  {
    id: 'mission-1',
    missionId: '11111111-1111-4111-8111-111111111111',
    reference: 'MIS-2026-0042',
    title: 'Maintenance armoire réseau',
    date: '2026-09-23',
    type: 'intervention',
    status: 'in_progress',
    priority: 'high',
    startTime: '08:00',
    endTime: '09:30',
    scheduledStart: '2026-09-23T12:00:00.000Z',
    clientName: 'Client test',
    siteName: 'Site test',
    address: '1 rue du Test',
    interventionTypeId: 'type-1',
    interventionTypeLabel: 'Maintenance',
    interventionTypeIcon: 'wrench',
  },
];

const TEAM_MEMBER = {
  id: 'member-team-1',
  profile: {
    id: 'profile-team-1',
    display_name: 'Alex Terrain',
    avatar_id: null,
  },
} as MemberWithProfile;

function renderPlanning(overrides: Partial<React.ComponentProps<typeof MobilePlanningView>> = {}) {
  const onNewMissionAtDate = vi.fn();
  const result = render(
    <MemoryRouter initialEntries={['/planning?date=2026-09-23&view=day']}>
      <MobilePlanningView
        events={EVENTS}
        leaves={[]}
        holidays={[]}
        members={[]}
        onNewMissionAtDate={onNewMissionAtDate}
        timeZone="America/Martinique"
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { ...result, onNewMissionAtDate };
}

describe('planning mobile', () => {
  it('affiche immédiatement les horaires, le statut et le contexte opérationnel', () => {
    renderPlanning();

    expect(
      screen.getByRole('heading', { name: /mercredi 23 septembre 2026/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('09:30')).toBeInTheDocument();
    expect(screen.getByText('Maintenance armoire réseau')).toBeInTheDocument();
    expect(screen.getByText('Client test')).toBeInTheDocument();
    expect(screen.getByText('Site test')).toBeInTheDocument();
    expect(screen.getAllByText('En cours').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'Aucun technicien affecté' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /ouvrir maintenance armoire réseau/i }),
    ).toHaveAttribute('href', '/missions/11111111-1111-4111-8111-111111111111');
  });

  it('change de journée en une interaction et propose un empty state utile', async () => {
    const user = userEvent.setup();
    renderPlanning();

    await user.click(screen.getByRole('button', { name: /jeudi 24 septembre 2026/i }));

    expect(screen.getByRole('heading', { name: /jeudi 24 septembre 2026/i })).toBeInTheDocument();
    expect(screen.getByText('Aucune intervention aujourd’hui')).toBeInTheDocument();
  });

  it('applique réellement un filtre de statut et sait le réinitialiser', async () => {
    const user = userEvent.setup();
    renderPlanning();

    await user.click(screen.getByRole('button', { name: 'Ouvrir les filtres' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtres' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Terminée' }));
    await user.click(within(dialog).getByRole('button', { name: 'Appliquer' }));

    expect(screen.getByText('Aucun résultat avec ces filtres')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(screen.getByText('Maintenance armoire réseau')).toBeInTheDocument();
  });

  it('retrouve une mission affectée à une équipe via le filtre technicien', async () => {
    const user = userEvent.setup();
    renderPlanning({
      events: [{ ...EVENTS[0]!, teamId: 'team-1' }],
      members: [TEAM_MEMBER],
      teamMembersByTeam: new Map([['team-1', [TEAM_MEMBER]]]),
    });

    await user.click(screen.getByRole('button', { name: 'Ouvrir les filtres' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtres' });
    await user.click(within(dialog).getByRole('button', { name: 'Alex Terrain' }));
    await user.click(within(dialog).getByRole('button', { name: 'Appliquer' }));

    expect(screen.getByText('Maintenance armoire réseau')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Techniciens affectés : Alex Terrain' }),
    ).toBeInTheDocument();
  });

  it('navigue réellement entre les vues liste, semaine et mois', async () => {
    const user = userEvent.setup();
    renderPlanning();

    await user.click(screen.getByRole('button', { name: 'Liste' }));
    expect(screen.getByRole('heading', { name: 'Prochaines interventions' })).toBeInTheDocument();
    expect(screen.getByText('Maintenance armoire réseau')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Semaine' }));
    expect(screen.getByRole('heading', { name: /21 sept.*27 sept.*2026/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    expect(screen.getByRole('heading', { name: /28 sept.*4 oct.*2026/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mois' }));
    expect(screen.getByRole('heading', { name: 'Septembre 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getByRole('heading', { name: 'Octobre 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jeudi 1 octobre 2026, 0 interventions' }));
    expect(screen.getByRole('heading', { name: 'Jeudi 1 octobre 2026' })).toBeInTheDocument();
  });

  it('respecte la création RBAC tout en gardant les plannings secondaires', async () => {
    const user = userEvent.setup();
    const onOpenLeaves = vi.fn();
    const onOpenTasks = vi.fn();
    const onOpenHolidays = vi.fn();
    const onExportICS = vi.fn();
    renderPlanning({
      canCreateMission: false,
      canImportICS: false,
      onOpenLeaves,
      onOpenTasks,
      onOpenHolidays,
      onExportICS,
    });

    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importer .ics' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Congés/ }));
    await user.click(screen.getByRole('button', { name: /^Tâches/ }));
    await user.click(screen.getByRole('button', { name: /Jours fériés/ }));
    await user.click(screen.getByRole('button', { name: 'Exporter .ics' }));

    expect(onOpenLeaves).toHaveBeenCalledOnce();
    expect(onOpenTasks).toHaveBeenCalledOnce();
    expect(onOpenHolidays).toHaveBeenCalledOnce();
    expect(onExportICS).toHaveBeenCalledOnce();
  });

  it('affiche l’appel seulement lorsqu’un numéro exploitable existe', () => {
    const { unmount } = renderPlanning({
      events: [{ ...EVENTS[0]!, phone: '06 12 34 56 78' }],
    });
    expect(screen.getByRole('link', { name: 'Appeler Client test' })).toHaveAttribute(
      'href',
      'tel:0612345678',
    );

    unmount();
    renderPlanning();
    expect(screen.queryByRole('link', { name: /Appeler/ })).not.toBeInTheDocument();
  });
});
