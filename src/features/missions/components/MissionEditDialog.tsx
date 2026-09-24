import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormError } from '@/components/feedback/FormError';
import { UnsavedFormModal } from '@/components/feedback/UnsavedFormModal';
import { Button } from '@/components/ui/Button';
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
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [priority, setPriority] = useState<MissionPriority>(mission.priority);
  const [customerId, setCustomerId] = useState<string | null>(mission.customer_id);
  const [siteId, setSiteId] = useState<string | null>(mission.site_id);
  const initialCoords =
    mission.latitude != null && mission.longitude != null
      ? { latitude: mission.latitude, longitude: mission.longitude }
      : null;
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialCoords,
  );
  const [savedControls, setSavedControls] = useState({
    priority: mission.priority,
    customerId: mission.customer_id,
    siteId: mission.site_id,
    coords: initialCoords,
  });

  const updateMission = useUpdateMission(mission.id);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
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
        location_label: locationLabel === undefined || locationLabel === '' ? null : locationLabel,
        scheduled_start: toIsoOrUndefined(values.scheduledStart) ?? null,
        scheduled_end: toIsoOrUndefined(values.scheduledEnd) ?? null,
        customer_id: customerId,
        site_id: siteId,
        latitude: finalLat,
        longitude: finalLng,
      });

      const nextCoords =
        finalLat != null && finalLng != null ? { latitude: finalLat, longitude: finalLng } : null;
      reset(values);
      setCoords(nextCoords);
      setSavedControls({ priority, customerId, siteId, coords: nextCoords });
      setOpen(false);
    } catch (error) {
      setSubmitError(error);
    }
  });

  const controlsDirty =
    priority !== savedControls.priority ||
    customerId !== savedControls.customerId ||
    siteId !== savedControls.siteId ||
    coords?.latitude !== savedControls.coords?.latitude ||
    coords?.longitude !== savedControls.coords?.longitude;

  return (
    <UnsavedFormModal
      presentation="drawer"
      dirty={isDirty || controlsDirty}
      onDiscard={() => {
        reset();
        setPriority(savedControls.priority);
        setCustomerId(savedControls.customerId);
        setSiteId(savedControls.siteId);
        setCoords(savedControls.coords);
        setSubmitError(null);
      }}
      renderFooter={(requestClose) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={requestClose}>
            Annuler
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      )}
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
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
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
          onLocationSelect={(loc) =>
            setCoords({ latitude: loc.latitude, longitude: loc.longitude })
          }
        />
      </form>
    </UnsavedFormModal>
  );
}
