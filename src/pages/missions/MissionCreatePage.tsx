import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { CustomerPicker, SitePicker } from '@/features/customers';
import {
  MISSION_PRIORITY_LABELS,
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
        description="La référence est attribuée automatiquement. La mission naît en brouillon : vous l’affecterez ensuite."
      />

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <FormError error={submitError} />

        <Card>
          <CardHeader>
            <CardTitle>Intervention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Intitulé"
              placeholder="Raccordement FTTH — armoire de rue"
              required
              {...(errors.title?.message ? { error: errors.title.message } : {})}
              {...register('title')}
            />

            <Textarea
              label="Description"
              rows={3}
              placeholder="Nature des travaux, matériel attendu, contraintes particulières."
              {...register('description')}
            />

            <Select
              options={Object.entries(MISSION_PRIORITY_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              value={priority}
              onValueChange={(value) => {
                setPriority(value as MissionPriority);
              }}
              label="Priorité"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lieu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/*
              Choisir un site suffit : le trigger en déduit le client et recopie
              l'adresse et les consignes d'accès sur la mission. Changer de client
              remet le site à zéro — un site appartient à un client, et la base
              refuse le couple incohérent.
            */}
            <CustomerPicker
              organizationId={organization?.id ?? null}
              value={customerId}
              onChange={(next) => {
                setCustomerId(next);
                setSiteId(null);
              }}
            />

            <SitePicker customerId={customerId} value={siteId} onChange={setSiteId} />

            <Input
              label="Précision de lieu"
              placeholder="Armoire PM 12, trottoir pair"
              hint="Complète l’adresse du site — laissez vide pour reprendre celle du site."
              {...register('locationLabel')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Début prévu"
                type="datetime-local"
                {...(errors.scheduledStart?.message
                  ? { error: errors.scheduledStart.message }
                  : {})}
                {...register('scheduledStart')}
              />
              <Input
                label="Fin prévue"
                type="datetime-local"
                {...(errors.scheduledEnd?.message ? { error: errors.scheduledEnd.message } : {})}
                {...register('scheduledEnd')}
              />
            </div>

            <Textarea label="Notes internes" rows={2} {...register('notes')} />
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
