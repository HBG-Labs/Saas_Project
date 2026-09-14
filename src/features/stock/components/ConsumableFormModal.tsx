import { SelectField } from '@/components/ui/SelectField';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import {
  COMMON_CONSUMABLE_CATEGORIES,
  COMMON_UNITS,
  type ConsumableInput,
  type StockConsumable,
} from '../types/stock.types';

interface ConsumableFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ConsumableInput) => Promise<unknown> | void;
  consumableToEdit?: StockConsumable | null;
}

export function ConsumableFormModal({
  isOpen,
  onClose,
  onSubmit,
  consumableToEdit,
}: ConsumableFormModalProps) {
  const isEditing = Boolean(consumableToEdit);

  const [formData, setFormData] = useState<ConsumableInput>(() =>
    consumableToEdit
      ? {
          reference: consumableToEdit.reference,
          name: consumableToEdit.name,
          category: consumableToEdit.category,
          unit: consumableToEdit.unit,
          quantityInStock: consumableToEdit.quantityInStock,
          minThreshold: consumableToEdit.minThreshold,
          unitPriceEur: consumableToEdit.unitPriceEur,
          sellingPriceEur: consumableToEdit.sellingPriceEur,
          location: consumableToEdit.location,
          supplier: consumableToEdit.supplier ?? '',
          notes: consumableToEdit.notes ?? '',
        }
      : {
          reference: '',
          name: '',
          category: COMMON_CONSUMABLE_CATEGORIES[0] || 'Câblage & Fibre',
          unit: 'pièce',
          quantityInStock: 10,
          minThreshold: 5,
          unitPriceEur: undefined,
          sellingPriceEur: undefined,
          location: 'Dépôt Central',
          supplier: '',
          notes: '',
        },
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    L'état part directement des props : la modale n'est montée que lorsqu'elle
    est ouverte, donc React la remonte à chaque ouverture. La version précédente
    la laissait montée en permanence et recopiait les props dans l'état par un
    `useEffect` — un `setState` dans un effet, donc un rendu en cascade.
  */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.reference.trim()) {
      setError('Veuillez renseigner la référence et le nom de l’article.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        ...formData,
        reference: formData.reference.trim().toUpperCase(),
        name: formData.name.trim(),
        location: formData.location.trim() || 'Dépôt Central',
        supplier: formData.supplier?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Une erreur est survenue lors de l’enregistrement.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={isEditing ? 'Modifier l’article de stock' : 'Ajouter un article / fourniture'}
      description="Renseignez les détails du consommable pour suivre les quantités et alertes de réapprovisionnement."
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="consumable-form"
            variant="primary"
            isLoading={isSubmitting}
            loadingLabel="Enregistrement…"
          >
            {isEditing ? 'Mettre à jour' : 'Ajouter l’article'}
          </Button>
        </>
      }
    >
      <form id="consumable-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="border-error-border bg-error-subtle text-error rounded-xl border p-3 text-sm"
          >
            {error}
          </div>
        )}

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Article</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Identifiez clairement la fourniture dans le catalogue et les mouvements de stock.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="consumableformmodal-reference-sku"
              label="Référence / SKU"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Ex: FBR-PTO-01, DISJ-16A"
              autoComplete="off"
              required
            />

            <SelectField
              id="consumableformmodal-categorie"
              label="Catégorie"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            >
              {COMMON_CONSUMABLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </SelectField>
          </div>

          <Input
            id="consumableformmodal-designation-de-l-article"
            label="Désignation de l’article"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Câble Fibre Optique 4 FO G.657.A2 (500m)"
            autoComplete="off"
            required
          />
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Stock &amp; prix</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Définissez l’unité de suivi, le seuil d’alerte et les prix de référence.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              id="consumableformmodal-unite"
              label="Unité"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              required
            >
              {COMMON_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </SelectField>

            <Input
              id="consumableformmodal-quantite-en-stock"
              label="Quantité en stock"
              type="number"
              min={0}
              step={
                formData.unit === 'm' || formData.unit === 'kg' || formData.unit === 'litre'
                  ? '0.1'
                  : '1'
              }
              value={formData.quantityInStock}
              onChange={(e) =>
                setFormData({ ...formData, quantityInStock: Math.max(0, Number(e.target.value)) })
              }
              required
            />

            <Input
              id="consumableformmodal-seuil-d-alerte-min"
              label="Seuil d’alerte min."
              type="number"
              min={0}
              step={1}
              value={formData.minThreshold}
              onChange={(e) =>
                setFormData({ ...formData, minThreshold: Math.max(0, Number(e.target.value)) })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="consumableformmodal-prix-d-achat-unitaire-ht"
              label="Prix d’achat unitaire HT (€)"
              type="number"
              min={0}
              step="0.01"
              value={formData.unitPriceEur ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unitPriceEur: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="Ex: 12.50"
            />

            <Input
              id="consumableformmodal-prix-de-facturation-ht"
              label="Prix de facturation HT (€)"
              type="number"
              min={0}
              step="0.01"
              value={formData.sellingPriceEur ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sellingPriceEur: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="Ex: 24.00"
            />
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Logistique &amp; notes</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Ajoutez les informations qui facilitent le rangement et le réapprovisionnement.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="consumableformmodal-emplacement-de-stockage"
              label="Emplacement de stockage"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Dépôt Central - Allée B, Véhicule 01..."
              autoComplete="off"
            />

            <Input
              id="consumableformmodal-fournisseur-habituel"
              label="Fournisseur habituel"
              value={formData.supplier ?? ''}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="Ex: Rexel, Sonepar, CEDEO, Wurth..."
              autoComplete="organization"
            />
          </div>

          <Textarea
            id="consumableformmodal-notes-amp-remarques"
            label="Notes & remarques"
            value={formData.notes ?? ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Informations utiles, fiche technique, équivalences..."
            rows={3}
          />
        </section>
      </form>
    </Modal>
  );
}
