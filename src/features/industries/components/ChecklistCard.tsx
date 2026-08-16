import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ListChecks } from 'lucide-react';
import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Skeleton } from '@/components/ui/Skeleton';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/cn';

import {
  getChecklistResponse,
  getChecklistTemplate,
  saveChecklistResponse,
} from '../api/checklists.api';

/**
 * Les points de contrôle d'une intervention.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE CARTE PROMET, LE SERVEUR LE TIENT
 *
 * Un point obligatoire non coché empêche la transmission du compte rendu. La
 * règle vit dans `app.enforce_checklist_before_submit`, pas ici : cette carte
 * l'annonce et la rend lisible, elle ne l'applique pas.
 *
 * C'est délibéré. Une check-list dont le respect dépendrait de l'interface
 * n'atteste de rien — il suffirait d'un onglet resté ouvert sur une version
 * antérieure pour la contourner.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ChecklistCard({
  interventionId,
  organizationId,
  interventionTypeId,
  readOnly = false,
}: {
  interventionId: string;
  organizationId: string;
  interventionTypeId: string | null;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();

  const template = useQuery({
    queryKey: [...qk.industries.all, 'checklist-template', interventionTypeId ?? 'none'],
    queryFn: () => (interventionTypeId === null ? null : getChecklistTemplate(interventionTypeId)),
    enabled: interventionTypeId !== null,
    staleTime: 60 * 60_000,
  });

  const response = useQuery({
    queryKey: [...qk.industries.all, 'checklist-response', interventionId],
    queryFn: () => getChecklistResponse(interventionId),
  });

  const save = useMutation({
    mutationFn: saveChecklistResponse,
    onSuccess: (saved) => {
      queryClient.setQueryData(
        [...qk.industries.all, 'checklist-response', saved.interventionId],
        saved,
      );
    },
  });

  const [checked, setChecked] = useState<readonly string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Amorçage pendant le rendu, comme `ReportEditorPage` : un effet ferait
  // apparaître la liste vide une fraction de seconde. La garde empêche un
  // rafraîchissement en arrière-plan d'effacer les cases cochées.
  if (response.data !== undefined && loadedFor !== interventionId) {
    setLoadedFor(interventionId);
    setChecked(response.data?.checked ?? []);
  }

  if (interventionTypeId === null) return null;
  if (template.isPending) return <Skeleton className="h-40 w-full" />;

  const model = template.data;
  if (model === null || model === undefined) return null;

  const required = model.items.filter((item) => item.required);
  const missing = required.filter((item) => !checked.includes(item.code));
  const allRequiredDone = missing.length === 0;

  const toggle = (code: string) => {
    setChecked((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  const persist = (completed: boolean) => {
    setError(null);
    save.mutate(
      {
        interventionId,
        organizationId,
        checklistTemplateId: model.id,
        checked,
        completed,
      },
      { onError: setError },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="text-primary size-4 shrink-0" aria-hidden="true" />
          {model.label}
        </CardTitle>
        {model.description !== null ? (
          <p className="text-muted-foreground text-xs">{model.description}</p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <FormError error={error} />

        <div className="space-y-3">
          {model.items.map((item) => (
            <Checkbox
              key={item.id}
              label={item.label}
              {...(item.help !== null ? { description: item.help } : {})}
              disabled={readOnly || save.isPending}
              checked={checked.includes(item.code)}
              onCheckedChange={() => toggle(item.code)}
            />
          ))}
        </div>

        {/*
          L'état des points obligatoires est annoncé AVANT la tentative de
          soumission. Découvrir au moment de transmettre qu'il manque un
          contrôle, alors qu'on a déjà quitté le site, ne sert à rien.
        */}
        {required.length > 0 ? (
          <p
            className={cn(
              'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
              allRequiredDone
                ? 'border-success-border bg-success-subtle text-foreground'
                : 'border-warning-border bg-warning-subtle text-foreground',
            )}
          >
            {allRequiredDone ? (
              <CheckCircle2 className="text-success mt-px size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ListChecks className="text-warning mt-px size-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {allRequiredDone ? (
                <>Les {required.length} points obligatoires sont validés.</>
              ) : (
                <>
                  <strong className="font-semibold">
                    {missing.length} point{missing.length > 1 ? 's' : ''} obligatoire
                    {missing.length > 1 ? 's' : ''} restant
                    {missing.length > 1 ? 's' : ''}
                  </strong>{' '}
                  — le compte rendu ne pourra pas partir au contrôle tant qu’ils ne sont pas
                  validés.
                </>
              )}
            </span>
          </p>
        ) : null}

        {readOnly ? null : (
          <div className="border-border flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs">
              {checked.length} / {model.items.length} points validés
            </p>

            <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              <Button
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() => persist(false)}
              >
                Enregistrer
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={save.isPending || !allRequiredDone}
                onClick={() => persist(true)}
              >
                Clôturer la check-list
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
