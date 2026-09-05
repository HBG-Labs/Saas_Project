import { useEffect } from 'react';

import { useCurrentOrganization } from '@/features/organizations';

import {
  captureClientError,
  normalizeClientError,
  setClientErrorOrganization,
} from '../api/client-errors.api';

/** Capture les erreurs asynchrones que les frontières React ne voient pas. */
export function ClientErrorMonitor() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  useEffect(() => {
    setClientErrorOrganization(organizationId);
    return () => setClientErrorOrganization(null);
  }, [organizationId]);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      void captureClientError(event.error ?? new Error(event.message), { kind: 'window' });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      void captureClientError(normalizeClientError(event.reason), { kind: 'promise' });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
