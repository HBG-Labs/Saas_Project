import { expect, test } from '@playwright/test';

import { MEMBRE_ID, ORGANISATION_ID, UTILISATEUR_ID, type DonneesTest } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

const ROUTES = [
  '/dashboard',
  '/missions',
  '/missions/nouvelle',
  '/planning',
  '/carte',
  '/clients',
  '/analytics',
  '/controle',
  '/dossiers-clos',
  '/stock',
  '/stock/mouvements',
  '/equipements',
  '/equipes',
  '/organisation/membres',
  '/vehicules',
  '/organisation',
  '/organisation/facturation-electronique',
  '/organisation/portail-client',
  '/organisation/facturation',
  '/journal',
  '/devis',
  '/devis/historique',
  '/factures',
  '/factures/recues',
  '/achats/commandes',
  '/achats/fournisseurs',
  '/workspace/pages',
  '/bloc-notes',
  '/bibliotheque',
  '/tutoriels',
  '/assistant-ia',
  '/assistant-ia/documents',
  '/tools',
  '/tools?tab=favorites',
  '/favorites',
  '/references',
  '/metiers',
  '/metiers/btp',
  '/metiers/plomberie',
  '/metiers/electricite',
  '/metiers/espaces-verts',
  '/metiers/fibre-optique',
  '/metiers/reseaux',
  '/profile',
  '/settings',
  '/history',
  '/comptes-rendus',
  '/achats',
] as const;

test.describe('Finalisation Atelier', () => {
  test.setTimeout(300_000);

  test('les écrans principaux restent stables, nommés et tactiles', async ({ page, isMobile }) => {
    await page.setViewportSize(
      isMobile ? { width: 360, height: 800 } : { width: 1280, height: 900 },
    );
    await installeSupabase(page, {
      role: 'owner',
      rpc: {
        ensure_personal_workspace_space: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          organization_id: ORGANISATION_ID,
          name: 'Mon espace',
          description: null,
          icon: null,
          position: 0,
          created_by: UTILISATEUR_ID,
          owner_member_id: MEMBRE_ID,
          archived_at: null,
          created_at: '2026-09-19T08:00:00.000Z',
          updated_at: '2026-09-19T08:00:00.000Z',
        },
      },
      // La table n'est pas encore dans le type du jeu générique, mais cette
      // ligne évite le 406 normal de `maybeSingle()` dans la console auditée.
      donnees: {
        subscriptions: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            organization_id: ORGANISATION_ID,
            user_id: null,
            plan_code: 'enterprise',
            status: 'active',
            current_period_start: '2026-09-19T08:00:00.000Z',
            current_period_end: '2027-09-19T08:00:00.000Z',
            trial_ends_at: null,
            canceled_at: null,
            cancel_at_period_end: false,
            provider: null,
            provider_customer_id: null,
            provider_subscription_id: null,
            created_at: '2026-09-19T08:00:00.000Z',
            updated_at: '2026-09-19T08:00:00.000Z',
          },
          {
            id: '99999999-9999-4999-8999-999999999999',
            organization_id: null,
            user_id: UTILISATEUR_ID,
            plan_code: 'enterprise',
            status: 'active',
            current_period_start: '2026-09-19T08:00:00.000Z',
            current_period_end: '2027-09-19T08:00:00.000Z',
            trial_ends_at: null,
            canceled_at: null,
            cancel_at_period_end: false,
            provider: null,
            provider_customer_id: null,
            provider_subscription_id: null,
            created_at: '2026-09-19T08:00:00.000Z',
            updated_at: '2026-09-19T08:00:00.000Z',
          },
        ],
        profile_details: [
          {
            user_id: UTILISATEUR_ID,
            phone: null,
            zone: null,
            certifications: [],
            equipments: [],
            created_at: '2026-09-19T08:00:00.000Z',
            updated_at: '2026-09-19T08:00:00.000Z',
          },
        ],
      } as unknown as Partial<DonneesTest>,
    });

    let currentRoute = '';
    const runtimeErrors: string[] = [];
    const interfaceErrors: string[] = [];
    page.on('pageerror', (error) => {
      runtimeErrors.push(`${currentRoute}: ${error.message}`);
    });
    page.on('console', (message) => {
      // Le faux domaine n'a volontairement aucun serveur Realtime. Le client
      // tente son WebSocket, qui échoue au DNS sans affecter l'interface.
      if (
        message.type() === 'error' &&
        !message.text().includes('wss://test-project.supabase.co')
      ) {
        runtimeErrors.push(`${currentRoute}: ${message.text()}`);
      }
    });

    for (const route of ROUTES) {
      currentRoute = route;
      await page.goto(route);
      const main = page.locator('main');
      await expect(main, `${route} doit conserver son repère principal`).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      });

      const audit = await main.evaluate((root, mobile) => {
        const visible = (element: Element) => {
          if (element.closest('[aria-hidden="true"]')) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            style.clipPath !== 'inset(50%)'
          );
        };
        const descriptor = (element: Element) => {
          const html = element as HTMLElement;
          return `${element.tagName.toLowerCase()} « ${(html.innerText || element.getAttribute('aria-label') || '').trim().slice(0, 40)} »`;
        };

        const unnamed: string[] = [];
        for (const element of root.querySelectorAll('button, a[href], [role="button"]')) {
          if (!visible(element)) continue;
          const labelledBy = element.getAttribute('aria-labelledby');
          const labelledText = labelledBy
            ? labelledBy
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent ?? '')
                .join(' ')
            : '';
          const name =
            element.getAttribute('aria-label') ||
            labelledText ||
            (element.id
              ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent
              : '') ||
            element.getAttribute('title') ||
            element.textContent ||
            element.querySelector('img')?.getAttribute('alt') ||
            '';
          if (name.trim() === '') unnamed.push(descriptor(element));
        }

        for (const element of root.querySelectorAll('input, select, textarea')) {
          if (!visible(element)) continue;
          const field = element as HTMLInputElement;
          const named =
            field.labels?.length ||
            field.getAttribute('aria-label') ||
            field.getAttribute('aria-labelledby') ||
            field.getAttribute('title');
          if (!named) unnamed.push(descriptor(element));
        }

        const smallTargets: string[] = [];
        if (mobile) {
          for (const element of root.querySelectorAll(
            'button, [role="button"], input:not([type="checkbox"]):not([type="radio"]), select, textarea',
          )) {
            if (!visible(element)) continue;
            const rect = element.getBoundingClientRect();
            const after = getComputedStyle(element, '::after');
            const inset = (value: string) => Math.max(0, -(Number.parseFloat(value) || 0));
            const targetWidth = rect.width + inset(after.left) + inset(after.right);
            const targetHeight = rect.height + inset(after.top) + inset(after.bottom);
            if (Math.min(targetWidth, targetHeight) < 44) {
              smallTargets.push(
                `${descriptor(element)} ${Math.round(rect.width)}×${Math.round(rect.height)}`,
              );
            }
          }
        }

        const clippedContent: string[] = [];
        for (const control of root.querySelectorAll('button, a[href], [role="button"]')) {
          if (!visible(control)) continue;
          const bounds = control.getBoundingClientRect();
          const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
          let textNode = walker.nextNode();
          let clipped = false;

          while (textNode && !clipped) {
            const parent = textNode.parentElement;
            const text = textNode.textContent?.trim() ?? '';
            const parentStyle = parent ? getComputedStyle(parent) : null;
            const parentBounds = parent?.getBoundingClientRect();
            const visuallyHidden =
              parentStyle !== null &&
              parentBounds !== undefined &&
              ((parentStyle.position === 'absolute' &&
                parentStyle.overflow === 'hidden' &&
                parentBounds.width <= 1 &&
                parentBounds.height <= 1) ||
                parentStyle.clipPath.includes('inset(50%') ||
                parentStyle.clip.includes('rect(0'));
            if (
              text !== '' &&
              parent !== null &&
              !visuallyHidden &&
              !parent.closest('.sr-only') &&
              !parent.closest('.truncate') &&
              !parent.closest('[class*="line-clamp-"]') &&
              !parent.closest('[aria-hidden="true"]')
            ) {
              const range = document.createRange();
              range.selectNodeContents(textNode);
              for (const rect of range.getClientRects()) {
                if (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  (rect.top < bounds.top - 1 ||
                    rect.right > bounds.right + 1 ||
                    rect.bottom > bounds.bottom + 1 ||
                    rect.left < bounds.left - 1)
                ) {
                  clippedContent.push(descriptor(control));
                  clipped = true;
                  break;
                }
              }
            }
            textNode = walker.nextNode();
          }
        }

        const brokenAriaReferences: string[] = [];
        for (const element of root.querySelectorAll(
          '[aria-labelledby], [aria-describedby], [aria-errormessage]',
        )) {
          for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-errormessage']) {
            const references = element.getAttribute(attribute)?.trim().split(/\s+/) ?? [];
            for (const reference of references) {
              if (reference && !document.getElementById(reference)) {
                brokenAriaReferences.push(`${descriptor(element)} → ${attribute}="${reference}"`);
              }
            }
          }
        }

        const duplicateIds = [...document.querySelectorAll<HTMLElement>('[id]')]
          .map((element) => element.id)
          .filter((id, index, ids) => id !== '' && ids.indexOf(id) !== index)
          .filter((id, index, ids) => ids.indexOf(id) === index);

        const hiddenFocusable: string[] = [];
        for (const hiddenRoot of document.querySelectorAll('[aria-hidden="true"]')) {
          const candidates = hiddenRoot.matches(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          )
            ? [hiddenRoot]
            : [];
          candidates.push(
            ...hiddenRoot.querySelectorAll(
              'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          );
          for (const candidate of candidates) {
            if (visible(candidate) && !(candidate as HTMLButtonElement).disabled) {
              hiddenFocusable.push(descriptor(candidate));
            }
          }
        }

        const keyboardInaccessible: string[] = [];
        for (const element of root.querySelectorAll(
          '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"]',
        )) {
          if (!visible(element)) continue;
          const nativeInteractive = element.matches(
            'a[href], button, input, select, textarea, summary',
          );
          if (!nativeInteractive && (element as HTMLElement).tabIndex < 0) {
            keyboardInaccessible.push(descriptor(element));
          }
        }

        return {
          unnamed: unnamed.slice(0, 8),
          smallTargets: smallTargets.slice(0, 8),
          clippedContent: clippedContent.slice(0, 8),
          brokenAriaReferences: brokenAriaReferences.slice(0, 8),
          duplicateIds: duplicateIds.slice(0, 8),
          hiddenFocusable: hiddenFocusable.slice(0, 8),
          keyboardInaccessible: keyboardInaccessible.slice(0, 8),
          h1Count: [...root.querySelectorAll('h1')].filter(visible).length,
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      }, isMobile);

      if (audit.scrollWidth - audit.viewportWidth > 1) {
        interfaceErrors.push(
          `${route}: débordement horizontal de ${audit.scrollWidth - audit.viewportWidth}px`,
        );
      }
      for (const item of audit.unnamed) {
        interfaceErrors.push(`${route}: commande sans nom accessible — ${item}`);
      }
      for (const item of audit.smallTargets) {
        interfaceErrors.push(`${route}: commande tactile trop petite — ${item}`);
      }
      for (const item of audit.clippedContent) {
        interfaceErrors.push(`${route}: texte hors de sa commande — ${item}`);
      }
      for (const item of audit.brokenAriaReferences) {
        interfaceErrors.push(`${route}: référence ARIA absente — ${item}`);
      }
      for (const item of audit.duplicateIds) {
        interfaceErrors.push(`${route}: identifiant HTML dupliqué — #${item}`);
      }
      for (const item of audit.hiddenFocusable) {
        interfaceErrors.push(
          `${route}: commande focalisable masquée aux aides techniques — ${item}`,
        );
      }
      for (const item of audit.keyboardInaccessible) {
        interfaceErrors.push(`${route}: commande inaccessible au clavier — ${item}`);
      }
      if (audit.h1Count !== 1) {
        interfaceErrors.push(`${route}: ${String(audit.h1Count)} titre h1 visible (attendu : 1)`);
      }
    }

    if (isMobile) {
      currentRoute = 'menu mobile';
      await page.goto('/missions');
      await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
      const navigation = page
        .getByRole('navigation', { name: 'Navigation principale' })
        .filter({ visible: true });
      await expect(navigation).toBeVisible();

      const auditMenu = async (label: string) => {
        const issues = await navigation.evaluate((root) => {
          const visible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden'
            );
          };
          const clipped: string[] = [];

          for (const control of root.querySelectorAll('button, a[href], [role="radio"]')) {
            if (!visible(control)) continue;
            const bounds = control.getBoundingClientRect();
            const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
            let textNode = walker.nextNode();

            while (textNode) {
              const parent = textNode.parentElement;
              if (
                textNode.textContent?.trim() &&
                parent &&
                !parent.closest('.sr-only, .truncate, [class*="line-clamp-"], [aria-hidden="true"]')
              ) {
                const range = document.createRange();
                range.selectNodeContents(textNode);
                const outside = [...range.getClientRects()].some(
                  (rect) =>
                    rect.top < bounds.top - 1 ||
                    rect.right > bounds.right + 1 ||
                    rect.bottom > bounds.bottom + 1 ||
                    rect.left < bounds.left - 1,
                );
                if (outside) {
                  clipped.push(
                    `${control.tagName.toLowerCase()} « ${(control.textContent ?? '').trim().slice(0, 50)} »`,
                  );
                  break;
                }
              }
              textNode = walker.nextNode();
            }
          }

          return {
            clipped,
            overflow: root.scrollWidth - root.clientWidth,
          };
        });

        if (issues.overflow > 1) {
          interfaceErrors.push(`menu ${label}: débordement horizontal de ${issues.overflow}px`);
        }
        for (const item of issues.clipped) {
          interfaceErrors.push(`menu ${label}: texte hors de sa commande — ${item}`);
        }
      };

      const universes = navigation.getByRole('radiogroup', { name: 'Univers' });
      for (const universe of ['Gestion', 'Finance', 'Workspace']) {
        const radio = universes.getByRole('radio', { name: universe, exact: true });
        await radio.click();
        await expect(radio).toBeChecked();
        await auditMenu(universe);

        const sections = navigation.locator('button[aria-expanded]');
        const sectionCount = await sections.count();
        for (let index = 0; index < sectionCount; index += 1) {
          const section = sections.nth(index);
          if (!(await section.isVisible())) continue;
          if ((await section.getAttribute('aria-expanded')) === 'false') await section.click();
          await auditMenu(`${universe}, section ${index + 1}`);
        }
      }
    }

    expect(interfaceErrors, "l'audit visuel de toutes les routes doit rester propre").toEqual([]);
    expect(
      runtimeErrors,
      'la navigation globale ne doit produire aucune erreur navigateur',
    ).toEqual([]);
  });
});
