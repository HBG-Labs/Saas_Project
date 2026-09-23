import { expect, test, type Request } from '@playwright/test';

import { ORGANISATION_ID } from '../fixtures/donnees';

import {
  DATE,
  ESPACE_ID,
  installeWorkspace,
  MODELE_ID,
  PAGE_ID,
  pageDocument,
} from './workspace-atelier-support';

function postDataHas(request: Request, key: string, expected: unknown): boolean {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    key in body &&
    (body as Record<string, unknown>)[key] === expected
  );
}

test.describe('Workspace Atelier', () => {
  test('ouvre une page et conserve le contenu et la version attendue à la sauvegarde', async ({
    page,
    isMobile,
  }) => {
    await installeWorkspace(page);
    await page.goto('/workspace/pages/' + PAGE_ID);
    await expect(page.getByRole('textbox', { name: 'Titre', exact: true })).toHaveValue(
      pageDocument.title,
    );
    if (isMobile) {
      await expect(page.getByRole('complementary', { name: 'Espaces et pages' })).toBeHidden();
      await page.getByRole('button', { name: 'Espaces et pages', exact: true }).click();
      await expect(page.getByRole('complementary', { name: 'Espaces et pages' })).toBeVisible();
      await page.getByRole('button', { name: 'Espaces et pages', exact: true }).click();
    }
    const text = page.getByRole('textbox', { name: 'Contenu de la page', exact: true });
    await text.fill('Les mesures sont prêtes.');
    const request = page.waitForRequest(
      (r) => r.url().endsWith('/rpc/save_workspace_page') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).first().click();
    expect((await request).postDataJSON()).toMatchObject({
      p_page_id: PAGE_ID,
      p_expected_updated_at: DATE,
      p_title: pageDocument.title,
      p_content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Les mesures sont prêtes.' }] },
        ],
      },
    });
    await expect(page.getByRole('status').filter({ hasText: 'Enregistré.' })).toBeVisible();
    await expect(text).toHaveText('Les mesures sont prêtes.');
    const recorder = page.getByRole('region', { name: 'Enregistrement vocal', exact: true });
    await expect(
      recorder.getByRole('button', { name: 'Enregistrer une note vocale', exact: true }),
    ).toBeDisabled();
    await recorder.getByRole('checkbox').check();
    await expect(
      recorder.getByRole('button', { name: 'Enregistrer une note vocale', exact: true }),
    ).toBeEnabled();
  });

  test('la barre de mise en forme conserve la sélection sans dupliquer le texte', async ({
    page,
    isMobile,
  }) => {
    await installeWorkspace(page);
    await page.route('**/rest/v1/rpc/save_workspace_page', async (route) => {
      const body = route.request().postDataJSON() as {
        p_content: typeof pageDocument.content;
        p_title: string;
      };
      await route.fulfill({
        json: {
          ...pageDocument,
          title: body.p_title,
          content: body.p_content,
          updated_at: '2026-09-20T09:00:00.000Z',
        },
      });
    });
    await page.goto('/workspace/pages/' + PAGE_ID);

    const editor = page.locator('.workspace-rich-editor .ProseMirror');
    await expect(editor).toBeVisible();
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/rpc/save_workspace_page') &&
        response.request().method() === 'POST',
    );
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Texte unique');
    await saved;

    await expect
      .poll(
        async () =>
          (await editor.locator('p').allTextContents()).filter((text) => text === 'Texte unique')
            .length,
      )
      .toBe(1);

    const lastParagraph = editor.locator('p').last();
    await lastParagraph.evaluate((element) => {
      const editable = element.closest<HTMLElement>('[contenteditable="true"]');
      const selection = window.getSelection();
      if (!editable || !selection) throw new Error('Éditeur ou sélection indisponible.');
      editable.focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
    });

    const bold = page.getByRole('button', { name: 'Gras' });
    if (isMobile) await bold.tap();
    else await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await expect(lastParagraph.locator('strong')).toHaveText('Texte unique');

    const italic = page.getByRole('button', { name: 'Italique' });
    if (isMobile) await italic.tap();
    else await italic.click();
    await expect(italic).toHaveAttribute('aria-pressed', 'true');
    await expect(lastParagraph.locator('em')).toHaveText('Texte unique');
    await expect(editor).toContainText('Texte unique');
  });

  test('le choix de modèle reste utilisable et crée dans le bon espace', async ({
    page,
    isMobile,
  }) => {
    await installeWorkspace(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/workspace/pages');
    if (isMobile) await page.getByRole('button', { name: 'Espaces et pages', exact: true }).click();
    await page.getByRole('combobox', { name: 'Modèle', exact: true }).click();
    await page.getByRole('option', { name: 'Compte rendu de réunion', exact: true }).click();
    const request = page.waitForRequest((r) => r.url().endsWith('/rpc/create_page_from_template'));
    await page.getByRole('button', { name: 'Créer', exact: true }).click();
    expect((await request).postDataJSON()).toMatchObject({
      p_template_id: MODELE_ID,
      p_space_id: ESPACE_ID,
    });
    await expect(page).toHaveURL(new RegExp(PAGE_ID + '$'));
    await expect(page.getByRole('textbox', { name: 'Titre', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('les options de présentation, le partage et la corbeille répondent vraiment', async ({
    page,
    isMobile,
  }) => {
    await installeWorkspace(page);
    await page.goto('/workspace/pages/' + PAGE_ID);
    const refuseCookies = page.getByRole('button', { name: 'Tout refuser' });
    if (await refuseCookies.isVisible()) await refuseCookies.click();

    await expect(page.getByText(/Espace personnel/)).toBeVisible();

    await page.getByRole('button', { name: 'Options de la page' }).click();
    const styleRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/rest/v1/workspace_pages') &&
        request.method() === 'PATCH' &&
        postDataHas(request, 'font_family', 'serif'),
    );
    await page.getByRole('button', { name: /Sérif/ }).click();
    expect((await styleRequest).postDataJSON()).toMatchObject({ font_family: 'serif' });
    await expect(page.locator('.workspace-editor')).toHaveClass(/font-serif/);

    const spacingRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/rest/v1/workspace_pages') &&
        request.method() === 'PATCH' &&
        postDataHas(request, 'text_spacing', 'compact'),
    );
    const optionsPanel = page.locator('aside').filter({ hasText: 'Style de la page' });
    await optionsPanel.getByRole('button', { name: 'Compact', exact: true }).click();
    expect((await spacingRequest).postDataJSON()).toMatchObject({ text_spacing: 'compact' });
    await expect(page.locator('.workspace-rich-editor')).toHaveAttribute(
      'data-text-spacing',
      'compact',
    );

    await page.getByRole('button', { name: 'Personnaliser la page' }).click();
    const customizeDialog = page.getByRole('dialog', { name: 'Personnaliser la page' });
    const colorRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/rest/v1/workspace_pages') &&
        request.method() === 'PATCH' &&
        postDataHas(request, 'accent_color', 'amber'),
    );
    await customizeDialog.getByRole('button', { name: 'Couleur Ciel' }).click();
    expect((await colorRequest).postDataJSON()).toMatchObject({ accent_color: 'amber' });
    await expect(page.getByTestId('workspace-page-accent')).toHaveClass(/bg-signal-cyan/);
    await customizeDialog.getByRole('button', { name: 'Fermer' }).click();

    await page.getByRole('button', { name: 'Partager' }).click();
    const shareDialog = page.getByRole('dialog', { name: 'Partager cette page' });
    await expect(shareDialog).toContainText('Le lien ne peut être ouvert que par vous.');
    await expect(shareDialog.getByLabel('Lien de la page')).toHaveValue(page.url());
    await expect(shareDialog.getByRole('button', { name: 'Copier le lien' })).toBeVisible();
    await shareDialog.getByRole('button', { name: 'Fermer' }).click();

    await page.goto('/workspace/pages');
    if (isMobile) await page.getByRole('button', { name: 'Espaces et pages', exact: true }).click();
    await page.getByRole('button', { name: 'Corbeille', exact: false }).click();
    const trashDialog = page.getByRole('dialog', { name: 'Corbeille des pages' });
    await expect(trashDialog.getByText('Ancienne procédure')).toBeVisible();
    await expect(trashDialog.getByRole('button', { name: 'Restaurer' })).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    const emptyTrashRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/rest/v1/workspace_pages') && request.method() === 'DELETE',
    );
    await trashDialog.getByRole('button', { name: 'Vider la corbeille' }).click();
    const emptyTrashUrl = new URL((await emptyTrashRequest).url());
    expect(emptyTrashUrl.searchParams.get('organization_id')).toBe(`eq.${ORGANISATION_ID}`);
    expect(emptyTrashUrl.searchParams.get('archived_at')).toBe('not.is.null');
    await expect(trashDialog.getByText('La corbeille est vide.')).toBeVisible();
  });

  test('le bloc-notes conserve la frappe et sa sauvegarde après sélection mobile', async ({
    page,
    isMobile,
  }) => {
    await installeWorkspace(page);
    await page.goto('/bloc-notes');
    await page.getByRole('button', { name: /Réunion de préparation/ }).click();
    const editor = page.getByRole('textbox', { name: 'Contenu de la note' });
    await expect(editor).toBeVisible();
    if (isMobile)
      await expect(page.getByRole('textbox', { name: 'Rechercher une note' })).toBeHidden();
    const request = page.waitForRequest(
      (r) => r.url().includes('/rest/v1/notes') && r.method() === 'PATCH',
    );
    await editor.fill('Préparer le dossier de demain.');
    expect((await request).postDataJSON()).toMatchObject({
      content: 'Préparer le dossier de demain.',
    });
    await expect(editor).toHaveValue('Préparer le dossier de demain.');
    await expect(page.getByRole('status').filter({ hasText: 'Enregistré à' })).toBeVisible();
    const font = await editor.evaluate((e) => getComputedStyle(e).fontFamily);
    expect(font).toContain('Nunito');
  });

  test('la bibliothèque distingue un état vide d’un filtre et garde le dépôt de fichiers', async ({
    page,
  }) => {
    await installeWorkspace(page, { empty: true });
    await page.goto('/bibliotheque');
    await expect(page.locator('.atelier-illustration')).toBeVisible();
    await page.getByRole('textbox', { name: 'Rechercher', exact: true }).fill('introuvable');
    await expect(page.getByText('Aucun document ne correspond', { exact: true })).toBeVisible();
    await expect(page.locator('.atelier-illustration')).toHaveCount(0);
    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
    await expect(page.locator('.atelier-illustration')).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter des documents', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter des documents', exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choisir des fichiers' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('les chapitres restent navigables et leur progression est conservée', async ({ page }) => {
    await installeWorkspace(page);
    // La fixture générale renvoie les écritures sans les mémoriser. Ce faux
    // serveur local vérifie ici la relecture du chapitre réellement envoyé.
    let saved: { course_slug: string; completed_chapters: string[] }[] = [];
    await page.route(
      'https://test-project.supabase.co/rest/v1/training_progress?*',
      async (route) => {
        if (route.request().method() === 'POST') saved = [route.request().postDataJSON()];
        await route.fulfill({ json: saved });
      },
    );
    await page.goto('/tutoriels/bien-demarrer');
    const progress = page.getByRole('progressbar', { name: 'Progression dans le cours' });
    await expect(progress).toHaveAttribute('aria-valuenow', '0');
    const request = page.waitForRequest(
      (r) => r.url().includes('/rest/v1/training_progress') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Marquer comme terminé', exact: true }).first().click();
    expect((await request).postDataJSON()).toMatchObject({
      course_slug: 'bien-demarrer',
      completed_chapters: expect.arrayContaining([expect.any(String)]),
    });
    await expect(progress).not.toHaveAttribute('aria-valuenow', '0');
    await page.reload();
    await expect(progress).not.toHaveAttribute('aria-valuenow', '0');
    await expect(page.getByRole('button', { name: 'Chapitre terminé', exact: true })).toHaveCount(
      1,
    );
  });
});
