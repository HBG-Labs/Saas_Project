import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
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
  useDocumentTitle('Nouvelle mission');

  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const createMission = useCreateMission();

  const [submitError, setSubmitError] = useState<unknown>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [priority, setPriority] = useState<MissionPriority>('normal');
  const [assignedTeamId, setAssignedTeamId] = useState<string | null>(null);
  const [assignedMemberId, setAssignedMemberId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
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
      });

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
        title="Nouvelle mission"
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
