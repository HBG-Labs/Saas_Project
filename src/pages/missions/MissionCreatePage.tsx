import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { useToast } from '@/components/feedback/toast-context';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { forwardGeocode } from '@/features/geo';
import { formatNewNoun, useLabel } from '@/features/industries';
import {
  MissionFormFields,
  missionSchema,
  toIsoOrUndefined,
  useCreateMission,
  type MissionValues,
} from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { MissionPriority } from '@/types/database';

export default function MissionCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const toast = useToast();
  const createMission = useCreateMission();
  const job = useLabel('job');
  const titleText = formatNewNoun(job);

  useDocumentTitle(titleText);

  const [submitError, setSubmitError] = useState<unknown>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [priority, setPriority] = useState<MissionPriority>('normal');
  const [assignedTeamId, setAssignedTeamId] = useState<string | null>(null);
  const [assignedMemberId, setAssignedMemberId] = useState<string | null>(null);
  const [interventionTypeId, setInterventionTypeId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MissionValues>({
    resolver: zodResolver(missionSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'normal',
      scheduledStart: '',
      scheduledEnd: '',
      locationLabel: '',
      notes: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (organization === null || user === null) return;

    setSubmitError(null);
    try {
      const description = values.description?.trim();
      const notes = values.notes?.trim();
      const locationLabel = values.locationLabel?.trim();
      const scheduledStart = toIsoOrUndefined(values.scheduledStart);
      const scheduledEnd = toIsoOrUndefined(values.scheduledEnd);

      let finalLat = coords?.latitude ?? null;
      let finalLng = coords?.longitude ?? null;

      // Si aucune coordonnée n'est saisie mais qu'une adresse / libellé de lieu est fourni, géocodage automatique
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

      const mission = await createMission.mutateAsync({
        organizationId: organization.id,
        createdBy: user.id,
        title: values.title,
        priority,
        ...(description !== undefined && description !== '' ? { description } : {}),
        ...(notes !== undefined && notes !== '' ? { notes } : {}),
        ...(locationLabel !== undefined && locationLabel !== '' ? { locationLabel } : {}),
        ...(scheduledStart !== undefined ? { scheduledStart } : {}),
        ...(scheduledEnd !== undefined ? { scheduledEnd } : {}),
        ...(customerId !== null ? { customerId } : {}),
        ...(siteId !== null ? { siteId } : {}),
        ...(assignedTeamId !== null ? { assignedTeamId } : {}),
        ...(assignedMemberId !== null ? { assignedUserId: assignedMemberId } : {}),
        ...(interventionTypeId !== null ? { interventionTypeId } : {}),
        ...(finalLat !== null ? { latitude: finalLat, longitude: finalLng } : {}),
      });

      /*
        Le toast est emis AVANT la navigation, et c'est tout l'interet : la
        page de creation disparait, donc un message affiche dessus ne serait
        jamais lu. La notification, elle, survit au changement de page et
        confirme la creation sur l'ecran d'arrivee -- ou l'on ne voyait
        jusqu'ici qu'une mission apparaitre sans savoir si l'enregistrement
        avait abouti.
      */
      toast.succes(`${job} créée`, mission.reference);
      await navigate(ROUTES.mission(mission.id));
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={ROUTES.missions}>
          <ArrowLeft className="size-4" />
          Missions
        </Link>
      </Button>

      <PageHeader
        title={titleText}
        description="Renseignez les détails de la mission et affectez directement une équipe ou un technicien responsable."
      />

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <FormError error={submitError} />

        <Card>
          <CardContent className="space-y-4 pt-6">
            <MissionFormFields
              register={register}
              errors={errors}
              organizationId={organization?.id ?? null}
              setValue={setValue}
              watch={watch}
              priority={priority}
              onPriorityChange={setPriority}
              customerId={customerId}
              onCustomerChange={setCustomerId}
              siteId={siteId}
              onSiteChange={setSiteId}
              assignedTeamId={assignedTeamId}
              onAssignedTeamChange={setAssignedTeamId}
              assignedMemberId={assignedMemberId}
              onAssignedMemberChange={setAssignedMemberId}
              interventionTypeId={interventionTypeId}
              onInterventionTypeChange={setInterventionTypeId}
              onLocationSelect={(loc) => setCoords({ latitude: loc.latitude, longitude: loc.longitude })}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link to={ROUTES.missions}>Annuler</Link>
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Création…' : 'Créer la mission'}
          </Button>
        </div>
      </form>
    </div>
  );
}
