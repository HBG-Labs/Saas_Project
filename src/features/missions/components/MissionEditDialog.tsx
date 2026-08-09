import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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

/**
 * Correction d'une mission après création.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RÉSERVÉ À QUI DÉTIENT `mission.update`
 *
 * Le trigger `enforce_mission_assignee_scope` interdit à l'intervenant de
 * toucher à l'intitulé, au client, au site, à la planification, à l'affectation
 * et à la priorité — tout ce que ce formulaire modifie. Lui ouvrir la fenêtre
 * reviendrait à le laisser saisir dix champs pour se voir refuser à
 * l'enregistrement.
 *
 * L'appelant doit donc vérifier la permission AVANT de rendre ce composant.
 * Ce n'est pas une garantie de sécurité — le trigger l'est — mais une garantie
 * de ne pas faire perdre son temps.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function MissionEditDialog({ mission, organizationId }: MissionEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [priority, setPriority] = useState<MissionPriority>(mission.priority);
  const [customerId, setCustomerId] = useState<string | null>(mission.customer_id);
  const [siteId, setSiteId] = useState<string | null>(mission.site_id);

  const updateMission = useUpdateMission(mission.id);

  const {
    register,
    handleSubmit,
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
          priority={priority}
          onPriorityChange={setPriority}
          customerId={customerId}
          onCustomerChange={setCustomerId}
          siteId={siteId}
          onSiteChange={setSiteId}
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
