import { expect, type Locator, type Page } from '@playwright/test';

export const RECORDING_CONTEXT_OPTIONS = {
  viewport: { width: 1920, height: 1080 },
  screen: { width: 1920, height: 1080 },
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  colorScheme: 'light' as const,
  reducedMotion: 'no-preference' as const,
  serviceWorkers: 'block' as const,
};

// Les chargements réels du staging offrent déjà plusieurs secondes de lecture
// par écran. Les pauses éditoriales restent donc brèves afin que le film complet
// tienne dans la fenêtre commerciale de 60 à 90 secondes.
const SCENE_PAUSE_FACTOR = 0.03;

export async function installPresentationLayer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('rezo360-theme', 'light');
    localStorage.setItem('rezo360-theme-preset', 'default');
    localStorage.setItem('pref_sidebar_collapsed', 'false');
    localStorage.setItem('pref_compact_mode', 'false');
    localStorage.setItem(
      'rezo360_cookie_consent',
      JSON.stringify({ analytics: false, marketing: false, decidedAt: new Date().toISOString() }),
    );

    const mountCursor = () => {
      if (document.querySelector('[data-demo-cursor]')) return;
      const style = document.createElement('style');
      style.textContent = `
        [aria-label="Ouvrir le support et l'aide"],
        [aria-label="Fermer l'aide et le support"] { display: none !important; }
        * { caret-color: transparent !important; }
      `;
      document.head.append(style);

      const cursor = document.createElement('div');
      cursor.dataset.demoCursor = 'true';
      Object.assign(cursor.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '22px',
        height: '22px',
        border: '3px solid white',
        borderRadius: '9999px',
        background: '#2563eb',
        boxShadow: '0 2px 9px rgba(15, 23, 42, .38)',
        transform: 'translate(42px, 42px)',
        transition: 'width 120ms ease, height 120ms ease, background 120ms ease',
        pointerEvents: 'none',
        zIndex: '2147483647',
      });
      document.documentElement.append(cursor);

      window.addEventListener('mousemove', (event) => {
        cursor.style.transform = `translate(${event.clientX - 11}px, ${event.clientY - 11}px)`;
      });
      window.addEventListener('mousedown', () => {
        cursor.style.width = '16px';
        cursor.style.height = '16px';
        cursor.style.background = '#f59e0b';
      });
      window.addEventListener('mouseup', () => {
        cursor.style.width = '22px';
        cursor.style.height = '22px';
        cursor.style.background = '#2563eb';
      });
    };

    document.addEventListener('DOMContentLoaded', mountCursor, { once: true });
  });
}

export async function pause(page: Page, milliseconds: number): Promise<void> {
  await page.waitForTimeout(Math.max(25, Math.round(milliseconds * SCENE_PAUSE_FACTOR)));
}

export async function cinematicClick(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Impossible de déterminer la position de la cible du clic.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
  await page.waitForTimeout(100);
  await locator.click();
  await page.waitForTimeout(150);
}

export async function typeCinematically(locator: Locator, value: string): Promise<void> {
  await locator.fill('');
  await locator.pressSequentially(value, { delay: 75 });
}

export async function smoothScroll(page: Page, y: number, duration = 900): Promise<void> {
  await page.evaluate(
    ({ top, scrollDuration }) =>
      new Promise<void>((resolve) => {
        const start = window.scrollY;
        const distance = top - start;
        const startedAt = performance.now();
        const tick = (now: number) => {
          const elapsed = Math.min(1, (now - startedAt) / scrollDuration);
          const eased = 1 - Math.pow(1 - elapsed, 3);
          window.scrollTo(0, start + distance * eased);
          if (elapsed < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      }),
    { top: y, scrollDuration: duration },
  );
  await pause(page, 450);
}

export async function showSection(page: Page, heading: string | RegExp): Promise<void> {
  const sectionHeading = page.getByRole('heading', { name: heading }).first();
  await expect(sectionHeading).toBeVisible();
  await sectionHeading.scrollIntoViewIfNeeded();
  await pause(page, 450);
}
