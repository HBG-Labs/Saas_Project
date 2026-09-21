import { BadgeInfo, Building2, FileSliders, Languages, List } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import type { DocumentOptions, DocumentMode } from '../document-options';

const OPTIONS: Array<{ key: keyof DocumentOptions; label: string }> = [
  { key: 'showDeliveryAddress', label: 'Adresse de livraison' },
  { key: 'showRegistrationNumber', label: 'SIREN ou SIRET' },
  { key: 'showVatNumber', label: 'N° de TVA intracommunautaire' },
];
const EXTRAS: Array<{ key: keyof DocumentOptions; label: string }> = [
  { key: 'showBankDetails', label: 'Coordonnées bancaires' },
  { key: 'showTitle', label: 'Intitulé du document' },
  { key: 'showFreeField', label: 'Champ libre' },
  { key: 'showGlobalDiscount', label: 'Remise globale' },
];

export function DocumentOptionsPanel({
  kind,
  value,
  onChange,
}: {
  kind: 'quote' | 'invoice';
  value: DocumentOptions;
  onChange: (value: DocumentOptions) => void;
}) {
  const setMode = (mode: DocumentMode) =>
    onChange({
      ...value,
      mode,
      ...(mode !== 'quick'
        ? { showRegistrationNumber: true, showVatNumber: true, showTitle: true }
        : {}),
    });
  const toggle = (key: keyof DocumentOptions, checked: boolean | 'indeterminate') =>
    onChange({ ...value, [key]: checked === true });
  return (
    <div className="space-y-5 p-4 text-xs">
      <section>
        <h3 className="text-foreground mb-2 flex items-center gap-2 font-bold">
          <FileSliders className="size-4" />
          Type de document
        </h3>
        <div className="space-y-2">
          {(['quick', 'complete'] as const).map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`${kind}-mode`}
                checked={value.mode === mode}
                onChange={() => setMode(mode)}
                className="accent-primary"
              />
              {mode === 'quick' ? 'Rapide' : 'Complet'}
            </label>
          ))}
          {kind === 'invoice' ? (
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="invoice-mode"
                checked={value.mode === 'electronic'}
                onChange={() => setMode('electronic')}
                className="accent-primary mt-0.5"
              />
              <span>
                Format électronique · Factur‑X{' '}
                <span className="text-muted-foreground text-2xs block">
                  PDF lisible + données structurées conformes.
                </span>
              </span>
            </label>
          ) : (
            <p className="text-muted-foreground text-2xs flex gap-1.5">
              <BadgeInfo className="size-3.5 shrink-0" />
              Factur‑X est réservé aux factures.
            </p>
          )}
        </div>
      </section>
      <section className="border-border border-t pt-4">
        <h3 className="text-foreground mb-2 flex items-center gap-2 font-bold">
          <Building2 className="size-4" />
          Client
        </h3>
        <div className="space-y-2">
          {OPTIONS.map((option) => (
            <Checkbox
              key={option.key}
              label={option.label}
              checked={Boolean(value[option.key])}
              onCheckedChange={(checked) => toggle(option.key, checked)}
              className="[&_label]:text-xs"
            />
          ))}
        </div>
      </section>
      <section className="border-border border-t pt-4">
        <h3 className="text-foreground mb-2 flex items-center gap-2 font-bold">
          <Languages className="size-4" />
          Langue
        </h3>
        <Select
          value={value.language}
          onValueChange={() => undefined}
          options={[{ value: 'fr', label: 'Français' }]}
        />
      </section>
      <section className="border-border border-t pt-4">
        <h3 className="text-foreground mb-2 flex items-center gap-2 font-bold">
          <List className="size-4" />
          Informations complémentaires
        </h3>
        <div className="space-y-2">
          {kind === 'quote' ? (
            <>
              <Checkbox
                label="Conditions d’acceptation"
                checked={value.showAcceptanceTerms}
                onCheckedChange={(checked) => toggle('showAcceptanceTerms', checked)}
                className="[&_label]:text-xs"
              />
              <Checkbox
                label="Champ signature"
                checked={value.showSignature}
                onCheckedChange={(checked) => toggle('showSignature', checked)}
                className="[&_label]:text-xs"
              />
            </>
          ) : null}
          {EXTRAS.map((option) => (
            <Checkbox
              key={option.key}
              label={option.label}
              checked={Boolean(value[option.key])}
              onCheckedChange={(checked) => toggle(option.key, checked)}
              className="[&_label]:text-xs"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
