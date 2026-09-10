import { describe, expect, it } from 'vitest';

import { clearTenantQueryCache, createQueryClient } from './query-client';

describe('isolation du cache TanStack Query', () => {
  it('retire toutes les données privées lors d’un changement d’organisation', () => {
    const client = createQueryClient();
    client.setQueryData(['catalog', 'tools'], ['public']);
    client.setQueryData(['organizations', 'mine', 'user-a'], ['org-a', 'org-b']);
    client.setQueryData(['customers', 'org-a', 'list'], ['client-secret']);
    client.setQueryData(['invoices', 'detail', 'invoice-a'], { total: 100 });

    clearTenantQueryCache(client);

    expect(client.getQueryData(['catalog', 'tools'])).toEqual(['public']);
    expect(client.getQueryData(['organizations', 'mine', 'user-a'])).toEqual(['org-a', 'org-b']);
    expect(client.getQueryData(['customers', 'org-a', 'list'])).toBeUndefined();
    expect(client.getQueryData(['invoices', 'detail', 'invoice-a'])).toBeUndefined();
  });
});
