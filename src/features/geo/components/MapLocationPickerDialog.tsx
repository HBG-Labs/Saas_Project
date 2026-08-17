import { useState, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MapLocationPicker } from './MapLocationPicker';
import type { GeocodedAddress } from '../reverse-geocoding';

export interface MapLocationPickerDialogProps {
  initialLatitude?: number | null | undefined;
  initialLongitude?: number | null | undefined;
  initialAddress?: string | undefined;
  onSelectLocation: (location: GeocodedAddress) => void;
  trigger?: ReactNode | undefined;
  title?: string | undefined;
  description?: string | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

export function MapLocationPickerDialog({
  initialLatitude,
  initialLongitude,
  initialAddress = '',
  onSelectLocation,
  trigger,
  title = 'Sélectionner la position GPS sur la carte',
  description = 'Cliquez sur la carte ou déplacez le repère pour définir les coordonnées exactes du lieu.',
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: MapLocationPickerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  const handleSelect = (loc: GeocodedAddress) => {
    onSelectLocation(loc);
    setOpen(false);
  };

  const defaultTrigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-3xs h-7 px-2.5 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
      title="Ouvrir la carte pour pointer la position exacte"
    >
      <MapPin className="size-3 text-primary shrink-0" />
      <span>Pointer sur la carte GPS</span>
    </Button>
  );

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      size="lg"
      title={title}
      description={description}
      trigger={trigger ?? defaultTrigger}
    >
      <div className="pt-1">
        <MapLocationPicker
          initialLatitude={initialLatitude}
          initialLongitude={initialLongitude}
          initialAddress={initialAddress}
          onSelectLocation={handleSelect}
          onCancel={() => setOpen(false)}
        />
      </div>
    </Modal>
  );
}
