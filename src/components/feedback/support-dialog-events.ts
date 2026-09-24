export const OPEN_SUPPORT_EVENT = 'rezo360:open-support';

/** Ouvre le même centre d'aide depuis une navigation extérieure au dialogue Radix. */
export function openSupportDialog(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_SUPPORT_EVENT));
}
