import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { listCategories } from '@/features/catalog';
import { isAppError } from '@/lib/errors';
import { qk } from '@/lib/query-keys';
import type { Team } from '@/types/domain';

import { useCreateTeam, useUpdateTeam } from '../hooks/useTeams';
import { slugifyTeamName, teamSchema, type TeamValues } from '../schemas/team.schema';

export interface TeamFormDialogProps {
  organizationId: string;
  /** Fourni : édition. Absent : création. */
  team?: Team;
  trigger: ReactNode;
}

/**
 * Création et édition d'une équipe.
 *
 * La catégorie rattache l'équipe à un domaine technique — fibre, électricité,
 * réseaux. Elle vient de `config/categories.ts`, source unique déjà partagée
 * avec le catalogue d'outils et le seed SQL.
 */
export function TeamFormDialog({ organizationId, team, trigger }: TeamFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [categoryId, setCategoryId] = useState(team?.category_id ?? '');

  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam(team?.id ?? '');
  const isEdit = team !== undefined;

  /**
   * `teams.category_id` référence `categories.id` — un UUID, pas le slug déclaré
   * dans `config/categories.ts`. Les options viennent donc de la base, pas de la
   * constante : envoyer un slug produirait une violation de clé étrangère.
   *
   * La table est publique et minuscule ; `staleTime` long pour ne pas la
   * recharger à chaque ouverture de la fenêtre.
   */
  const categories = useQuery({
    queryKey: qk.catalog.categories(),
    queryFn: listCategories,
    staleTime: 60 * 60_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: team?.name ?? '',
      slug: team?.slug ?? '',
      description: team?.description ?? '',
      color: team?.color ?? '',
      categoryId: team?.category_id ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const description = values.description?.trim();
    const color = values.color?.trim();

    try {
      if (isEdit) {
        await updateTeam.mutateAsync({
          name: values.name,
          slug: values.slug,
          // `null` et non `undefined` : vider un champ doit l'effacer en base.
          description: description === '' || description === undefined ? null : description,
          color: color === '' || color === undefined ? null : color,
          category_id: categoryId === '' ? null : categoryId,
        });
      } else {
        await createTeam.mutateAsync({
          organizationId,
          name: values.name,
          slug: values.slug,
          ...(description !== undefined && description !== '' ? { description } : {}),
          ...(color !== undefined && color !== '' ? { color } : {}),
          ...(categoryId !== '' ? { categoryId } : {}),
        });
        reset();
      }
      setOpen(false);
    } catch (error) {
      // `unique (organization_id, slug)` est la seule contrainte d'unicité
      // atteignable depuis ce formulaire. Rattacher l'erreur au champ évite de
      // faire chercher lequel est en cause.
      if (isAppError(error) && error.code === 'conflict') {
        setError('slug', { message: 'Une équipe porte déjà cet identifiant.' });
        return;
      }
      setSubmitError(error);
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEdit ? 'Modifier l’équipe' : 'Nouvelle équipe'}
      {...(isEdit
        ? {}
        : {
            description:
              'Une équipe regroupe des membres de l’entreprise pour recevoir des missions.',
          })}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError error={submitError} />

        <Input
          label="Nom de l’équipe"
          placeholder="Équipe fibre Nantes"
          required
          {...(errors.name?.message ? { error: errors.name.message } : {})}
          {...register('name', {
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              if (!slugEdited && !isEdit) {
                setValue('slug', slugifyTeamName(event.target.value), { shouldValidate: false });
              }
            },
          })}
        />

        <Input
          label="Identifiant"
          placeholder="equipe-fibre-nantes"
          hint="Unique au sein de l’entreprise."
          required
          {...(errors.slug?.message ? { error: errors.slug.message } : {})}
          {...register('slug', {
            onChange: () => {
              setSlugEdited(true);
            },
          })}
        />

        <Select
          options={(categories.data ?? []).map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          value={categoryId}
          onValueChange={setCategoryId}
          label="Domaine technique"
          placeholder="Aucun domaine"
          hint="Facultatif — sert à orienter l’affectation des missions."
        />

        <Textarea
          label="Description"
          rows={2}
          placeholder="Raccordements FTTH sur le secteur Loire-Atlantique"
          {...register('description')}
        />

        <Input
          label="Couleur"
          type="color"
          hint="Repère visuel dans le planning."
          {...(errors.color?.message ? { error: errors.color.message } : {})}
          {...register('color')}
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
            {isSubmitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer l’équipe'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
