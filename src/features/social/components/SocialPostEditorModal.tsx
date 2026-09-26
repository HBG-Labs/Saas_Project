import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ZodError } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/SelectField';
import { Textarea } from '@/components/ui/Textarea';
import { definedProps } from '@/lib/defined-props';

import {
  SOCIAL_AUDIENCES,
  SOCIAL_OBJECTIVES,
  addDays,
  postAudience,
  postObjective,
  postPlannedFor,
  splitIsoDateTime,
  validateSocialPostForm,
  type SocialPostFormValues,
  type SocialPostSaveIntent,
  type SocialPostWithAssets,
  type SocialWeek,
} from '../weekly-planning';

import { InstagramPostPreview } from './InstagramPostPreview';

type Errors = Partial<Record<keyof SocialPostFormValues, string>>;

const FORM_FIELDS = new Set<keyof SocialPostFormValues>([
  'plannedDate',
  'plannedTime',
  'hook',
  'visualText',
  'caption',
  'cta',
  'objective',
  'audience',
]);

function formValuesFromPost(post: SocialPostWithAssets, week: SocialWeek): SocialPostFormValues {
  const fallbackDate = addDays(week.starts_on, post.slot_index - 1);
  const { date, time } = splitIsoDateTime(postPlannedFor(post), fallbackDate);

  return {
    plannedDate: date,
    plannedTime: time,
    hook: post.hook ?? '',
    visualText: post.visual_text ?? '',
    caption: post.caption ?? '',
    cta: post.cta ?? '',
    objective: postObjective(post, week),
    audience: postAudience(post, week),
  };
}

function errorsFromZod(error: ZodError<SocialPostFormValues>): Errors {
  const errors: Errors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && FORM_FIELDS.has(field as keyof SocialPostFormValues)) {
      errors[field as keyof SocialPostFormValues] = issue.message;
    }
  }
  return errors;
}

const EMPTY_ERRORS: Errors = {};

interface SocialPostEditorModalProps {
  post: SocialPostWithAssets | null;
  week: SocialWeek | null;
  canEditSchedule: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (
    post: SocialPostWithAssets,
    values: SocialPostFormValues,
    intent: SocialPostSaveIntent,
  ) => void;
}

interface SocialPostEditorFormProps extends Omit<SocialPostEditorModalProps, 'post' | 'week'> {
  post: SocialPostWithAssets;
  week: SocialWeek;
}

export function SocialPostEditorModal(props: SocialPostEditorModalProps) {
  if (!props.post || !props.week) return null;

  return (
    <SocialPostEditorForm
      key={props.post.id}
      post={props.post}
      week={props.week}
      canEditSchedule={props.canEditSchedule}
      isSaving={props.isSaving}
      onClose={props.onClose}
      onSave={props.onSave}
    />
  );
}

function SocialPostEditorForm({
  post,
  week,
  canEditSchedule,
  isSaving,
  onClose,
  onSave,
}: SocialPostEditorFormProps) {
  const [values, setValues] = useState<SocialPostFormValues>(() => formValuesFromPost(post, week));
  const [errors, setErrors] = useState<Errors>(EMPTY_ERRORS);

  const previewPost = useMemo<SocialPostWithAssets>(() => {
    return {
      ...post,
      hook: values.hook,
      visual_text: values.visualText,
      caption: values.caption,
      cta: values.cta,
      content: {
        ...(typeof post.content === 'object' &&
        post.content !== null &&
        !Array.isArray(post.content)
          ? post.content
          : {}),
        objective: values.objective,
        audience: values.audience,
      },
    };
  }, [post, values]);

  const update = (field: keyof SocialPostFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (intent: SocialPostSaveIntent) => {
    const parsed = validateSocialPostForm(values, intent);
    if (!parsed.success) {
      setErrors(errorsFromZod(parsed.error));
      return;
    }

    onSave(post, parsed.data, intent);
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Modifier la publication"
      description="Ajustez le brouillon image avant la validation hebdomadaire."
      size="2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="outline"
            isLoading={isSaving}
            loadingLabel="Enregistrement du brouillon"
            onClick={() => submit('draft')}
            leadingIcon={<Save />}
          >
            Enregistrer brouillon
          </Button>
          <Button
            isLoading={isSaving}
            loadingLabel="Passage en READY"
            onClick={() => submit('ready')}
            leadingIcon={<CheckCircle2 />}
          >
            Marquer READY
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              label="Date"
              value={values.plannedDate}
              onChange={(event) => update('plannedDate', event.target.value)}
              disabled={!canEditSchedule}
              {...definedProps({
                error: errors.plannedDate,
                hint: !canEditSchedule ? 'Réservé aux rôles de publication.' : undefined,
              })}
            />
            <Input
              type="time"
              label="Heure"
              value={values.plannedTime}
              onChange={(event) => update('plannedTime', event.target.value)}
              disabled={!canEditSchedule}
              {...definedProps({
                error: errors.plannedTime,
                hint: !canEditSchedule ? 'Réservé aux rôles de publication.' : undefined,
              })}
            />
          </div>

          {!canEditSchedule ? (
            <p className="text-muted-foreground flex gap-2 text-xs">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Les managers peuvent préparer le contenu. La programmation effective reste réservée
              aux propriétaires et administrateurs.
            </p>
          ) : null}

          <Input
            label="Hook"
            value={values.hook}
            onChange={(event) => update('hook', event.target.value)}
            placeholder="Vous gérez encore vos interventions comme ça ?"
            {...definedProps({ error: errors.hook })}
          />
          <Input
            label="Texte à afficher sur le visuel"
            value={values.visualText}
            onChange={(event) => update('visualText', event.target.value)}
            placeholder="Une semaine claire avant le premier appel."
            {...definedProps({ error: errors.visualText })}
          />
          <Textarea
            label="Légende Instagram"
            value={values.caption}
            onChange={(event) => update('caption', event.target.value)}
            rows={5}
            {...definedProps({ error: errors.caption })}
          />
          <Input
            label="CTA"
            value={values.cta}
            onChange={(event) => update('cta', event.target.value)}
            placeholder="Voir REZO360 en action"
            {...definedProps({ error: errors.cta })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Objectif"
              value={values.objective}
              onChange={(event) => update('objective', event.target.value)}
              {...definedProps({ error: errors.objective })}
            >
              {SOCIAL_OBJECTIVES.map((objective) => (
                <option key={objective} value={objective}>
                  {objective}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Audience"
              value={values.audience}
              onChange={(event) => update('audience', event.target.value)}
              {...definedProps({ error: errors.audience })}
            >
              {SOCIAL_AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {audience}
                </option>
              ))}
            </SelectField>
          </div>
        </form>

        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium uppercase">Preview</p>
          <InstagramPostPreview post={previewPost} week={week} />
        </div>
      </div>
    </Modal>
  );
}
