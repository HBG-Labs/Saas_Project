import { useState } from 'react';
import { Crosshair, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getCurrentPosition } from '../geolocation';
import { useUpdateMission } from '@/features/missions';
import type { GeoError } from '../types';

interface LocateMissionButtonProps {
  missionId: string;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  className?: string;
  variant?: 'outline' | 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Bouton pour capturer et enregistrer ponctuellement la position GPS d'un chantier.
 *
 * 1. Déclenche une seule demande GPS à l'instant du clic.
 * 2. Enregistre les coordonnées précises sur la fiche de la mission.
 * 3. Ne démarre aucun suivi en arrière-plan.
 */
export function LocateMissionButton({
  missionId,
  currentLatitude,
  currentLongitude,
  className,
  variant = 'outline',
  size = 'sm',
}: LocateMissionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [successAccuracy, setSuccessAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateMissionMutation = useUpdateMission(missionId);

  const handleLocate = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessAccuracy(null);

    try {
      const pos = await getCurrentPosition();
      await updateMissionMutation.mutateAsync({
        latitude: pos.latitude,
        longitude: pos.longitude,
      });

      setSuccessAccuracy(Math.round(pos.accuracy));
      setTimeout(() => setSuccessAccuracy(null), 5000);
    } catch (err) {
      const geoErr = err as GeoError;
      setError(geoErr.message || 'Erreur lors de la capture GPS.');
      setTimeout(() => setError(null), 6000);
    } finally {
      setIsLoading(false);
    }
  };

  const hasCoords = currentLatitude != null && currentLongitude != null;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant={successAccuracy !== null ? 'outline' : variant}
        size={size}
        onClick={handleLocate}
        disabled={isLoading}
        className={className}
        title="Capturer la position GPS exacte sur le terrain et l’associer à ce chantier"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            <span>Recherche signal GPS...</span>
          </>
        ) : successAccuracy !== null ? (
          <>
            <Check className="size-3.5 text-success" aria-hidden="true" />
            <span>Position GPS enregistrée (±{successAccuracy}m)</span>
          </>
        ) : (
          <>
            <Crosshair className="size-3.5 text-primary" aria-hidden="true" />
            <span>{hasCoords ? 'Actualiser le point GPS' : '📍 Localiser l’intervention'}</span>
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-1.5 text-3xs text-error font-medium">
          <AlertCircle className="size-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
