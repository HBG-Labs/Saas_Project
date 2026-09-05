import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InvoiceTransmissionTimeline } from '../api/transmission.api';
import { TransmissionStatusView } from './TransmissionStatusPanel';

describe('suivi de transmission électronique', () => {
  it('dit explicitement qu’aucun envoi n’a eu lieu sans connecteur', () => {
    render(<TransmissionStatusView timeline={{ transmission: null, events: [] }} />);
    expect(screen.getByText('Pas encore transmise')).toBeInTheDocument();
    expect(screen.getByText(/Cette facture n’a pas encore été transmise/)).toBeInTheDocument();
  });

  it('affiche un échec et sa chronologie sans le confondre avec le statut comptable', () => {
    const timeline: InvoiceTransmissionTimeline = {
      transmission: {
        id: 'transmission-1',
        invoice_id: 'invoice-1',
        organization_id: 'organization-1',
        provider_code: 'sandbox-pa',
        status: 'failed',
        idempotency_key: 'idempotency-1',
        provider_submission_id: null,
        attempt_count: 2,
        last_attempt_at: '2026-09-04T12:00:00.000Z',
        next_attempt_at: '2026-09-04T12:05:00.000Z',
        submitted_at: null,
        delivered_at: null,
        completed_at: null,
        last_error_code: 'timeout',
        last_error_message: 'La plateforme ne répond pas.',
        created_at: '2026-09-04T11:59:00.000Z',
        updated_at: '2026-09-04T12:00:00.000Z',
      },
      events: [
        {
          id: 'event-1',
          transmission_id: 'transmission-1',
          invoice_id: 'invoice-1',
          organization_id: 'organization-1',
          source: 'application',
          event_type: 'technical_failure',
          normalized_status: 'failed',
          provider_status_code: null,
          provider_event_id: null,
          message: 'Nouvelle tentative programmée.',
          payload_sha256: null,
          occurred_at: '2026-09-04T12:00:00.000Z',
          recorded_at: '2026-09-04T12:00:00.000Z',
        },
      ],
    };

    render(<TransmissionStatusView timeline={timeline} />);
    expect(screen.getAllByText('Échec technique')).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent('La plateforme ne répond pas.');
    expect(screen.getByText('Nouvelle tentative programmée.')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
