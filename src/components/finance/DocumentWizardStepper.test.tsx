import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentWizardStepper } from './DocumentWizardStepper';

const steps = [
  { label: 'Client', description: 'Choisissez le client.' },
  { label: 'Prestations', description: 'Ajoutez les prestations.' },
  { label: 'Conditions', description: 'Vérifiez les conditions.' },
  { label: 'Validation', description: 'Contrôlez le document.' },
] as const;

describe('DocumentWizardStepper', () => {
  it('annonce l’étape active et permet d’accéder directement à une autre étape', () => {
    const onStepChange = vi.fn();
    render(
      <DocumentWizardStepper
        steps={steps}
        currentStep={1}
        onStepChange={onStepChange}
        label="Création du devis"
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Création du devis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Étape 2 sur 4 : Prestations/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText(/Ajoutez les prestations\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Étape 4 sur 4 : Validation/ }));
    expect(onStepChange).toHaveBeenCalledWith(3);
  });
});
