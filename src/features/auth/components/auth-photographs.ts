import { useEffect, useState } from 'react';

export const AUTH_PHOTOGRAPHS = [
  { id: 'login-technician', position: '55%' },
  { id: 'register-workshop', position: '48%' },
  { id: 'orchard-technician', position: '50%' },
  { id: 'workshop-electrician', position: '50%' },
  { id: 'courtyard-technician', position: '50%' },
] as const;

const STORAGE_KEY = 'rezo360:auth:last-photograph';
let lastPhotographInMemory: string | null = null;

export function selectAuthPhotograph(previous: string | null, random = Math.random) {
  const candidates = AUTH_PHOTOGRAPHS.filter((photo) => photo.id !== previous);
  return candidates[Math.floor(random() * candidates.length)]!;
}

function readPreviousPhotograph() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? lastPhotographInMemory;
  } catch {
    return lastPhotographInMemory;
  }
}

/** One choice per visit. Editing or submitting a form never changes its photo. */
export function useAuthPhotograph() {
  const [photograph] = useState(() => selectAuthPhotograph(readPreviousPhotograph()));

  useEffect(() => {
    lastPhotographInMemory = photograph.id;
    try {
      sessionStorage.setItem(STORAGE_KEY, photograph.id);
    } catch {
      // Restricted storage still permits rotation between routes in this tab.
    }
  }, [photograph]);

  return photograph;
}
