import { SelectField } from '@/components/ui/SelectField';
import { useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { StockConsumable, StockMovementInput, StockMovementType } from '../types/stock.types';

interface RecordMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: StockMovementInput) => Promise<unknown> | void;
  consumables: StockConsumable[];
  initialConsumable?: StockConsumable | null | undefined;
  initialType?: StockMovementType | undefined;
}

export function RecordMovementModal({
  isOpen,
  onClose,
  onSubmit,
  consumables,
  initialConsumable,
  initialType = 'in',
}: RecordMovementModalProps) {
  const [selectedConsumableId, setSelectedConsumableId] = useState<string>(
    initialConsumable?.id ?? consumables[0]?.id ?? '',
  );
  const [type, setType] = useState<StockMovementType>(initialType);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [technicianName, setTechnicianName] = useState<string>('');
  const [interventionRef, setInterventionRef] = useState<string>('');
  const [locationFrom, setLocationFrom] = useState<string>(
    initialConsumable?.location ?? consumables[0]?.location ?? '',
  );
  const [locationTo, setLocationTo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    Aucun effet de resynchronisation ici.

    La page ne monte cette modale QUE lorsqu'elle est ouverte : à chaque
    ouverture, React la remonte et les `useState` repartent des props. La
    version précédente la laissait montée en permanence et recopiait les props
    dans l'état à chaque ouverture — un `setState` dans un effet, donc un rendu
    en cascade à chaque frappe de dépendance.
  */

  const selectedConsumable = consumables.find((c) => c.id === selectedConsumableId);

  // Calcul du stock projeté
  const currentStock = selectedConsumable?.quantityInStock ?? 0;
  let projectedStock = currentStock;
  const numQty = Number(quantity) || 0;

  if (type === 'in') {
    projectedStock = currentStock + numQty;
  } else if (type === 'out') {
    projectedStock = Math.max(0, currentStock - numQty);
  } else if (type === 'adjustment') {
    projectedStock = numQty;
  }

  const handleConsumableChange = (id: string) => {
    setSelectedConsumableId(id);
    const item = consumables.find((c) => c.id === id);
    if (item) {
      setLocationFrom(item.location);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsumableId) {
      setError('Veuillez sélectionner un article.');
      return;
    }
    if (quantity <= 0 && type !== 'adjustment') {
      setError('La quantité doit être supérieure à zéro.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        consumableId: selectedConsumableId,
        type,
        quantity: numQty,
        reason: reason.trim() || getDefaultReason(type),
        technicianName: technicianName.trim() || undefined,
        interventionRef: interventionRef.trim() || undefined,
        locationFrom: locationFrom.trim() || undefined,
        locationTo: locationTo.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement du mouvement.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  function getDefaultReason(t: StockMovementType): string {
    switch (t) {
      case 'in':
        return 'Réception marchandise / Réapprovisionnement';
      case 'out':
        return 'Consommation intervention chantier';
      case 'transfer':
        return 'Transfert vers véhicule technicien';
      case 'adjustment':
        return 'Régularisation inventaire physique';
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Déclarer un mouvement de stock"
      description="Enregistrez une entrée, une sortie sur chantier ou un transfert vers un technicien."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="stock-movement-form"
            variant="primary"
            isLoading={isSubmitting}
            loadingLabel="Enregistrement du mouvement"
            disabled={consumables.length === 0}
          >
            Valider le mouvement
          </Button>
        </>
      }
    >
      <form id="stock-movement-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="border-error-border bg-error-subtle text-error rounded-xl border p-3 text-sm"
          >
            {error}
          </div>
        )}

        {/* Choix du type de mouvement (Boutons Onglets) */}
        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Nature du mouvement</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Choisissez l’opération à enregistrer avant de préciser l’article et la quantité.
            </p>
          </div>
          {/*
            Un groupe de boutons, pas un champ : `<label>` n'aurait pas de
            contrôle unique à désigner. `role="group"` + `aria-labelledby`
            annoncent l'intitulé une fois pour les quatre boutons.
          */}
          <span
            id="mouvement-type-libelle"
            className="text-foreground mb-1.5 block text-xs font-medium"
          >
            Type d’opération
          </span>
          <div
            role="group"
            aria-labelledby="mouvement-type-libelle"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <button
              type="button"
              onClick={() => setType('in')}
              aria-pressed={type === 'in'}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-xl border p-2.5 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ${
                type === 'in'
                  ? 'border-success bg-success/10 text-success ring-success/30 shadow-xs ring-1'
                  : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <ArrowDownLeft className="mb-1 size-4" aria-hidden="true" />
              <span>Entrée (BL)</span>
            </button>

            <button
              type="button"
              onClick={() => setType('out')}
              aria-pressed={type === 'out'}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-xl border p-2.5 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ${
                type === 'out'
                  ? 'border-error bg-error/10 text-error ring-error/30 shadow-xs ring-1'
                  : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <ArrowUpRight className="mb-1 size-4" aria-hidden="true" />
              <span>Sortie (Chantier)</span>
            </button>

            <button
              type="button"
              onClick={() => setType('transfer')}
              aria-pressed={type === 'transfer'}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-xl border p-2.5 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ${
                type === 'transfer'
                  ? 'border-primary bg-primary/10 text-primary ring-primary/30 shadow-xs ring-1'
                  : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <ArrowRight className="mb-1 size-4" aria-hidden="true" />
              <span>Transfert Véhicule</span>
            </button>

            <button
              type="button"
              onClick={() => setType('adjustment')}
              aria-pressed={type === 'adjustment'}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-xl border p-2.5 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ${
                type === 'adjustment'
                  ? 'border-warning bg-warning/10 text-warning ring-warning/30 shadow-xs ring-1'
                  : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <RefreshCw className="mb-1 size-4" aria-hidden="true" />
              <span>Inventaire</span>
            </button>
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Article &amp; quantité</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Le stock projeté est recalculé avant validation pour limiter les erreurs de saisie.
            </p>
          </div>

          {consumables.length === 0 ? (
            <div
              role="status"
              className="border-warning/30 bg-warning/10 text-warning rounded-xl border p-3 text-sm"
            >
              Aucun article enregistré dans le stock. Veuillez d'abord ajouter un article.
            </div>
          ) : (
            <SelectField
              id="recordmovementmodal-article-concerne"
              label="Article concerné"
              value={selectedConsumableId}
              onChange={(e) => handleConsumableChange(e.target.value)}
              required
            >
              {consumables.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.reference}] {c.name} — En stock : {c.quantityInStock} {c.unit}
                </option>
              ))}
            </SelectField>
          )}

          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
            <Input
              id="recordmovementmodal-champ"
              label={type === 'adjustment' ? 'Nouveau stock réel compté' : 'Quantité du mouvement'}
              type="number"
              min={0}
              step={
                selectedConsumable?.unit === 'm' ||
                selectedConsumable?.unit === 'kg' ||
                selectedConsumable?.unit === 'litre'
                  ? '0.1'
                  : '1'
              }
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              trailingSlot={
                selectedConsumable ? (
                  <span className="text-2xs text-muted-foreground pr-1 font-semibold uppercase">
                    {selectedConsumable.unit}
                  </span>
                ) : undefined
              }
              required
            />

            {selectedConsumable && (
              <div
                className="border-primary/20 bg-primary/5 rounded-xl border p-3"
                aria-live="polite"
              >
                <p className="text-3xs text-muted-foreground font-semibold tracking-wide uppercase">
                  Impact sur le stock
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Actuel : <strong className="text-foreground">{currentStock}</strong>
                  </span>
                  <span className="text-muted-foreground" aria-hidden="true">
                    →
                  </span>
                  <strong className="text-primary">
                    Nouveau : {projectedStock} {selectedConsumable.unit}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Traçabilité</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Reliez le mouvement à son motif, son bénéficiaire ou son dossier.
            </p>
          </div>

          <Input
            id="recordmovementmodal-motif-justificatif"
            label="Motif / justificatif"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={getDefaultReason(type)}
            autoComplete="off"
          />

          {(type === 'out' || type === 'transfer') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="recordmovementmodal-technicien-beneficiaire"
                label="Technicien / bénéficiaire"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Ex: Thomas Martin"
                autoComplete="off"
              />

              <Input
                id="recordmovementmodal-champ-2"
                label={type === 'out' ? 'Réf. intervention / dossier' : 'Véhicule de destination'}
                value={type === 'out' ? interventionRef : locationTo}
                onChange={(e) =>
                  type === 'out'
                    ? setInterventionRef(e.target.value)
                    : setLocationTo(e.target.value)
                }
                placeholder={type === 'out' ? 'Ex: INT-2026-081' : 'Ex: Renault Trafic AB-123-CD'}
                autoComplete="off"
              />
            </div>
          )}
        </section>
      </form>
    </Modal>
  );
}
