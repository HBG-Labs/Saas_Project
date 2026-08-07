import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compose des classes conditionnelles puis résout les conflits Tailwind.
 * `cn('p-2', 'p-4')` donne `p-4` — indispensable pour qu'une prop `className`
 * puisse surcharger le style par défaut d'un composant.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
