import { Navigation } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { openNavigationApp, getNavigationUrl } from '../geolocation';
import type { NavigationDestination } from '../types';

interface NavigationButtonProps {
  destination: NavigationDestination;
  className?: string;
  variant?: 'outline' | 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

/**
 * Bouton pour ouvrir l'application de navigation du smartphone / système (Google Maps / Apple Maps / Waze).
 */
export function NavigationButton({
  destination,
  className,
  variant = 'outline',
  size = 'sm',
  label = '🧭 Itinéraire',
}: NavigationButtonProps) {
  const url = getNavigationUrl(destination);
  const isAvailable = url !== null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAvailable) {
      openNavigationApp(destination);
    }
  };

  if (!isAvailable) {
    return (
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled
        className={className}
        title="Renseignez une adresse ou des coordonnées GPS pour calculer l’itinéraire"
      >
        <Navigation className="size-3.5" aria-hidden="true" />
        <span>Itinéraire indisponible</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
      title="Ouvrir l’application GPS vers cette destination"
    >
      <Navigation className="size-3.5 text-primary" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}
