import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/cn';
import type { Json } from '@/types/database';

import type { FormField, FormValues } from '../api/forms.api';

/**
 * Rend un formulaire métier à partir de sa définition.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE COMPOSANT IGNORE L'EXISTENCE DE LA FIBRE
 *
 * Il ne contient aucun `if (industry === …)`, et n'en contiendra jamais : il
 * reçoit des champs et les affiche. Ajouter le froid ou le paysage ne demandera
 * pas d'y toucher — c'est précisément ce que l'architecture cherchait.
 *
 * SAISIE SUR LE TERRAIN
 *
 * Chaque champ occupe toute la largeur sur téléphone : deux champs côte à côte
 * font 150 px chacun, et une valeur de mesure y devient illisible. La densité
 * ne revient qu'à partir de `sm`, là où l'écran la permet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface DynamicFormProps {
  fields: readonly FormField[];
  values: FormValues;
  onChange: (values: FormValues) => void;
  disabled?: boolean;
  /**
   * Champs obligatoires laissés vides, par clé.
   *
   * Signalés seulement quand l'utilisateur tente de déclarer le formulaire
   * complet : marquer en rouge un champ qu'on n'a pas encore atteint est une
   * réprimande, pas une aide.
   */
  missingKeys?: readonly string[];
}

/** Libellé d'un champ, unité comprise : « Puissance reçue (dBm) ». */
function fieldLabel(field: FormField): string {
  return field.unit === null || field.unit === '' ? field.label : `${field.label} (${field.unit})`;
}

export function DynamicForm({
  fields,
  values,
  onChange,
  disabled = false,
  missingKeys = [],
}: DynamicFormProps) {
  const missing = new Set(missingKeys);

  const set = (key: string, value: Json) => {
    // Une valeur effacée est RETIRÉE du document plutôt que mise à `null` :
    // `app.validate_form_response` traite l'absence et la chaîne vide de la
    // même façon, et un document sans clés mortes reste lisible.
    const next = { ...values };
    if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const raw = values[field.key];
        const isMissing = missing.has(field.key);
        const hint = field.help ?? undefined;

        const common = {
          label: fieldLabel(field),
          required: field.required,
          disabled,
          ...(hint !== undefined ? { hint } : {}),
          ...(isMissing ? { error: 'Ce champ est obligatoire.' } : {}),
        };

        switch (field.type) {
          case 'textarea':
            return (
              <Textarea
                key={field.id}
                {...common}
                rows={3}
                value={typeof raw === 'string' ? raw : ''}
                onChange={(event) => set(field.key, event.target.value)}
              />
            );

          case 'number':
            return (
              <Input
                key={field.id}
                {...common}
                type="number"
                inputMode="decimal"
                {...(field.min !== null ? { min: field.min } : {})}
                {...(field.max !== null ? { max: field.max } : {})}
                step="any"
                value={typeof raw === 'number' ? String(raw) : ''}
                onChange={(event) => {
                  const text = event.target.value;
                  // Un champ vidé retire la clé ; sinon on écrit un NOMBRE et
                  // non une chaîne — le serveur refuse « 12 » là où il attend 12.
                  set(field.key, text === '' ? '' : Number(text));
                }}
              />
            );

          case 'boolean':
            return (
              <Checkbox
                key={field.id}
                label={fieldLabel(field)}
                {...(hint !== undefined ? { description: hint } : {})}
                disabled={disabled}
                checked={raw === true}
                onCheckedChange={(checked) => set(field.key, checked)}
              />
            );

          case 'select':
            return (
              <Select
                key={field.id}
                {...common}
                placeholder="Sélectionner…"
                options={field.options.map((option) => ({ value: option, label: option }))}
                value={typeof raw === 'string' ? raw : ''}
                onValueChange={(value) => set(field.key, value)}
              />
            );

          case 'multiselect':
            return (
              <fieldset key={field.id} className="space-y-2">
                <legend className="text-foreground mb-1.5 text-xs font-medium">
                  {fieldLabel(field)}
                  {field.required ? <span className="text-error ml-0.5">*</span> : null}
                </legend>
                {hint !== undefined ? (
                  <p className="text-muted-foreground -mt-1 text-xs">{hint}</p>
                ) : null}

                {/*
                  Des cases plutôt qu'une liste à choix multiple : sur un
                  téléphone, une `<select multiple>` exige un appui long et une
                  précision que le terrain n'offre pas.
                */}
                <div className="flex flex-wrap gap-2">
                  {field.options.map((option) => {
                    const selected = Array.isArray(raw) && raw.includes(option);

                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        onClick={() => {
                          const current = Array.isArray(raw)
                            ? raw.filter((item): item is string => typeof item === 'string')
                            : [];
                          set(
                            field.key,
                            selected
                              ? current.filter((item) => item !== option)
                              : [...current, option],
                          );
                        }}
                        className={cn(
                          'min-h-touch cursor-pointer rounded-lg border px-3 text-xs font-medium transition-colors sm:min-h-9',
                          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                          selected
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover',
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );

          case 'date':
            return (
              <Input
                key={field.id}
                {...common}
                type="date"
                value={typeof raw === 'string' ? raw : ''}
                onChange={(event) => set(field.key, event.target.value)}
              />
            );

          case 'text':
          default:
            return (
              <Input
                key={field.id}
                {...common}
                type="text"
                value={typeof raw === 'string' ? raw : ''}
                onChange={(event) => set(field.key, event.target.value)}
              />
            );
        }
      })}
    </div>
  );
}
