import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from './SettingsPage';

const permission = vi.hoisted(() => ({ canManageOrganization: true }));

vi.mock('@/features/organizations', () => ({
  PERMISSIONS: { organizationUpdate: 'organization.update' },
  usePermission: () => ({ can: () => permission.canManageOrganization }),
}));

vi.mock('@/features/settings', () => ({
  AppearanceSettingsTab: () => <p>Contenu apparence</p>,
  IntegrationsSettingsTab: () => <p>Contenu intégrations</p>,
  PlanningMapSettingsTab: () => <p>Contenu planning</p>,
  NotificationsSettingsTab: () => <p>Contenu notifications</p>,
  OrganizationBillingSettingsTab: () => <p>Contenu entreprise</p>,
  SecuritySettingsTab: () => <p>Contenu sécurité</p>,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    permission.canManageOrganization = true;
  });

  it('annonce la catégorie active et permet de changer de panneau', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(screen.getByRole('button', { name: 'Apparence & Cockpit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Contenu apparence')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Alertes & Notifications' }));

    expect(screen.getByRole('button', { name: 'Alertes & Notifications' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Contenu notifications')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Intégrations' }));

    expect(screen.getByRole('button', { name: 'Intégrations' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Contenu intégrations')).toBeInTheDocument();
  });

  it('masque les paramètres de l’entreprise sans permission', () => {
    permission.canManageOrganization = false;
    render(<SettingsPage />);

    expect(
      screen.queryByRole('button', { name: 'Entreprise & Facturation' }),
    ).not.toBeInTheDocument();
  });
});
