import { SelectField } from '@/components/ui/SelectField';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
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
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l’enregistrement.');
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
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-error-border bg-error-subtle p-3 text-xs text-error">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Référence */}
          <div>
            <label htmlFor="consumableformmodal-reference-sku" className="block text-xs font-semibold text-foreground mb-1">
              Référence / SKU *
            </label>
            <Input id="consumableformmodal-reference-sku"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Ex: FBR-PTO-01, DISJ-16A"
              required
            />
          </div>

          {/* Catégorie */}
          <div>
            <label htmlFor="consumableformmodal-categorie" className="block text-xs font-semibold text-foreground mb-1">
              Catégorie *
            </label>
            <SelectField id="consumableformmodal-categorie"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {COMMON_CONSUMABLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {/* Nom / Désignation */}
        <div>
          <label htmlFor="consumableformmodal-designation-de-l-article" className="block text-xs font-semibold text-foreground mb-1">
            Désignation de l’article *
          </label>
          <Input id="consumableformmodal-designation-de-l-article"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Câble Fibre Optique 4 FO G.657.A2 (500m)"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Unité */}
          <div>
            <label htmlFor="consumableformmodal-unite" className="block text-xs font-semibold text-foreground mb-1">
              Unité *
            </label>
            <SelectField id="consumableformmodal-unite"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {COMMON_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </SelectField>
          </div>

          {/* Quantité initiale / en stock */}
          <div>
            <label htmlFor="consumableformmodal-quantite-en-stock" className="block text-xs font-semibold text-foreground mb-1">
              Quantité en stock *
            </label>
            <Input id="consumableformmodal-quantite-en-stock"
              type="number"
              min={0}
              step={formData.unit === 'm' || formData.unit === 'kg' || formData.unit === 'litre' ? '0.1' : '1'}
              value={formData.quantityInStock}
              onChange={(e) =>
                setFormData({ ...formData, quantityInStock: Math.max(0, Number(e.target.value)) })
              }
              required
            />
          </div>

          {/* Seuil minimum critique */}
          <div>
            <label htmlFor="consumableformmodal-seuil-d-alerte-min" className="block text-xs font-semibold text-foreground mb-1">
              Seuil d’alerte min. *
            </label>
            <Input id="consumableformmodal-seuil-d-alerte-min"
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
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Prix d'achat unitaire HT */}
          <div>
            <label htmlFor="consumableformmodal-prix-d-achat-unitaire-ht" className="block text-xs font-semibold text-foreground mb-1">
              Prix d’achat unitaire HT (€)
            </label>
            <Input id="consumableformmodal-prix-d-achat-unitaire-ht"
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
          </div>

          {/* Prix de vente unitaire HT */}
          <div>
            <label htmlFor="consumableformmodal-prix-de-facturation-ht" className="block text-xs font-semibold text-foreground mb-1">
              Prix de facturation HT (€)
            </label>
            <Input id="consumableformmodal-prix-de-facturation-ht"
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
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Emplacement */}
          <div>
            <label htmlFor="consumableformmodal-emplacement-de-stockage" className="block text-xs font-semibold text-foreground mb-1">
              Emplacement de stockage
            </label>
            <Input id="consumableformmodal-emplacement-de-stockage"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Dépôt Central - Allée B, Véhicule 01..."
            />
          </div>

          {/* Fournisseur */}
          <div>
            <label htmlFor="consumableformmodal-fournisseur-habituel" className="block text-xs font-semibold text-foreground mb-1">
              Fournisseur habituel
            </label>
            <Input id="consumableformmodal-fournisseur-habituel"
              value={formData.supplier ?? ''}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="Ex: Rexel, Sonepar, CEDEO, Wurth..."
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="consumableformmodal-notes-amp-remarques" className="block text-xs font-semibold text-foreground mb-1">
            Notes &amp; Remarques
          </label>
          <textarea id="consumableformmodal-notes-amp-remarques"
            value={formData.notes ?? ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Informations utiles, fiche technique, équivalences..."
            rows={2}
            className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : isEditing ? 'Mettre à jour' : 'Ajouter l’article'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
