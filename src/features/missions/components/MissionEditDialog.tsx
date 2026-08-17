import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { forwardGeocode } from '@/features/geo';
import type { MissionPriority } from '@/types/database';
import type { MissionWithRelations } from '@/types/domain';

import { useUpdateMission } from '../hooks/useMissions';
import {
  missionSchema,
  toDateTimeLocal,
  toIsoOrUndefined,
  type MissionValues,
} from '../schemas/mission.schema';

import { MissionFormFields } from './MissionFormFields';

export interface MissionEditDialogProps {
  mission: MissionWithRelations;
  organizationId: string | null;
}

export function MissionEditDialog({ mission, organizationId }: MissionEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [priority, setPriority] = useState<MissionPriority>(mission.priority);
  const [customerId, setCustomerId] = useState<string | null>(mission.customer_id);
  const [siteId, setSiteId] = useState<string | null>(mission.site_id);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    mission.latitude != null && mission.longitude != null
      ? { latitude: mission.latitude, longitude: mission.longitude }
      : null,
  );

  const updateMission = useUpdateMission(mission.id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MissionValues>({
    resolver: zodResolver(missionSchema),
    defaultValues: {
      title: mission.title,
      description: mission.description ?? '',
      priority: mission.priority,
      // Les horodatages sont ramenés au format du champ HTML : un ISO complet
      // le laisserait vide, sans erreur, et l'édition perdrait les dates.
      scheduledStart: toDateTimeLocal(mission.scheduled_start),
      scheduledEnd: toDateTimeLocal(mission.scheduled_end),
      locationLabel: mission.location_label ?? '',
      notes: mission.notes ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const description = values.description?.trim();
      const notes = values.notes?.trim();
      const locationLabel = values.locationLabel?.trim();

      let finalLat = coords?.latitude ?? null;
      let finalLng = coords?.longitude ?? null;

      if (finalLat === null && locationLabel && locationLabel.length > 3) {
        try {
          const matches = await forwardGeocode(locationLabel);
          if (matches.length > 0 && matches[0]) {
            finalLat = matches[0].latitude;
            finalLng = matches[0].longitude;
          }
        } catch {
          // ignore
        }
      }

      await updateMission.mutateAsync({
        title: values.title,
        priority,
        // `null` et non `undefined` : en édition, vider un champ doit l'effacer
        // en base, alors qu'`undefined` le laisserait inchangé.
        description: description === undefined || description === '' ? null : description,
        notes: notes === undefined || notes === '' ? null : notes,
        location_label:
          locationLabel === undefined || locationLabel === '' ? null : locationLabel,
        scheduled_start: toIsoOrUndefined(values.scheduledStart) ?? null,
        scheduled_end: toIsoOrUndefined(values.scheduledEnd) ?? null,
        customer_id: customerId,
        site_id: siteId,
        latitude: finalLat,
        longitude: finalLng,
      });

      setOpen(false);
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      size="lg"
      title="Modifier la mission"
      description="La référence et le statut ne se modifient pas ici — la première est figée, le second suit la machine à états."
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Modifier
        </Button>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError error={submitError} />

        <MissionFormFields
          register={register}
          errors={errors}
          organizationId={organizationId}
          setValue={setValue}
          watch={watch}
          priority={priority}
          onPriorityChange={setPriority}
          customerId={customerId}
          onCustomerChange={setCustomerId}
          siteId={siteId}
          onSiteChange={setSiteId}
          onLocationSelect={(loc) => setCoords({ latitude: loc.latitude, longitude: loc.longitude })}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
          >
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
