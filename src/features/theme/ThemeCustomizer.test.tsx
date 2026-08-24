import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ThemeProvider } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import { CustomizerDrawer } from './CustomizerDrawer';

describe('ThemeToggle & CustomizerDrawer interaction', () => {
  it('opens CustomizerDrawer when clicking Personnaliser l’ambiance', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeToggle />
        <CustomizerDrawer />
      </ThemeProvider>,
    );

    // 1. Ouvrir le menu déroulant de thème
    const toggleBtn = screen.getByRole('button', { name: /changer de thème/i });
    await user.click(toggleBtn);

    // 2. Trouver l'option "Personnaliser l'ambiance"
    const customizeItem = await screen.findByText(/personnaliser l’ambiance/i);
    expect(customizeItem).toBeInTheDocument();

    // 3. Cliquer sur "Personnaliser l'ambiance"
    await user.click(customizeItem);

    // 4. Vérifier que le tiroir de personnalisation s'ouvre
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/ambiance & teintes du cockpit/i)).toBeInTheDocument();
    });
  });
});
