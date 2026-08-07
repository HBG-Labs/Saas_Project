import { expect, test } from '@playwright/test';

/**
 * Test d'intégration End-to-End du parcours utilisateur complet :
 *
 * 1. Utilisateur arrive (Landing page)
 * 2. Création de compte (Formulaire d'inscription)
 * 3. Connexion (Formulaire de connexion)
 * 4. Arrivée sur le Dashboard (Espace membre protégé)
 * 5. Ouverture d'un outil depuis le catalogue
 */
test.describe('Parcours utilisateur complet', () => {
  test.beforeEach(async ({ page }) => {
    // Interception et mock déterministe des requêtes d'authentification Supabase
    await page.route('**/auth/v1/signup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id-123',
            email: 'technicien@exemple.fr',
            user_metadata: { display_name: 'Alex Technicien' },
          },
          session: null,
        }),
      });
    });

    await page.route('**/auth/v1/token*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-access-token-xyz',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'fake-refresh-token-xyz',
          user: {
            id: 'test-user-id-123',
            email: 'technicien@exemple.fr',
            user_metadata: { display_name: 'Alex Technicien' },
          },
        }),
      });
    });

    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id-123',
          display_name: 'Alex Technicien',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });
  });

  test('Parcours complet : Arrivée → Inscription → Connexion → Dashboard → Catalogue/Outils', async ({
    page,
  }) => {
    // ------------------------------------------------------------- 1. Arrivée (Landing Page)
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /nexoratech/i })).toBeVisible();

    // Clic vers la page d'inscription depuis l'en-tête ou le CTA Hero
    const registerLink = page.getByRole('link', { name: /créer un compte|commencer/i }).first();
    await expect(registerLink).toBeVisible();
    await registerLink.click();

    // ------------------------------------------------------------- 2. Création de compte (Register)
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: /créer un compte/i })).toBeVisible();

    // Saisie des informations du formulaire d'inscription
    await page.getByLabel(/nom affiché/i).fill('Alex Technicien');
    await page.getByLabel(/adresse e-mail/i).fill('technicien@exemple.fr');
    await page.getByLabel(/^mot de passe/i).fill('Password123!');
    await page.getByLabel(/confirmer le mot de passe/i).fill('Password123!');

    // Soumission de l'inscription
    await page.getByRole('button', { name: /créer mon compte/i }).click();

    // Redirection vers le message de confirmation ou la page de connexion
    await expect(
      page.getByText(/vérifiez vos e-mails|aller à la connexion|se connecter/i).first(),
    ).toBeVisible();

    // Naviguer vers la page de connexion
    await page.goto('/login');

    // ------------------------------------------------------------- 3. Connexion (Login)
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible();

    await page.getByLabel(/adresse e-mail/i).fill('technicien@exemple.fr');
    await page.getByLabel(/^mot de passe/i).fill('Password123!');

    await page.getByRole('button', { name: /se connecter/i }).click();

    // ------------------------------------------------------------- 4. Redirection vers Dashboard
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /tableau de bord/i })).toBeVisible();

    // ------------------------------------------------------------- 5. Navigation & Ouverture d'un outil
    const toolsNavLink = page.getByRole('link', { name: /outils/i }).first();
    await toolsNavLink.click();

    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.getByRole('heading', { name: /outils/i })).toBeVisible();
  });
});
