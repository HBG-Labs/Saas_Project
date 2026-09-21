import { expect, test } from '@playwright/test';

import { ORGANISATION_ID, UTILISATEUR_ID, type DonneesTest } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

const ROUTES = [
  '/dashboard',
  '/missions',
  '/planning',
  '/clients',
  '/equipements',
  '/analytics',
  '/devis/historique',
  '/factures',
  '/achats/commandes',
  '/bloc-notes',
  '/bibliotheque',
  '/tutoriels',
  '/assistant-ia',
  '/metiers',
  '/profile',
  '/settings',
  '/organisation',
  '/organisation/facturation',
] as const;

test.describe('Finalisation Atelier', () => {
  test.setTimeout(180_000);

  test('les écrans principaux restent stables, nommés et tactiles', async ({ page, isMobile }) => {
    await page.setViewportSize(
      isMobile ? { width: 360, height: 800 } : { width: 1280, height: 900 },
    );
    await installeSupabase(page, {
      role: 'owner',
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
            field.getAttribute('title') ||
            field.getAttribute('placeholder');
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
            if (Math.min(targetWidth, targetHeight) < 40) {
              smallTargets.push(
                `${descriptor(element)} ${Math.round(rect.width)}×${Math.round(rect.height)}`,
              );
            }
          }
        }

        return {
          unnamed: unnamed.slice(0, 8),
          smallTargets: smallTargets.slice(0, 8),
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      }, isMobile);

      expect(
        audit.scrollWidth - audit.viewportWidth,
        `${route} ne doit pas déborder horizontalement`,
      ).toBeLessThanOrEqual(1);
      expect(audit.unnamed, `${route} contient des commandes sans nom accessible`).toEqual([]);
      expect(
        audit.smallTargets,
        `${route} contient des commandes trop petites pour un usage tactile`,
      ).toEqual([]);
    }

    expect(
      runtimeErrors,
      'la navigation globale ne doit produire aucune erreur navigateur',
    ).toEqual([]);
  });
});
