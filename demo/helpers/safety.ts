import { expect, type Page, type Request, type Route } from '@playwright/test';

import type { DemoEnvironment } from './env';

const READ_ONLY_RPCS = new Set([
  'get_creditable_invoice_lines',
  'intervention_worked_seconds',
  'organization_activity_stats',
  'organization_billing_summary',
  'organization_plan_code',
  'portal_list_documents',
  'portal_list_invoices',
  'portal_list_missions',
  'portal_list_quotes',
  'portal_mission_detail',
  'portal_my_context',
  'portal_quote_detail',
  'preview_leave_days',
]);

export interface SafetyMonitor {
  assertClean(): void;
}

function rpcName(pathname: string): string | null {
  const marker = '/rest/v1/rpc/';
  const index = pathname.indexOf(marker);
  return index === -1 ? null : (pathname.slice(index + marker.length).split('/')[0] ?? null);
}

function describe(request: Request): string {
  const url = new URL(request.url());
  return `${request.method()} ${url.origin}${url.pathname}`;
}

export async function installSafetyBarrier(
  page: Page,
  env: DemoEnvironment,
  options: { allowPasswordLogin: boolean },
): Promise<SafetyMonitor> {
  const violations: string[] = [];
  const localOrigin = new URL(env.baseUrl).origin;
  const supabaseOrigin = new URL(env.supabaseUrl).origin;

  page.on('pageerror', (error) => {
    violations.push(`Erreur de page : ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') violations.push(`Console : ${message.text()}`);
  });

  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (url.origin === localOrigin) {
      await route.continue();
      return;
    }

    if (url.origin !== supabaseOrigin) {
      violations.push(`Hôte externe bloqué : ${describe(request)}`);
      await route.abort('blockedbyclient');
      return;
    }

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await route.continue();
      return;
    }

    if (
      options.allowPasswordLogin &&
      method === 'POST' &&
      url.pathname === '/auth/v1/token' &&
      url.searchParams.get('grant_type') === 'password'
    ) {
      await route.continue();
      return;
    }

    const rpc = rpcName(url.pathname);
    if (method === 'POST' && rpc === 'portal_touch_last_seen') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (method === 'POST' && rpc !== null && READ_ONLY_RPCS.has(rpc)) {
      await route.continue();
      return;
    }
    if (
      method === 'POST' &&
      url.pathname.startsWith('/storage/v1/object/sign/intervention-attachments/')
    ) {
      await route.continue();
      return;
    }

    violations.push(`Écriture réseau bloquée : ${describe(request)}`);
    await route.abort('blockedbyclient');
  });

  return {
    assertClean() {
      expect(violations, violations.join('\n')).toEqual([]);
    },
  };
}
