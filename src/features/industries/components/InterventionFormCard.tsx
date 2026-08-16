import { ClipboardList } from 'lucide-react';
import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

import type { FormValues } from '../api/forms.api';
import { useFormResponse, useFormTemplate, useSaveFormResponse } from '../hooks/useForms';

import { DynamicForm } from './DynamicForm';
import { findMissingRequired } from './form-validation';

/**
 * Le relevé métier, à côté du compte rendu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE CARTE SÉPARÉE DU COMPTE RENDU
 *
 * Le compte rendu porte le RÉCIT et la signature : ce que le technicien
 * atteste. Le formulaire porte les MESURES : ce qu'il a constaté. Les mêler
 * reviendrait à confondre ce qu'on observe et ce qu'on certifie — et le
 * circuit de validation ne porte que sur le second.
 *
 * ELLE DISPARAÎT D'ELLE-MÊME
 *
 * Sans type d'intervention, ou sans modèle pour ce type, la carte ne s'affiche
 * pas. C'est un état valide et fréquent : quatre des sept types du pack fibre
 * n'ont pas encore de formulaire, et une organisation sans métier déclaré n'en
 * a aucun. L'écran redevient alors exactement ce qu'il était avant.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function InterventionFormCard({
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
  const template = useFormTemplate(interventionTypeId);
  const response = useFormResponse(interventionId);
  const save = useSaveFormResponse();

  const [values, setValues] = useState<FormValues>({});
  const [missing, setMissing] = useState<readonly string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  /**
   * Tampon d'édition, amorcé UNE FOIS à l'arrivée des données.
   *
   * Ajusté PENDANT le rendu, et non dans un effet — c'est le motif que React
   * recommande pour synchroniser un état sur une donnée reçue, et celui que
   * `ReportEditorPage` emploie déjà quelques lignes plus haut dans le même
   * écran. Un effet déclencherait un second rendu après affichage : le
   * formulaire apparaîtrait vide une fraction de seconde avant de se remplir.
   *
   * La garde sur l'identifiant est essentielle : sans elle, chaque
   * rafraîchissement en arrière-plan écraserait la saisie en cours, et le
   * technicien verrait ses valeurs disparaître sous ses doigts.
   */
  if (response.data !== undefined && loadedFor !== interventionId) {
    setLoadedFor(interventionId);
    setValues(response.data?.values ?? {});
  }

  if (interventionTypeId === null) return null;
  if (template.isPending) return <Skeleton className="h-40 w-full" />;

  // Liée à une constante locale : `template.data` reste `T | null | undefined`
  // pour le compilateur à l'intérieur des fermetures, qui ne peuvent pas
  // s'appuyer sur une garde évaluée au rendu.
  const model = template.data;
  if (model === null || model === undefined) return null;

  const fields = model.fields;
  const completedAt = response.data?.completedAt ?? null;

  const persist = (completed: boolean) => {
    setError(null);

    if (completed) {
      const empty = findMissingRequired(fields, values);
      if (empty.length > 0) {
        // On s'arrête AVANT l'aller-retour : le serveur refuserait de toute
        // façon, mais son message nomme un seul champ à la fois. Ici on les
        // désigne tous, là où ils se trouvent.
        setMissing(empty);
        return;
      }
    }

    setMissing([]);
    save.mutate(
      {
        interventionId,
        organizationId,
        formTemplateId: model.id,
        values,
        completed,
      },
      { onError: setError },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="text-primary size-4 shrink-0" aria-hidden="true" />
          {model.label}
        </CardTitle>
        {model.description !== null ? (
          <p className="text-muted-foreground text-xs">{model.description}</p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <FormError error={error} />

        <DynamicForm
          fields={fields}
          values={values}
          onChange={setValues}
          disabled={readOnly || save.isPending}
          missingKeys={missing}
        />

        {readOnly ? null : (
          <div className="border-border flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs">
              {completedAt !== null
                ? `Relevé complété le ${new Date(completedAt).toLocaleDateString('fr-FR')}.`
                : 'Enregistrez au fil de la saisie — le relevé peut rester incomplet.'}
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
                disabled={save.isPending}
                onClick={() => persist(true)}
              >
                {completedAt !== null ? 'Mettre à jour' : 'Marquer complet'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
