import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ImportICSModal } from './ImportICSModal';

const ICS_CONTENT = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:mission-1@rezo360.com',
  'DTSTART;VALUE=DATE:20260920',
  'SUMMARY:Maintenance réseau',
  'DESCRIPTION:Contrôle de la baie',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('ImportICSModal', () => {
  it('prévisualise puis importe les événements iCalendar', async () => {
    const onImport = vi.fn();

    render(
      <ImportICSModal
        open
        onOpenChange={vi.fn()}
        members={[]}
        submitting={false}
        onImport={onImport}
      />,
    );

    const file = new File([ICS_CONTENT], 'planning.ics', { type: 'text/calendar' });
    fireEvent.change(screen.getByLabelText('Fichier iCalendar'), {
      target: { files: [file] },
    });

    expect(await screen.findByText('Maintenance réseau')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Créer 1 mission' }));

    expect(onImport).toHaveBeenCalledWith({
      events: [
        {
          id: 'mission-1',
          title: 'Maintenance réseau',
          date: '2026-09-20',
          details: 'Contrôle de la baie',
        },
      ],
      assignedMemberId: null,
      sourceName: 'planning.ics',
    });
  });

  it('efface un ancien aperçu quand le nouveau fichier est invalide', async () => {
    render(
      <ImportICSModal
        open
        onOpenChange={vi.fn()}
        members={[]}
        submitting={false}
        onImport={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Fichier iCalendar');
    fireEvent.change(input, {
      target: {
        files: [new File([ICS_CONTENT], 'planning.ics', { type: 'text/calendar' })],
      },
    });
    expect(await screen.findByText('Maintenance réseau')).toBeInTheDocument();

    fireEvent.change(input, {
      target: { files: [new File(['texte'], 'planning.txt', { type: 'text/plain' })] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/format iCalendar/i);
    await waitFor(() => {
      expect(screen.queryByText('Maintenance réseau')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Créer mission' })).toBeDisabled();
  });
});
