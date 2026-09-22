import { BadgeInfo, Building2, FileSliders, List } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
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
        ? {
            showDeliveryAddress: true,
            showRegistrationNumber: true,
            showVatNumber: true,
            showBankDetails: true,
            showTitle: true,
            ...(kind === 'quote' ? { showAcceptanceTerms: true, showSignature: true } : {}),
          }
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
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name={`${kind}-mode`}
              checked={value.mode === 'electronic'}
              onChange={() => setMode('electronic')}
              className="accent-primary mt-0.5"
            />
            <span>
              {kind === 'invoice' ? 'Format électronique · Factur‑X' : 'Format électronique'}{' '}
              <span className="text-muted-foreground text-2xs block leading-relaxed">
                {kind === 'invoice'
                  ? 'PDF lisible + données structurées conformes.'
                  : 'Devis structuré, prêt pour la conversion Factur‑X lors de la facturation.'}
              </span>
            </span>
          </label>
          {kind === 'quote' && value.mode === 'electronic' ? (
            <p className="bg-primary/5 text-muted-foreground text-2xs flex gap-1.5 rounded-lg p-2 leading-relaxed">
              <BadgeInfo className="text-primary size-3.5 shrink-0" />
              Factur‑X est une norme de facture : les réglages seront transmis à la facture créée
              depuis ce devis.
            </p>
          ) : null}
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
